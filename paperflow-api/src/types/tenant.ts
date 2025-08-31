export interface TenantContext {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: 'free' | 'pro' | 'business' | 'enterprise';
  quotas: {
    maxDocuments: number;
    maxUsers: number;
    maxTemplates: number;
    maxWebhooks: number;
    maxStorageGB: number;
    currentUsage: {
      documents: number;
      users: number;
      templates: number;
      webhooks: number;
      storageGB: number;
    };
  };
  features: {
    webhooksEnabled: boolean;
    whatsappEnabled: boolean;
    ssoEnabled: boolean;
    customBranding: boolean;
    advancedAudit: boolean;
    multiRegion: boolean;
    dedicatedSupport: boolean;
  };
  billing: {
    subscriptionId?: string;
    customerId?: string;
    nextBillingDate?: Date;
    paymentMethod?: 'pix' | 'credit_card' | 'boleto' | 'invoice';
    allowOverage?: boolean;
  };
  settings: {
    timezone: string;
    locale: string;
    currency: 'BRL' | 'USD' | 'EUR';
    dateFormat: string;
  };
  status: 'active' | 'suspended' | 'deleted';
  customDomain?: string;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  deletedAt?: Date;
}

export interface TenantUsageMetrics {
  tenantId: string;
  metricName: string;
  value: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan?: 'free' | 'pro' | 'business' | 'enterprise';
  customDomain?: string;
  settings?: Partial<TenantContext['settings']>;
  adminUser: {
    name: string;
    email: string;
    password: string;
  };
}

export interface UpdateTenantRequest {
  name?: string;
  plan?: 'free' | 'pro' | 'business' | 'enterprise';
  customDomain?: string;
  settings?: Partial<TenantContext['settings']>;
  status?: 'active' | 'suspended';
}

export interface TenantQuotaCheck {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
  tenantId: string;
  overageAllowed: boolean;
}

// Tipos para middleware
declare global {
  namespace Fastify {
    interface FastifyRequest {
      tenant: TenantContext;
    }
  }
}