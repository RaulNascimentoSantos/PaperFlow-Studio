-- Migration: Create template system tables
-- Date: 2024-12-31
-- Description: Add template and template execution tables for workflow automation

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  icon VARCHAR(10) DEFAULT '📄',
  tags JSONB DEFAULT '[]',
  visibility VARCHAR(20) NOT NULL DEFAULT 'tenant',
  
  -- Workflow configuration
  workflow JSONB NOT NULL DEFAULT '{"steps": [], "automations": [], "integrations": [], "notifications": []}',
  
  -- Fields and validation
  fields JSONB DEFAULT '[]',
  validations JSONB DEFAULT '[]',
  
  -- PII detection settings
  pii_detection JSONB DEFAULT '{"enabled": true, "patterns": ["cpf", "cnpj", "rg"], "redactionStrategy": "partial"}',
  
  -- Metrics and performance
  metrics JSONB DEFAULT '{"averageProcessingTime": 0, "successRate": 100, "usageCount": 0, "rating": 0, "reviews": 0}',
  
  -- Marketplace settings (optional)
  marketplace JSONB,
  
  -- Versioning and metadata
  version VARCHAR(20) DEFAULT '1.0.0',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT templates_category_check CHECK (category IN ('hr', 'finance', 'legal', 'compliance', 'procurement', 'sales')),
  CONSTRAINT templates_visibility_check CHECK (visibility IN ('private', 'tenant', 'public', 'marketplace')),
  CONSTRAINT templates_slug_format CHECK (slug ~* '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT templates_tenant_slug_unique UNIQUE (tenant_id, slug)
);

-- Create template executions table
CREATE TABLE IF NOT EXISTS template_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Execution state
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_step UUID,
  
  -- Execution data
  step_results JSONB DEFAULT '{}',
  data JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  
  -- Metrics
  metrics JSONB DEFAULT '{"stepCount": 0, "completedSteps": 0, "failedSteps": 0, "skippedSteps": 0, "retryCount": 0}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT template_executions_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Create template ratings table
CREATE TABLE IF NOT EXISTS template_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT template_ratings_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT template_ratings_unique UNIQUE (template_id, user_id)
);

-- Create template purchases table (for marketplace)
CREATE TABLE IF NOT EXISTS template_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  buyer_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seller_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(255),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT template_purchases_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  CONSTRAINT template_purchases_currency_check CHECK (currency IN ('BRL', 'USD', 'EUR')),
  CONSTRAINT template_purchases_unique UNIQUE (template_id, buyer_tenant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_tenant_category ON templates(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_visibility_category ON templates(visibility, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_slug ON templates(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING gin(tags) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_template_executions_template ON template_executions(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_executions_tenant ON template_executions(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_executions_document ON template_executions(document_id);
CREATE INDEX IF NOT EXISTS idx_template_executions_status ON template_executions(status, created_at);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_ratings(template_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_template_ratings_tenant ON template_ratings(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_purchases_template ON template_purchases(template_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_purchases_buyer ON template_purchases(buyer_tenant_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_purchases_seller ON template_purchases(seller_tenant_id, purchased_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_template_executions_updated_at ON template_executions;
CREATE TRIGGER update_template_executions_updated_at
  BEFORE UPDATE ON template_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_template_ratings_updated_at ON template_ratings;
CREATE TRIGGER update_template_ratings_updated_at
  BEFORE UPDATE ON template_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for multi-tenancy
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_tenant_isolation ON templates
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid OR 
    visibility IN ('public', 'marketplace')
  );

ALTER TABLE template_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_executions_tenant_isolation ON template_executions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE template_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_ratings_tenant_isolation ON template_ratings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_purchases_tenant_isolation ON template_purchases
  USING (
    buyer_tenant_id = current_setting('app.current_tenant_id', true)::uuid OR
    seller_tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- Insert default templates for demo
INSERT INTO templates (
  id, tenant_id, slug, name, description, category, icon, tags, visibility,
  workflow, fields, validations, created_by, created_at, updated_at
) VALUES 
-- RH - Admissional Completo
(
  'hr-admissional-completo',
  NULL, -- Global template
  'hr-admissional-completo',
  'Admissão de Colaborador',
  'Template completo para processo de admissão com validação automática de documentos e integração com RH.',
  'hr',
  '👥',
  '["admissao", "rh", "documentos", "colaborador"]',
  'public',
  '{
    "steps": [
      {
        "id": "upload-docs",
        "name": "Upload Documentos",
        "type": "upload",
        "order": 1,
        "required": true,
        "config": {
          "required": ["RG", "CPF", "CTPS", "Comprovante Residência"],
          "allowedFormats": ["pdf", "jpg", "png"]
        }
      },
      {
        "id": "validation",
        "name": "Validação Automática",
        "type": "validation",
        "order": 2,
        "required": true,
        "config": {
          "rules": ["cpf_valid", "rg_format"]
        }
      },
      {
        "id": "extraction",
        "name": "Extração de Dados",
        "type": "extraction",
        "order": 3,
        "required": true,
        "config": {
          "fields": ["nome", "cpf", "rg", "data_nascimento"]
        }
      },
      {
        "id": "approval",
        "name": "Aprovação RH",
        "type": "approval",
        "order": 4,
        "required": true,
        "config": {
          "approvers": ["rh_team"]
        }
      },
      {
        "id": "signature",
        "name": "Assinatura Digital",
        "type": "signature",
        "order": 5,
        "required": true,
        "config": {
          "parties": ["employee", "hr_manager"]
        }
      },
      {
        "id": "package",
        "name": "Geração de Dossiê",
        "type": "package",
        "order": 6,
        "required": false,
        "config": {
          "format": "pdf_with_evidence"
        }
      }
    ],
    "automations": [],
    "integrations": [],
    "notifications": []
  }',
  '[
    {"id": "nome", "name": "nome", "label": "Nome Completo", "type": "text", "required": true},
    {"id": "cpf", "name": "cpf", "label": "CPF", "type": "text", "required": true, "validation": {"format": "cpf"}},
    {"id": "rg", "name": "rg", "label": "RG", "type": "text", "required": true},
    {"id": "data_nascimento", "name": "data_nascimento", "label": "Data de Nascimento", "type": "date", "required": true}
  ]',
  '[
    {"id": "cpf-valid", "name": "CPF Válido", "type": "format", "field": "cpf", "config": {"format": "cpf"}, "errorMessage": "CPF inválido", "severity": "error"}
  ]',
  'demo-tenant-uuid', -- Created by demo tenant
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),
-- Compras - Onboarding Fornecedor  
(
  'procurement-supplier-kyc',
  NULL,
  'procurement-supplier-kyc',
  'Cadastro de Fornecedor (KYC/KYB)',
  'Template para onboarding completo de fornecedores com KYC/KYB e integração com ERP.',
  'procurement',
  '🛒',
  '["fornecedor", "kyc", "kyb", "compras"]',
  'public',
  '{
    "steps": [
      {
        "id": "documentation",
        "name": "Documentação",
        "type": "upload",
        "order": 1,
        "required": true,
        "config": {
          "required": ["CNPJ", "Contrato Social", "Certidões"]
        }
      },
      {
        "id": "receita-check",
        "name": "Consulta Receita",
        "type": "integration",
        "order": 2,
        "required": true,
        "config": {
          "api": "receita_ws"
        }
      },
      {
        "id": "risk-scoring",
        "name": "Score de Risco",
        "type": "ai_analysis",
        "order": 3,
        "required": true,
        "config": {
          "model": "risk_scoring"
        }
      },
      {
        "id": "compliance-approval",
        "name": "Aprovação Compliance",
        "type": "approval",
        "order": 4,
        "required": true,
        "config": {
          "sla": "48h"
        }
      },
      {
        "id": "master-contract",
        "name": "Contrato Master",
        "type": "signature",
        "order": 5,
        "required": true,
        "config": {}
      },
      {
        "id": "erp-activation",
        "name": "Ativação no ERP",
        "type": "webhook",
        "order": 6,
        "required": false,
        "config": {
          "target": "erp_system"
        }
      }
    ],
    "automations": [],
    "integrations": [],
    "notifications": []
  }',
  '[
    {"id": "razao_social", "name": "razao_social", "label": "Razão Social", "type": "text", "required": true},
    {"id": "cnpj", "name": "cnpj", "label": "CNPJ", "type": "text", "required": true, "validation": {"format": "cnpj"}}
  ]',
  '[
    {"id": "cnpj-valid", "name": "CNPJ Válido", "type": "format", "field": "cnpj", "config": {"format": "cnpj"}, "errorMessage": "CNPJ inválido", "severity": "error"}
  ]',
  'demo-tenant-uuid',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
-- Financeiro - Processamento Fiscal
(
  'finance-accounts-payable',
  NULL,
  'finance-accounts-payable', 
  'Contas a Pagar Inteligente',
  'Processamento automático de notas fiscais e boletos com validação fiscal e integração ERP.',
  'finance',
  '💰',
  '["financeiro", "nfe", "boleto", "contas-pagar"]',
  'public',
  '{
    "steps": [
      {
        "id": "upload-fiscal",
        "name": "Upload NFe/Boleto",
        "type": "upload",
        "order": 1,
        "required": true,
        "config": {
          "formats": ["pdf", "xml"]
        }
      },
      {
        "id": "ocr-extraction",
        "name": "OCR e Extração",
        "type": "ocr",
        "order": 2,
        "required": true,
        "config": {
          "confidence": 0.95
        }
      },
      {
        "id": "fiscal-validation",
        "name": "Validação Fiscal",
        "type": "validation",
        "order": 3,
        "required": true,
        "config": {
          "rules": ["cnpj", "valor", "vencimento"]
        }
      },
      {
        "id": "payment-approval",
        "name": "Aprovação Pagamento",
        "type": "approval",
        "order": 4,
        "required": true,
        "config": {
          "matrix": "by_value"
        }
      },
      {
        "id": "erp-integration",
        "name": "Integração ERP",
        "type": "webhook",
        "order": 5,
        "required": true,
        "config": {}
      },
      {
        "id": "cnab-export",
        "name": "Arquivo CNAB",
        "type": "package",
        "order": 6,
        "required": false,
        "config": {
          "format": "cnab240"
        }
      }
    ],
    "automations": [],
    "integrations": [],
    "notifications": []
  }',
  '[
    {"id": "valor", "name": "valor", "label": "Valor", "type": "number", "required": true},
    {"id": "vencimento", "name": "vencimento", "label": "Data de Vencimento", "type": "date", "required": true},
    {"id": "fornecedor_cnpj", "name": "fornecedor_cnpj", "label": "CNPJ Fornecedor", "type": "text", "required": true}
  ]',
  '[]',
  'demo-tenant-uuid',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Migration complete
SELECT 'Template system created successfully' as status;