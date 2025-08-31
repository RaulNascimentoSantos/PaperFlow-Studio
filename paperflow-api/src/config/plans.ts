export interface PlanLimits {
  documents: number;
  users: number;
  templates: number;
  webhooks: number;
  storageGB: number;
  apiCallsPerMinute: number;
}

export interface PlanFeatures {
  webhooksEnabled: boolean;
  whatsappEnabled: boolean;
  ssoEnabled: boolean;
  customBranding: boolean;
  advancedAudit: boolean;
  multiRegion: boolean;
  dedicatedSupport: boolean;
  customDomain: boolean;
  prioritySupport: boolean;
  advancedIntegrations: boolean;
}

export interface PlanConfig {
  limits: PlanLimits;
  features: PlanFeatures;
  price: {
    BRL: number | 'custom';
    USD: number | 'custom';
    EUR: number | 'custom';
  };
  billingCycle: 'monthly' | 'annual';
  overage: {
    allowed: boolean;
    pricing?: {
      documentsPerUnit: number;
      pricePerUnit: {
        BRL: number;
        USD: number;
        EUR: number;
      };
    };
  };
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    limits: {
      documents: 10,
      users: 1,
      templates: 1,
      webhooks: 0,
      storageGB: 0.5,
      apiCallsPerMinute: 10,
    },
    features: {
      webhooksEnabled: false,
      whatsappEnabled: false,
      ssoEnabled: false,
      customBranding: false,
      advancedAudit: false,
      multiRegion: false,
      dedicatedSupport: false,
      customDomain: false,
      prioritySupport: false,
      advancedIntegrations: false,
    },
    price: { BRL: 0, USD: 0, EUR: 0 },
    billingCycle: 'monthly',
    overage: {
      allowed: false,
    },
  },

  pro: {
    limits: {
      documents: 300,
      users: 5,
      templates: 5,
      webhooks: 3,
      storageGB: 10,
      apiCallsPerMinute: 60,
    },
    features: {
      webhooksEnabled: true,
      whatsappEnabled: true,
      ssoEnabled: false,
      customBranding: false,
      advancedAudit: true,
      multiRegion: false,
      dedicatedSupport: false,
      customDomain: false,
      prioritySupport: true,
      advancedIntegrations: true,
    },
    price: { BRL: 79, USD: 19, EUR: 17 },
    billingCycle: 'monthly',
    overage: {
      allowed: true,
      pricing: {
        documentsPerUnit: 50,
        pricePerUnit: { BRL: 15, USD: 4, EUR: 3.5 },
      },
    },
  },

  business: {
    limits: {
      documents: 3000,
      users: 25,
      templates: 20,
      webhooks: 10,
      storageGB: 100,
      apiCallsPerMinute: 300,
    },
    features: {
      webhooksEnabled: true,
      whatsappEnabled: true,
      ssoEnabled: true,
      customBranding: true,
      advancedAudit: true,
      multiRegion: false,
      dedicatedSupport: false,
      customDomain: true,
      prioritySupport: true,
      advancedIntegrations: true,
    },
    price: { BRL: 399, USD: 89, EUR: 79 },
    billingCycle: 'monthly',
    overage: {
      allowed: true,
      pricing: {
        documentsPerUnit: 100,
        pricePerUnit: { BRL: 25, USD: 6, EUR: 5.5 },
      },
    },
  },

  enterprise: {
    limits: {
      documents: -1, // unlimited
      users: -1,
      templates: -1,
      webhooks: -1,
      storageGB: -1,
      apiCallsPerMinute: -1,
    },
    features: {
      webhooksEnabled: true,
      whatsappEnabled: true,
      ssoEnabled: true,
      customBranding: true,
      advancedAudit: true,
      multiRegion: true,
      dedicatedSupport: true,
      customDomain: true,
      prioritySupport: true,
      advancedIntegrations: true,
    },
    price: { BRL: 'custom', USD: 'custom', EUR: 'custom' },
    billingCycle: 'annual',
    overage: {
      allowed: true,
    },
  },
};

export function getPlanConfig(planName: string): PlanConfig | null {
  return PLANS[planName] || null;
}

export function getPlanLimit(planName: string, resource: keyof PlanLimits): number {
  const plan = getPlanConfig(planName);
  if (!plan) return 0;
  
  const limit = plan.limits[resource];
  return limit === -1 ? Number.MAX_SAFE_INTEGER : limit;
}

export function hasPlanFeature(planName: string, feature: keyof PlanFeatures): boolean {
  const plan = getPlanConfig(planName);
  return plan ? plan.features[feature] : false;
}

export function getOveragePricing(planName: string, currency: 'BRL' | 'USD' | 'EUR'): number | null {
  const plan = getPlanConfig(planName);
  if (!plan?.overage.allowed || !plan.overage.pricing) return null;
  
  return plan.overage.pricing.pricePerUnit[currency];
}