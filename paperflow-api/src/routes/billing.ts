import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BillingHooksService } from '../services/billing-hooks';
import { QuotaManager } from '../services/quota-manager';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

interface BillingRouteContext {
  tenantId: string;
}

interface UsageRequestBody {
  resource: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  cost?: number;
  currency?: string;
}

interface ReportQueryParams {
  periodStart: string;
  periodEnd: string;
}

interface InvoiceRequestBody {
  periodStart: string;
  periodEnd: string;
}

export default async function billingRoutes(fastify: FastifyInstance) {
  // Initialize services
  const db = new DatabaseService();
  const quotaManager = new QuotaManager(db);
  const billingHooks = new BillingHooksService(db, quotaManager);

  // Record usage endpoint
  fastify.post<{
    Body: UsageRequestBody;
  }>('/usage', {
    schema: {
      description: 'Record usage for billing calculation',
      tags: ['billing'],
      body: {
        type: 'object',
        required: ['resource', 'amount', 'periodStart', 'periodEnd'],
        properties: {
          resource: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' },
          cost: { type: 'number', minimum: 0 },
          currency: { type: 'string', enum: ['BRL', 'USD', 'EUR'] }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: UsageRequestBody }>, reply: FastifyReply) => {
    try {
      if (!request.tenant?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }
      
      const tenantId = request.tenant.tenantId;

      const { resource, amount, periodStart, periodEnd, cost, currency } = request.body;

      await billingHooks.recordUsage({
        tenantId: tenantId,
        resource,
        amount,
        cost,
        currency,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      });

      reply.status(201).send({
        success: true,
        message: 'Usage recorded successfully'
      });

    } catch (error) {
      request.log.error(error, 'Error recording usage');
      throw error;
    }
  });

  // Get billing report endpoint
  fastify.get<{
    Querystring: ReportQueryParams;
  }>('/report', {
    schema: {
      description: 'Generate billing report for tenant',
      tags: ['billing'],
      querystring: {
        type: 'object',
        required: ['periodStart', 'periodEnd'],
        properties: {
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tenant: {
              type: 'object',
              properties: {
                tenantId: { type: 'string' },
                tenantName: { type: 'string' },
                plan: { type: 'string' }
              }
            },
            usage: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  resource: { type: 'string' },
                  amount: { type: 'number' },
                  cost: { type: 'number' },
                  currency: { type: 'string' }
                }
              }
            },
            overages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  resource: { type: 'string' },
                  amount: { type: 'number' },
                  totalCost: { type: 'number' },
                  currency: { type: 'string' }
                }
              }
            },
            totalCost: { type: 'number' },
            currency: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: ReportQueryParams }>, reply: FastifyReply) => {
    try {
      if (!request.tenant?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }
      
      const tenantId = request.tenant.tenantId;

      const { periodStart, periodEnd } = request.query;

      const report = await billingHooks.generateBillingReport(
        tenantId,
        new Date(periodStart),
        new Date(periodEnd)
      );

      reply.send(report);

    } catch (error) {
      request.log.error(error, 'Error generating billing report');
      throw error;
    }
  });

  // Create invoice endpoint
  fastify.post<{
    Body: InvoiceRequestBody;
  }>('/invoice', {
    schema: {
      description: 'Create invoice for billing period',
      tags: ['billing'],
      body: {
        type: 'object',
        required: ['periodStart', 'periodEnd'],
        properties: {
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string' },
            total: { type: 'number' },
            currency: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
            status: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: InvoiceRequestBody }>, reply: FastifyReply) => {
    try {
      if (!request.tenant?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }
      
      const tenantId = request.tenant.tenantId;

      const { periodStart, periodEnd } = request.body;

      const invoice = await billingHooks.createInvoice(
        tenantId,
        new Date(periodStart),
        new Date(periodEnd)
      );

      reply.status(201).send({
        invoiceId: invoice.invoiceId,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: 'pending'
      });

    } catch (error) {
      request.log.error(error, 'Error creating invoice');
      throw error;
    }
  });

  // Get current usage endpoint
  fastify.get('/usage/current', {
    schema: {
      description: 'Get current usage for tenant',
      tags: ['billing'],
      response: {
        200: {
          type: 'object',
          properties: {
            usage: {
              type: 'object',
              patternProperties: {
                ".*": { type: 'number' }
              }
            },
            quotas: {
              type: 'object',
              patternProperties: {
                ".*": { type: 'number' }
              }
            },
            overages: {
              type: 'object',
              patternProperties: {
                ".*": { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.tenant?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }
      
      const tenantId = request.tenant.tenantId;

      const usage = await quotaManager.getCurrentUsage(tenantId);
      const quotas = await quotaManager.getTenantQuotas(tenantId);

      // Calculate overages
      const overages: Record<string, number> = {};
      for (const [resource, currentUsage] of Object.entries(usage)) {
        const quota = quotas[resource] || 0;
        if (currentUsage > quota) {
          overages[resource] = currentUsage - quota;
        }
      }

      reply.send({
        usage,
        quotas,
        overages
      });

    } catch (error) {
      request.log.error(error, 'Error getting current usage');
      throw error;
    }
  });

  // Payment webhook endpoint
  fastify.post<{
    Params: { provider: string };
    Body: any;
  }>('/webhook/:provider', {
    schema: {
      description: 'Handle payment provider webhooks',
      tags: ['billing'],
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', enum: ['stripe', 'pagarme', 'paypal', 'mercadopago'] }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { provider: string }; Body: any }>, reply: FastifyReply) => {
    try {
      const { provider } = request.params;
      const payload = request.body;

      await billingHooks.handlePaymentWebhook(provider, payload);

      reply.status(200).send({ success: true });

    } catch (error) {
      request.log.error(error, 'Error handling payment webhook');
      throw error;
    }
  });

  // Get billing events log
  fastify.get('/events', {
    schema: {
      description: 'Get billing events log for tenant',
      tags: ['billing'],
      querystring: {
        type: 'object',
        properties: {
          eventType: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  eventType: { type: 'string' },
                  eventData: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { eventType?: string; limit?: number; offset?: number } 
  }>, reply: FastifyReply) => {
    try {
      if (!request.tenant?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }
      
      const tenantId = request.tenant.tenantId;

      const { eventType, limit = 50, offset = 0 } = request.query;

      let query = `
        SELECT id, event_type, event_data, created_at, processed_at
        FROM billing_events_log 
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];

      if (eventType) {
        query += ` AND event_type = $${params.length + 1}`;
        params.push(eventType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM billing_events_log 
        WHERE tenant_id = $1
      `;
      const countParams = [tenantId];

      if (eventType) {
        countQuery += ` AND event_type = $2`;
        countParams.push(eventType);
      }

      const countResult = await db.query(countQuery, countParams);

      reply.send({
        events: result.rows.map(row => ({
          id: row.id,
          eventType: row.event_type,
          eventData: row.event_data,
          createdAt: row.created_at,
          processedAt: row.processed_at
        })),
        total: parseInt(countResult.rows[0]?.total || '0')
      });

    } catch (error) {
      request.log.error(error, 'Error getting billing events');
      throw error;
    }
  });
}