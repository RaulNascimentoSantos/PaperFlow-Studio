import { FastifyPluginAsync } from 'fastify';
import { WhatsAppIntegration } from '../services/whatsapp-integration';
import { ESignatureService } from '../services/esignature-service';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

const webhookRoutes: FastifyPluginAsync = async function (fastify) {
  const db = new DatabaseService();
  const whatsappService = new WhatsAppIntegration(db);
  const esignatureService = new ESignatureService(db);

  // WhatsApp webhook handler
  fastify.get('/whatsapp', {
    schema: {
      description: 'WhatsApp webhook verification',
      tags: ['Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          'hub.mode': { type: 'string' },
          'hub.verify_token': { type: 'string' },
          'hub.challenge': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const mode = query['hub.mode'];
      const token = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
          console.log('📱 WhatsApp webhook verified');
          reply.status(200).send(challenge);
        } else {
          reply.status(403).send('Forbidden');
        }
      } else {
        reply.status(400).send('Bad Request');
      }
    } catch (error) {
      console.error('Error verifying WhatsApp webhook:', error);
      reply.status(500).send('Internal Server Error');
    }
  });

  fastify.post('/whatsapp', {
    schema: {
      description: 'WhatsApp webhook handler',
      tags: ['Webhooks'],
      body: {
        type: 'object',
        properties: {
          object: { type: 'string' },
          entry: { type: 'array' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const payload = request.body as any;

      if (payload.object === 'whatsapp_business_account') {
        await whatsappService.handleWebhook(payload);
        reply.status(200).send('EVENT_RECEIVED');
      } else {
        reply.status(404).send('Not Found');
      }
    } catch (error) {
      console.error('Error handling WhatsApp webhook:', error);
      reply.status(500).send('Internal Server Error');
    }
  });

  // E-signature webhook handler (with tenant ID in path for security)
  fastify.post<{
    Params: { tenantId: string };
    Body: any;
  }>('/signature-callback/:tenantId', {
    schema: {
      description: 'E-signature webhook handler',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' }
        }
      },
      body: { type: 'object' }
    }
  }, async (request, reply) => {
    try {
      const { tenantId } = request.params;
      const payload = request.body;

      console.log(`✍️ E-signature webhook received for tenant ${tenantId}:`, JSON.stringify(payload, null, 2));

      // Validate webhook signature if provider supports it
      const signature = request.headers['x-signature'] as string;
      if (signature) {
        // In production, verify signature based on provider
        console.log('✍️ Webhook signature:', signature);
      }

      await esignatureService.handleWebhook(payload, tenantId);
      
      reply.status(200).send({ success: true });
    } catch (error) {
      console.error('Error handling e-signature webhook:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Generic signature callback (for backwards compatibility)
  fastify.post('/signature-callback', {
    schema: {
      description: 'Generic e-signature webhook handler',
      tags: ['Webhooks'],
      body: { type: 'object' }
    }
  }, async (request, reply) => {
    try {
      const payload = request.body as any;
      
      // Try to extract tenant ID from payload or headers
      const tenantId = payload.tenant_id || 
                      payload.metadata?.tenant_id || 
                      request.headers['x-tenant-id'];

      if (!tenantId) {
        console.warn('E-signature webhook received without tenant ID');
        reply.status(400).send({ error: 'Tenant ID required' });
        return;
      }

      await esignatureService.handleWebhook(payload, tenantId as string);
      
      reply.status(200).send({ success: true });
    } catch (error) {
      console.error('Error handling generic signature webhook:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Stripe webhook handler
  fastify.post('/stripe', {
    schema: {
      description: 'Stripe webhook handler',
      tags: ['Webhooks'],
    },
  }, async () => {
    return {
      success: true,
      message: 'Webhook received - implementation in progress'
    };
  });
};

export default webhookRoutes;
