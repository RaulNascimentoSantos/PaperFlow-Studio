import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WhatsAppIntegration } from '../services/whatsapp-integration';
import { ESignatureService } from '../services/esignature-service';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

interface IntegrationRouteContext {
  tenantId: string;
}

interface WhatsAppNotificationBody {
  phoneNumber: string;
  template: string;
  parameters: Record<string, any>;
  documentId?: string;
}

interface WhatsAppDocumentBody {
  phoneNumber: string;
  documentId: string;
}

interface SignatureRequestBody {
  documentId: string;
  signers: Array<{
    email: string;
    name: string;
    phone?: string;
    cpf?: string;
    role: 'signer' | 'approver' | 'witness' | 'carbon_copy';
    requireSms?: boolean;
    order?: number;
  }>;
  options?: {
    deadlineDays?: number;
    autoClose?: boolean;
    sequenceEnabled?: boolean;
    message?: string;
  };
}

export default async function integrationsRoutes(fastify: FastifyInstance) {
  const db = new DatabaseService();
  const whatsappService = new WhatsAppIntegration(db);
  const esignatureService = new ESignatureService(db);

  // WhatsApp Routes

  // Send WhatsApp notification
  fastify.post<{
    Body: WhatsAppNotificationBody;
  }>('/whatsapp/send', {
    schema: {
      description: 'Send WhatsApp notification',
      tags: ['Integrations'],
      body: {
        type: 'object',
        required: ['phoneNumber', 'template', 'parameters'],
        properties: {
          phoneNumber: { type: 'string' },
          template: { type: 'string' },
          parameters: { type: 'object' },
          documentId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: WhatsAppNotificationBody }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { phoneNumber, template, parameters, documentId } = request.body;

      await whatsappService.sendNotification({
        tenantId: tenantContext.tenantId,
        phoneNumber,
        template,
        parameters,
        documentId
      });

      reply.send({
        success: true,
        message: 'WhatsApp notification sent successfully'
      });

    } catch (error) {
      request.log.error(error, 'Error sending WhatsApp notification');
      throw error;
    }
  });

  // Send document via WhatsApp
  fastify.post<{
    Body: WhatsAppDocumentBody;
  }>('/whatsapp/send-document', {
    schema: {
      description: 'Send document via WhatsApp',
      tags: ['Integrations'],
      body: {
        type: 'object',
        required: ['phoneNumber', 'documentId'],
        properties: {
          phoneNumber: { type: 'string' },
          documentId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: WhatsAppDocumentBody }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { phoneNumber, documentId } = request.body;

      // Get document details
      const docResult = await db.query(`
        SELECT original_name, s3_key 
        FROM documents 
        WHERE id = $1 AND tenant_id = $2
      `, [documentId, tenantContext.tenantId]);

      if (docResult.rows.length === 0) {
        throw createError.notFound('Document not found');
      }

      const document = docResult.rows[0];
      const downloadUrl = `${process.env.API_URL || 'http://localhost:3002'}/v1/documents/${documentId}/download`;

      await whatsappService.sendDocumentNotification(
        tenantContext.tenantId,
        phoneNumber,
        documentId,
        document.original_name,
        downloadUrl
      );

      reply.send({
        success: true,
        message: 'Document sent via WhatsApp successfully'
      });

    } catch (error) {
      request.log.error(error, 'Error sending document via WhatsApp');
      throw error;
    }
  });

  // Get WhatsApp notification templates
  fastify.get('/whatsapp/templates', {
    schema: {
      description: 'Get WhatsApp notification templates',
      tags: ['Integrations'],
      response: {
        200: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  template: { type: 'string' },
                  variables: { type: 'array', items: { type: 'string' } },
                  category: { type: 'string' },
                  language: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const templates = await whatsappService.getNotificationTemplates(tenantContext.tenantId);

      reply.send({ templates });

    } catch (error) {
      request.log.error(error, 'Error getting WhatsApp templates');
      throw error;
    }
  });

  // Get WhatsApp notification history
  fastify.get('/whatsapp/history', {
    schema: {
      description: 'Get WhatsApp notification history',
      tags: ['Integrations'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: { type: 'array' },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { limit?: number; offset?: number }
  }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { limit = 50, offset = 0 } = request.query;

      const history = await whatsappService.getNotificationHistory(
        tenantContext.tenantId,
        limit,
        offset
      );

      reply.send(history);

    } catch (error) {
      request.log.error(error, 'Error getting WhatsApp history');
      throw error;
    }
  });

  // E-Signature Routes

  // Send document for signature
  fastify.post<{
    Body: SignatureRequestBody;
  }>('/esignature/send', {
    schema: {
      description: 'Send document for e-signature',
      tags: ['Integrations'],
      body: {
        type: 'object',
        required: ['documentId', 'signers'],
        properties: {
          documentId: { type: 'string', format: 'uuid' },
          signers: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['email', 'name', 'role'],
              properties: {
                email: { type: 'string', format: 'email' },
                name: { type: 'string' },
                phone: { type: 'string' },
                cpf: { type: 'string' },
                role: { 
                  type: 'string', 
                  enum: ['signer', 'approver', 'witness', 'carbon_copy'] 
                },
                requireSms: { type: 'boolean' },
                order: { type: 'number' }
              }
            }
          },
          options: {
            type: 'object',
            properties: {
              deadlineDays: { type: 'number', minimum: 1, maximum: 365 },
              autoClose: { type: 'boolean' },
              sequenceEnabled: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            documentUrl: { type: 'string' },
            status: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            signers: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: SignatureRequestBody }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { documentId, signers, options = {} } = request.body;

      const signatureRequest = await esignatureService.sendForSignature(
        tenantContext.tenantId,
        documentId,
        signers,
        options
      );

      reply.status(201).send({
        requestId: signatureRequest.requestId,
        documentUrl: signatureRequest.documentUrl,
        status: signatureRequest.status,
        expiresAt: signatureRequest.expiresAt.toISOString(),
        signers: signatureRequest.signers
      });

    } catch (error) {
      request.log.error(error, 'Error sending document for signature');
      throw error;
    }
  });

  // Get signature request status
  fastify.get<{
    Params: { requestId: string };
  }>('/esignature/status/:requestId', {
    schema: {
      description: 'Get signature request status',
      tags: ['Integrations'],
      params: {
        type: 'object',
        required: ['requestId'],
        properties: {
          requestId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            documentId: { type: 'string' },
            status: { type: 'string' },
            signers: { type: 'array' },
            documentUrl: { type: 'string' },
            signedDocumentUrl: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { requestId } = request.params;

      const signatureRequest = await esignatureService.getSignatureStatus(
        requestId,
        tenantContext.tenantId
      );

      if (!signatureRequest) {
        throw createError.notFound('Signature request not found');
      }

      reply.send({
        requestId: signatureRequest.requestId,
        documentId: signatureRequest.documentId,
        status: signatureRequest.status,
        signers: signatureRequest.signers,
        documentUrl: signatureRequest.documentUrl,
        signedDocumentUrl: signatureRequest.signedDocumentUrl,
        createdAt: signatureRequest.createdAt.toISOString(),
        expiresAt: signatureRequest.expiresAt.toISOString(),
        completedAt: signatureRequest.completedAt?.toISOString()
      });

    } catch (error) {
      request.log.error(error, 'Error getting signature status');
      throw error;
    }
  });

  // List signature requests
  fastify.get('/esignature/requests', {
    schema: {
      description: 'List signature requests',
      tags: ['Integrations'],
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['pending', 'signed', 'refused', 'canceled', 'expired']
          },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            requests: { type: 'array' },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { status?: string; limit?: number; offset?: number }
  }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { status, limit = 50, offset = 0 } = request.query;

      const result = await esignatureService.getSignatureRequests(
        tenantContext.tenantId,
        { status, limit, offset }
      );

      reply.send(result);

    } catch (error) {
      request.log.error(error, 'Error listing signature requests');
      throw error;
    }
  });

  // Integration configuration endpoint
  fastify.get('/config', {
    schema: {
      description: 'Get integration configuration',
      tags: ['Integrations'],
      response: {
        200: {
          type: 'object',
          properties: {
            whatsapp: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                configured: { type: 'boolean' }
              }
            },
            esignature: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                provider: { type: 'string' },
                configured: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as IntegrationRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const result = await db.query(`
        SELECT integration_config 
        FROM tenants 
        WHERE id = $1
      `, [tenantContext.tenantId]);

      let config = {};
      if (result.rows.length > 0 && result.rows[0].integration_config) {
        config = typeof result.rows[0].integration_config === 'string'
          ? JSON.parse(result.rows[0].integration_config)
          : result.rows[0].integration_config;
      }

      reply.send({
        whatsapp: {
          enabled: config.whatsapp?.enabled || false,
          configured: !!(config.whatsapp?.accessToken && config.whatsapp?.phoneNumberId)
        },
        esignature: {
          enabled: config.esignature?.enabled || false,
          provider: config.esignature?.provider?.name || null,
          configured: !!(config.esignature?.provider?.apiKey)
        }
      });

    } catch (error) {
      request.log.error(error, 'Error getting integration config');
      throw error;
    }
  });
}