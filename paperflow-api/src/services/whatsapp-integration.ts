import { 
  WhatsAppMessage, 
  WhatsAppNotificationConfig, 
  WhatsAppWebhookEvent,
  IntegrationAuditLog,
  IntegrationConfig 
} from '../types/integrations';
import { DatabaseService } from './database';
import { createError } from '../utils/errors';

export class WhatsAppIntegration {
  constructor(private db: DatabaseService) {}

  async sendNotification(config: WhatsAppNotificationConfig): Promise<void> {
    try {
      // Get tenant's WhatsApp configuration
      const integrationConfig = await this.getIntegrationConfig(config.tenantId);
      
      if (!integrationConfig?.whatsapp?.enabled) {
        throw createError.badRequest('WhatsApp integration not enabled for this tenant');
      }

      // Validate and format phone number (Brazilian format)
      const formattedNumber = this.formatBrazilianNumber(config.phoneNumber);
      
      // Build WhatsApp message
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'template',
        template: {
          name: config.template,
          language: { code: 'pt_BR' },
          components: this.buildTemplateComponents(config.parameters)
        }
      };

      // Send message via WhatsApp Business API
      await this.sendWhatsAppMessage(message, integrationConfig);

      // Log successful notification
      await this.logIntegrationEvent({
        tenantId: config.tenantId,
        type: 'whatsapp_notification',
        action: 'message_sent',
        resourceId: config.documentId,
        userId: config.userId,
        recipient: formattedNumber,
        template: config.template,
        status: 'success',
        details: {
          parameters: config.parameters,
          message
        }
      });

    } catch (error) {
      // Log failed notification
      await this.logIntegrationEvent({
        tenantId: config.tenantId,
        type: 'whatsapp_notification',
        action: 'message_failed',
        resourceId: config.documentId,
        userId: config.userId,
        recipient: config.phoneNumber,
        template: config.template,
        status: 'failed',
        details: { parameters: config.parameters },
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async sendDocumentNotification(
    tenantId: string,
    phoneNumber: string,
    documentId: string,
    documentName: string,
    downloadUrl: string
  ): Promise<void> {
    try {
      const integrationConfig = await this.getIntegrationConfig(tenantId);
      
      if (!integrationConfig?.whatsapp?.enabled) {
        throw createError.badRequest('WhatsApp integration not enabled');
      }

      const formattedNumber = this.formatBrazilianNumber(phoneNumber);
      
      // Send document via WhatsApp
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'document',
        document: {
          link: downloadUrl,
          filename: documentName
        }
      };

      await this.sendWhatsAppMessage(message, integrationConfig);

      await this.logIntegrationEvent({
        tenantId,
        type: 'whatsapp_notification',
        action: 'document_sent',
        resourceId: documentId,
        recipient: formattedNumber,
        status: 'success',
        details: {
          documentName,
          downloadUrl
        }
      });

    } catch (error) {
      console.error('Error sending WhatsApp document:', error);
      throw error;
    }
  }

  private formatBrazilianNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    // Validate Brazilian phone number format
    const brazilianPhoneRegex = /^55\d{10,11}$/;
    if (!brazilianPhoneRegex.test(cleaned)) {
      throw createError.badRequest('Invalid Brazilian phone number format');
    }
    
    return cleaned;
  }

  private buildTemplateComponents(parameters: Record<string, any>) {
    if (!parameters || Object.keys(parameters).length === 0) {
      return [];
    }

    return [
      {
        type: 'body' as const,
        parameters: Object.values(parameters).map(value => ({
          type: 'text' as const,
          text: String(value)
        }))
      }
    ];
  }

  private async sendWhatsAppMessage(
    message: WhatsAppMessage, 
    config: IntegrationConfig
  ): Promise<void> {
    // Mock WhatsApp API call for development
    // In production, this would call the actual WhatsApp Business API
    
    console.log('📱 Sending WhatsApp message:', {
      to: message.to,
      type: message.type,
      template: message.template?.name || 'N/A'
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock success response
    const mockResponse = {
      messaging_product: 'whatsapp',
      messages: [
        {
          id: `wamid.${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'accepted'
        }
      ]
    };

    console.log('📱 WhatsApp API Response:', mockResponse);
  }

  async handleWebhook(payload: WhatsAppWebhookEvent): Promise<void> {
    try {
      console.log('📱 WhatsApp webhook received:', JSON.stringify(payload, null, 2));

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          // Handle incoming messages
          if (change.value.messages) {
            for (const message of change.value.messages) {
              await this.handleIncomingMessage(message, change.value.metadata);
            }
          }

          // Handle message status updates
          if (change.value.statuses) {
            for (const status of change.value.statuses) {
              await this.handleStatusUpdate(status, change.value.metadata);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling WhatsApp webhook:', error);
      throw error;
    }
  }

  private async handleIncomingMessage(message: any, metadata: any): Promise<void> {
    console.log('📱 Incoming WhatsApp message:', {
      from: message.from,
      type: message.type,
      text: message.text?.body
    });

    // Auto-reply logic could be implemented here
    // For now, just log the message
  }

  private async handleStatusUpdate(status: any, metadata: any): Promise<void> {
    console.log('📱 WhatsApp status update:', {
      messageId: status.id,
      status: status.status,
      recipient: status.recipient_id
    });

    // Update message status in database
    try {
      await this.db.query(`
        UPDATE integration_audit_log 
        SET 
          status = $1,
          details = jsonb_set(details, '{whatsapp_status}', $2::jsonb),
          processed_at = NOW()
        WHERE details->>'whatsapp_message_id' = $3
      `, [
        status.status === 'delivered' || status.status === 'read' ? 'success' : status.status,
        JSON.stringify({ status: status.status, timestamp: status.timestamp }),
        status.id
      ]);
    } catch (error) {
      console.error('Error updating WhatsApp message status:', error);
    }
  }

  async getNotificationTemplates(tenantId: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT id, name, template, variables, category, language
        FROM notification_templates
        WHERE tenant_id = $1 AND type = 'whatsapp' AND active = true
        ORDER BY category, name
      `, [tenantId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting notification templates:', error);
      return [];
    }
  }

  async createNotificationTemplate(
    tenantId: string,
    template: {
      name: string;
      template: string;
      variables: string[];
      category: string;
      language?: string;
    }
  ): Promise<string> {
    try {
      const result = await this.db.query(`
        INSERT INTO notification_templates (
          id, tenant_id, name, type, template, variables, category, language, active, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'whatsapp', $3, $4, $5, $6, true, NOW()
        ) RETURNING id
      `, [
        tenantId,
        template.name,
        template.template,
        JSON.stringify(template.variables),
        template.category,
        template.language || 'pt_BR'
      ]);

      return result.rows[0].id;
    } catch (error) {
      console.error('Error creating notification template:', error);
      throw createError.internalError('Failed to create notification template');
    }
  }

  private async getIntegrationConfig(tenantId: string): Promise<IntegrationConfig | null> {
    try {
      const result = await this.db.query(`
        SELECT integration_config 
        FROM tenants 
        WHERE id = $1 AND deleted_at IS NULL
      `, [tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0].integration_config;
      return typeof config === 'string' ? JSON.parse(config) : config;
    } catch (error) {
      console.error('Error getting integration config:', error);
      return null;
    }
  }

  private async logIntegrationEvent(event: Omit<IntegrationAuditLog, 'id' | 'createdAt' | 'processedAt'>): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO integration_audit_log (
          id, tenant_id, type, action, resource_id, user_id, recipient, template, 
          status, details, error, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
        )
      `, [
        event.tenantId,
        event.type,
        event.action,
        event.resourceId,
        event.userId,
        event.recipient,
        event.template,
        event.status,
        JSON.stringify(event.details),
        event.error
      ]);
    } catch (error) {
      console.error('Error logging integration event:', error);
      // Don't throw here to avoid breaking the main flow
    }
  }

  async getNotificationHistory(
    tenantId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    notifications: IntegrationAuditLog[];
    total: number;
  }> {
    try {
      const countResult = await this.db.query(`
        SELECT COUNT(*) as total
        FROM integration_audit_log
        WHERE tenant_id = $1 AND type = 'whatsapp_notification'
      `, [tenantId]);

      const result = await this.db.query(`
        SELECT *
        FROM integration_audit_log
        WHERE tenant_id = $1 AND type = 'whatsapp_notification'
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [tenantId, limit, offset]);

      return {
        notifications: result.rows.map(row => ({
          id: row.id,
          tenantId: row.tenant_id,
          type: row.type,
          action: row.action,
          resourceId: row.resource_id,
          userId: row.user_id,
          recipient: row.recipient,
          template: row.template,
          status: row.status,
          details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
          error: row.error,
          createdAt: new Date(row.created_at),
          processedAt: row.processed_at ? new Date(row.processed_at) : undefined
        })),
        total: parseInt(countResult.rows[0]?.total || '0')
      };
    } catch (error) {
      console.error('Error getting notification history:', error);
      return { notifications: [], total: 0 };
    }
  }

  // Utility method to verify webhook signature
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}