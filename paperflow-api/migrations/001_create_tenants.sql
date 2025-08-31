-- Migration: Create tenant multi-tenancy support
-- Date: 2024-12-31
-- Description: Add tenant tables and update existing tables with tenant_id

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  custom_domain VARCHAR(255),
  settings JSONB DEFAULT '{}',
  quotas JSONB DEFAULT '{}',
  billing JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
  CONSTRAINT tenants_slug_format CHECK (slug ~* '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT tenants_slug_length CHECK (LENGTH(slug) >= 3 AND LENGTH(slug) <= 63)
);

-- Create tenant usage table
CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate entries per period
  UNIQUE(tenant_id, metric_name, period_start)
);

-- Create tenant overages table (for billing)
CREATE TABLE IF NOT EXISTS tenant_overages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  billed_at TIMESTAMPTZ,
  
  -- Index for billing queries
  INDEX idx_tenant_overages_billing (tenant_id, billed_at, recorded_at)
);

-- Add tenant_id to existing tables (if they exist)
-- Users table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    -- Add tenant_id column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') THEN
      ALTER TABLE users ADD COLUMN tenant_id UUID;
      
      -- Create a default tenant for existing users
      INSERT INTO tenants (id, slug, name, plan) 
      VALUES ('00000000-0000-0000-0000-000000000001', 'default-tenant', 'Default Tenant', 'enterprise')
      ON CONFLICT (slug) DO NOTHING;
      
      -- Assign existing users to default tenant
      UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
      
      -- Make tenant_id NOT NULL after assignment
      ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
  END IF;
END $$;

-- Documents table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tenant_id') THEN
      ALTER TABLE documents ADD COLUMN tenant_id UUID;
      
      -- Assign existing documents to default tenant
      UPDATE documents SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
      
      -- Make tenant_id NOT NULL after assignment
      ALTER TABLE documents ALTER COLUMN tenant_id SET NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE documents ADD CONSTRAINT fk_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
  END IF;
END $$;

-- Webhooks table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhooks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhooks' AND column_name = 'tenant_id') THEN
      ALTER TABLE webhooks ADD COLUMN tenant_id UUID;
      
      -- Assign existing webhooks to default tenant
      UPDATE webhooks SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
      
      -- Make tenant_id NOT NULL after assignment
      ALTER TABLE webhooks ALTER COLUMN tenant_id SET NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE webhooks ADD CONSTRAINT fk_webhooks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
  END IF;
END $$;

-- Audit log table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'tenant_id') THEN
      ALTER TABLE audit_log ADD COLUMN tenant_id UUID;
      
      -- Assign existing audit logs to default tenant
      UPDATE audit_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
      
      -- Make tenant_id NOT NULL after assignment
      ALTER TABLE audit_log ALTER COLUMN tenant_id SET NOT NULL;
      
      -- Add foreign key constraint
      ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
  END IF;
END $$;

-- Create composite indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents(tenant_id, status, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_user ON documents(tenant_id, user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_active ON webhooks(tenant_id, active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_date ON audit_log(tenant_id, created_at DESC);

-- Create indexes for tenant usage table
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_metric ON tenant_usage(tenant_id, metric_name, period_start);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_period ON tenant_usage(period_start, period_end);

-- Create indexes for tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan) WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tenants table
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert demo tenant for testing
INSERT INTO tenants (id, slug, name, plan, settings, quotas, billing) VALUES (
  'demo-tenant-uuid',
  'demo-tenant',
  'Demo Company',
  'pro',
  '{"timezone": "America/Sao_Paulo", "locale": "pt-BR", "currency": "BRL", "dateFormat": "DD/MM/YYYY"}',
  '{"currentUsage": {"documents": 5, "users": 2, "templates": 1, "webhooks": 1, "storageGB": 0.8}}',
  '{"allowOverage": true}'
) ON CONFLICT (slug) DO NOTHING;

-- Create RLS (Row Level Security) policies for multi-tenancy
-- Enable RLS on tenant-scoped tables

-- Users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Documents RLS  
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Webhooks RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhooks_tenant_isolation ON webhooks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Audit log RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Tenant usage RLS
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_usage_tenant_isolation ON tenant_usage
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Tenant overages RLS
ALTER TABLE tenant_overages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_overages_tenant_isolation ON tenant_overages
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Grant permissions (adjust according to your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO paperflow_api;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO paperflow_api;

-- Create function to set current tenant (for RLS)
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_uuid uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE tenants IS 'Multi-tenant isolation table containing tenant configurations, quotas, and billing information';
COMMENT ON TABLE tenant_usage IS 'Tracks resource usage per tenant for quota enforcement and billing';
COMMENT ON TABLE tenant_overages IS 'Records quota overages for billing purposes';

-- Migration complete
SELECT 'Multi-tenant schema created successfully' as status;