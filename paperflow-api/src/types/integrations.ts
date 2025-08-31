// WhatsApp Integration Types
export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template' | 'text' | 'document';
  template?: WhatsAppTemplate;
  text?: { body: string };
  document?: { link: string; filename: string };
}

export interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: WhatsAppComponent[];
}

export interface WhatsAppComponent {
  type: 'body' | 'header' | 'footer' | 'button';
  parameters?: WhatsAppParameter[];
}

export interface WhatsAppParameter {
  type: 'text' | 'document' | 'image';
  text?: string;
  document?: { link: string; filename: string };
}

export interface WhatsAppNotificationConfig {
  phoneNumber: string;
  template: string;
  parameters: Record<string, any>;
  tenantId: string;
  documentId?: string;
  userId?: string;
}

export interface WhatsAppWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

// E-Signature Integration Types
export interface Signer {
  email: string;
  name: string;
  phone?: string;
  cpf?: string;
  role: 'signer' | 'approver' | 'witness' | 'carbon_copy';
  requireSms?: boolean;
  order?: number;
}

export interface SignatureRequest {
  requestId: string;
  documentId: string;
  tenantId: string;
  signers: SignerWithStatus[];
  documentUrl: string;
  signedDocumentUrl?: string;
  status: 'pending' | 'signed' | 'refused' | 'canceled' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface SignerWithStatus extends Signer {
  status: 'pending' | 'signed' | 'refused' | 'viewed';
  signedAt?: Date;
  refusedAt?: Date;
  refusalReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ESignatureProvider {
  name: 'clicksign' | 'd4sign' | 'docusign';
  apiKey: string;
  apiUrl: string;
  webhookSecret?: string;
}

export interface DocumentUploadResponse {
  document: {
    key: string;
    filename: string;
    uploads: {
      original: string;
    };
    downloads: {
      signed_file_url: string;
      original_file_url: string;
    };
    status: string;
    deadline_at: string;
  };
}

export interface SignatureWebhookEvent {
  event: {
    name: 'document.signed' | 'document.refused' | 'document.canceled' | 'document.deadline';
    occurred_at: string;
  };
  document: {
    key: string;
    filename: string;
    status: string;
    downloads: {
      signed_file_url?: string;
      original_file_url: string;
    };
    signers: Array<{
      email: string;
      name: string;
      status: string;
      signed_at?: string;
      refused_at?: string;
    }>;
  };
}

// Notification Templates
export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'whatsapp' | 'email' | 'sms';
  template: string;
  variables: string[];
  category: 'document_processed' | 'signature_request' | 'signature_completed' | 'approval_needed' | 'deadline_reminder';
  language: string;
  active: boolean;
}

// Integration Configuration
export interface IntegrationConfig {
  tenantId: string;
  whatsapp?: {
    enabled: boolean;
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    webhookVerifyToken: string;
    templates: NotificationTemplate[];
  };
  esignature?: {
    enabled: boolean;
    provider: ESignatureProvider;
    defaultDeadlineDays: number;
    autoReminders: boolean;
    templates: NotificationTemplate[];
  };
  notifications?: {
    channels: ('whatsapp' | 'email' | 'sms')[];
    events: {
      [eventType: string]: {
        enabled: boolean;
        channels: ('whatsapp' | 'email' | 'sms')[];
        template?: string;
      };
    };
  };
}

// Audit Log Types
export interface IntegrationAuditLog {
  id: string;
  tenantId: string;
  type: 'whatsapp_notification' | 'signature_request' | 'signature_completed' | 'webhook_received';
  action: string;
  resourceId?: string;
  userId?: string;
  recipient?: string;
  template?: string;
  status: 'success' | 'failed' | 'pending';
  details: Record<string, any>;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}