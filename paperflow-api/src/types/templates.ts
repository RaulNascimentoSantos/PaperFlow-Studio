export interface DocumentTemplate {
  id: string;
  tenantId?: string; // null = template global/público
  slug: string;
  name: string;
  description: string;
  category: 'hr' | 'finance' | 'legal' | 'compliance' | 'procurement' | 'sales';
  icon: string;
  tags: string[];
  visibility: 'private' | 'tenant' | 'public' | 'marketplace';
  
  // Configuração do workflow
  workflow: {
    steps: WorkflowStep[];
    automations: Automation[];
    integrations: Integration[];
    notifications: NotificationRule[];
  };
  
  // Campos e validações
  fields: TemplateField[];
  validations: ValidationRule[];
  
  // PII e compliance
  piiDetection: {
    enabled: boolean;
    patterns: string[];
    redactionStrategy: 'full' | 'partial' | 'custom';
  };
  
  // Métricas e KPIs
  metrics: {
    averageProcessingTime: number;
    successRate: number;
    usageCount: number;
    rating: number;
    reviews: number;
  };
  
  // Marketplace
  marketplace?: {
    price: number;
    currency: string;
    purchaseCount: number;
    revenue: number;
  };

  // Metadata
  version: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  deletedAt?: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'upload' | 'validation' | 'extraction' | 'approval' | 'signature' | 'package' | 'integration' | 'ai_analysis' | 'ocr' | 'webhook' | 'notification';
  order: number;
  required: boolean;
  config: Record<string, any>;
  conditions?: StepCondition[];
  retryPolicy?: RetryPolicy;
  timeout?: number; // milliseconds
  dependencies?: string[]; // IDs of other steps that must complete first
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'regex' | 'exists';
  value: any;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number; // milliseconds
  maxDelay?: number; // milliseconds
}

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  conditions?: StepCondition[];
}

export interface AutomationTrigger {
  type: 'step_completed' | 'step_failed' | 'document_uploaded' | 'approval_received' | 'time_based' | 'field_changed';
  config: Record<string, any>;
}

export interface AutomationAction {
  type: 'send_notification' | 'update_field' | 'trigger_webhook' | 'send_email' | 'send_whatsapp' | 'create_task' | 'escalate';
  config: Record<string, any>;
}

export interface Integration {
  id: string;
  name: string;
  type: 'webhook' | 'api' | 'email' | 'whatsapp' | 'erp' | 'crm' | 'signature_provider';
  config: IntegrationConfig;
  enabled: boolean;
  testMode?: boolean;
}

export interface IntegrationConfig {
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  authentication?: {
    type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
    config: Record<string, any>;
  };
  mapping?: FieldMapping[];
}

export interface FieldMapping {
  source: string;
  target: string;
  transform?: {
    type: 'format' | 'calculate' | 'lookup' | 'regex' | 'conditional';
    config: Record<string, any>;
  };
}

export interface NotificationRule {
  id: string;
  name: string;
  trigger: NotificationTrigger;
  recipients: NotificationRecipient[];
  template: NotificationTemplate;
  enabled: boolean;
}

export interface NotificationTrigger {
  type: 'immediate' | 'delayed' | 'scheduled' | 'conditional';
  config: Record<string, any>;
}

export interface NotificationRecipient {
  type: 'email' | 'whatsapp' | 'sms' | 'webhook';
  address: string;
  name?: string;
}

export interface NotificationTemplate {
  subject?: string;
  body: string;
  format: 'text' | 'html' | 'markdown';
  variables?: string[];
}

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'file' | 'email' | 'phone' | 'url' | 'json';
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
  description?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  extraction?: ExtractionConfig;
  display?: FieldDisplay;
}

export interface FieldOption {
  value: any;
  label: string;
  description?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'phone' | 'url' | 'date' | 'cpf' | 'cnpj' | 'rg';
  custom?: string; // JavaScript expression
}

export interface ExtractionConfig {
  enabled: boolean;
  strategy: 'ocr' | 'regex' | 'ai' | 'manual';
  patterns?: string[];
  confidence?: number;
  fallback?: 'manual' | 'default';
}

export interface FieldDisplay {
  width?: 'full' | 'half' | 'third' | 'quarter';
  order?: number;
  group?: string;
  conditional?: StepCondition[];
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'required' | 'format' | 'business_logic' | 'cross_field' | 'external_api';
  field?: string;
  config: Record<string, any>;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
}

// Template execution types
export interface TemplateExecution {
  id: string;
  templateId: string;
  tenantId: string;
  documentId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  stepResults: Record<string, StepResult>;
  data: Record<string, any>;
  errors: ExecutionError[];
  metrics: ExecutionMetrics;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface StepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  metrics?: {
    duration: number;
    attempts: number;
  };
}

export interface ExecutionError {
  stepId?: string;
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface ExecutionMetrics {
  totalDuration?: number;
  stepCount: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  retryCount: number;
}

// Template creation and update types
export interface CreateTemplateRequest {
  name: string;
  slug: string;
  description: string;
  category: DocumentTemplate['category'];
  icon?: string;
  tags?: string[];
  visibility?: DocumentTemplate['visibility'];
  workflow: Omit<DocumentTemplate['workflow'], 'automations' | 'integrations' | 'notifications'>;
  fields: Omit<TemplateField, 'id'>[];
  validations?: Omit<ValidationRule, 'id'>[];
  piiDetection?: DocumentTemplate['piiDetection'];
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: DocumentTemplate['category'];
  icon?: string;
  tags?: string[];
  visibility?: DocumentTemplate['visibility'];
  workflow?: Partial<DocumentTemplate['workflow']>;
  fields?: TemplateField[];
  validations?: ValidationRule[];
  piiDetection?: DocumentTemplate['piiDetection'];
}

// Template marketplace types
export interface TemplateMarketplaceFilter {
  category?: DocumentTemplate['category'];
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  search?: string;
  popular?: boolean;
  recent?: boolean;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  tenantId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateMarketplaceStats {
  totalTemplates: number;
  categories: Record<string, number>;
  avgRating: number;
  totalPurchases: number;
  totalRevenue: number;
  topTemplates: Array<{
    templateId: string;
    name: string;
    purchases: number;
    revenue: number;
    rating: number;
  }>;
}