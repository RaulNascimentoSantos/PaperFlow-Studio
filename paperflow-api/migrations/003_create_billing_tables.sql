-- Migration: Create billing and usage tracking tables
-- Date: 2024-12-31
-- Description: Add billing tables for quota enforcement and monetization

-- Create billing usage records table
CREATE TABLE IF NOT EXISTS billing_usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  cost DECIMAL(10, 4) DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT billing_usage_currency_check CHECK (currency IN ('BRL', 'USD', 'EUR')),
  CONSTRAINT billing_usage_amount_positive CHECK (amount >= 0),
  CONSTRAINT billing_usage_cost_positive CHECK (cost >= 0)
);

-- Create billing overage charges table
CREATE TABLE IF NOT EXISTS billing_overage_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  unit_cost DECIMAL(10, 4) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  charged_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT billing_overage_currency_check CHECK (currency IN ('BRL', 'USD', 'EUR')),
  CONSTRAINT billing_overage_amount_positive CHECK (amount > 0),
  CONSTRAINT billing_overage_cost_positive CHECK (total_cost > 0)
);

-- Create billing invoices table
CREATE TABLE IF NOT EXISTS billing_invoices (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  taxes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT billing_invoices_currency_check CHECK (currency IN ('BRL', 'USD', 'EUR')),
  CONSTRAINT billing_invoices_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  CONSTRAINT billing_invoices_total_positive CHECK (total >= 0)
);

-- Create billing events log table
CREATE TABLE IF NOT EXISTS billing_events_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT billing_events_type_check CHECK (event_type IN (
    'usage_recorded', 'quota_exceeded', 'overage_used', 'plan_changed', 
    'payment_due', 'payment_received', 'invoice_created'
  ))
);

-- Create payment methods table
CREATE TABLE IF NOT EXISTS billing_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT billing_payment_provider_check CHECK (provider IN ('stripe', 'pagarme', 'paypal', 'mercadopago')),
  CONSTRAINT billing_payment_type_check CHECK (type IN ('credit_card', 'debit_card', 'pix', 'boleto', 'bank_transfer'))
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_subscription_id VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT billing_subscription_status_check CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'trialing'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant_period ON billing_usage_records(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_usage_resource ON billing_usage_records(resource, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_overage_tenant ON billing_overage_charges(tenant_id, charged_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_overage_resource ON billing_overage_charges(resource, charged_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON billing_invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_period ON billing_invoices(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON billing_events_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_processed ON billing_events_log(processed_at) WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_tenant ON billing_payment_methods(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_default ON billing_payment_methods(tenant_id, is_default) WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant ON billing_subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider ON billing_subscriptions(provider, provider_subscription_id);

-- Enable RLS for multi-tenancy
ALTER TABLE billing_usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_usage_records_tenant_isolation ON billing_usage_records
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE billing_overage_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_overage_charges_tenant_isolation ON billing_overage_charges
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_invoices_tenant_isolation ON billing_invoices
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE billing_events_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_events_log_tenant_isolation ON billing_events_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE billing_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_payment_methods_tenant_isolation ON billing_payment_methods
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_subscriptions_tenant_isolation ON billing_subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_billing_payment_methods_updated_at ON billing_payment_methods;
CREATE TRIGGER update_billing_payment_methods_updated_at
  BEFORE UPDATE ON billing_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_subscriptions_updated_at ON billing_subscriptions;
CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample billing data for demo tenant
INSERT INTO billing_usage_records (tenant_id, resource, amount, cost, currency, period_start, period_end) VALUES
('demo-tenant-uuid', 'documents', 150, 0, 'BRL', '2024-12-01', '2024-12-31'),
('demo-tenant-uuid', 'templates', 3, 0, 'BRL', '2024-12-01', '2024-12-31'),
('demo-tenant-uuid', 'webhooks', 245, 0, 'BRL', '2024-12-01', '2024-12-31')
ON CONFLICT DO NOTHING;

INSERT INTO billing_overage_charges (tenant_id, resource, amount, unit_cost, total_cost, currency) VALUES
('demo-tenant-uuid', 'documents', 50, 0.15, 7.50, 'BRL')
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE billing_usage_records IS 'Records resource usage for billing calculation and reporting';
COMMENT ON TABLE billing_overage_charges IS 'Tracks overage charges when tenants exceed their plan quotas';
COMMENT ON TABLE billing_invoices IS 'Generated invoices for billing periods with line items and totals';
COMMENT ON TABLE billing_events_log IS 'Audit log of all billing-related events for compliance and debugging';
COMMENT ON TABLE billing_payment_methods IS 'Stored payment methods for automatic billing';
COMMENT ON TABLE billing_subscriptions IS 'Subscription management for recurring billing';

-- Migration complete
SELECT 'Billing system tables created successfully' as status;