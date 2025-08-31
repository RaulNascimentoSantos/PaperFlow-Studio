import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProductMetricsService, MetricsQuery, HealthScore } from '../services/product-metrics';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

interface MetricsRouteContext {
  tenantId: string;
}

interface RecordMetricBody {
  eventType: string;
  userId?: string;
  metadata?: Record<string, any>;
  value?: number;
  currency?: string;
}

export default async function metricsRoutes(fastify: FastifyInstance) {
  const db = new DatabaseService();
  const metricsService = new ProductMetricsService(db);

  // Record a metrics event
  fastify.post<{
    Body: RecordMetricBody;
  }>('/record', {
    schema: {
      description: 'Record a product metrics event',
      tags: ['Metrics'],
      body: {
        type: 'object',
        required: ['eventType'],
        properties: {
          eventType: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          metadata: { type: 'object' },
          value: { type: 'number' },
          currency: { type: 'string', minLength: 3, maxLength: 3 }
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
  }, async (request: FastifyRequest<{ Body: RecordMetricBody }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as MetricsRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { eventType, userId, metadata, value, currency } = request.body;

      await metricsService.recordEvent({
        eventType,
        tenantId: tenantContext.tenantId,
        userId,
        metadata,
        value,
        currency
      });

      reply.status(201).send({
        success: true,
        message: 'Metrics event recorded successfully'
      });

    } catch (error) {
      request.log.error(error, 'Error recording metrics event');
      throw error;
    }
  });

  // Get AARRR metrics
  fastify.get('/aarrr', {
    schema: {
      description: 'Get AARRR (Acquisition, Activation, Retention, Revenue, Referral) metrics',
      tags: ['Metrics'],
      querystring: {
        type: 'object',
        properties: {
          period: { 
            type: 'string', 
            enum: ['1d', '7d', '30d', '90d'],
            default: '30d'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            acquisition: {
              type: 'object',
              properties: {
                newTenants: { type: 'number' },
                signupRate: { type: 'number' },
                activationRate: { type: 'number' },
                sources: { type: 'object' }
              }
            },
            activation: {
              type: 'object',
              properties: {
                onboardingCompleted: { type: 'number' },
                firstDocumentProcessed: { type: 'number' },
                timeToFirstValue: { type: 'number' }
              }
            },
            retention: {
              type: 'object',
              properties: {
                daily: { type: 'number' },
                weekly: { type: 'number' },
                monthly: { type: 'number' },
                churnRate: { type: 'number' }
              }
            },
            revenue: {
              type: 'object',
              properties: {
                mrr: { type: 'number' },
                arr: { type: 'number' },
                arpu: { type: 'number' },
                ltv: { type: 'number' }
              }
            },
            referral: {
              type: 'object',
              properties: {
                referralRate: { type: 'number' },
                viralCoefficient: { type: 'number' },
                referralConversions: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { period?: string }
  }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext;
      const { period = '30d' } = request.query;

      // For admin users, show global metrics; for tenant users, show tenant-specific metrics
      const tenantId = tenantContext?.tenantId;
      const metrics = await metricsService.getAAARRRMetrics(tenantId, period);

      reply.send(metrics);

    } catch (error) {
      request.log.error(error, 'Error getting AARRR metrics');
      throw error;
    }
  });

  // Get tenant health score
  fastify.get('/health-score', {
    schema: {
      description: 'Get tenant health score',
      tags: ['Metrics'],
      response: {
        200: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            score: { type: 'number' },
            factors: {
              type: 'object',
              properties: {
                usage: { type: 'number' },
                engagement: { type: 'number' },
                billing: { type: 'number' },
                support: { type: 'number' },
                integrations: { type: 'number' }
              }
            },
            risk: { type: 'string', enum: ['low', 'medium', 'high'] },
            recommendations: { type: 'array', items: { type: 'string' } },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as MetricsRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const healthScore = await metricsService.calculateHealthScore(tenantContext.tenantId);
      reply.send(healthScore);

    } catch (error) {
      request.log.error(error, 'Error getting health score');
      throw error;
    }
  });

  // Get metrics data with filtering and aggregation
  fastify.get('/data', {
    schema: {
      description: 'Get metrics data with filtering and aggregation',
      tags: ['Metrics'],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          eventTypes: { type: 'string' }, // comma-separated
          aggregation: { 
            type: 'string', 
            enum: ['hour', 'day', 'week', 'month'],
            default: 'day'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  event_type: { type: 'string' },
                  count: { type: 'number' },
                  total_value: { type: 'number' },
                  avg_value: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { 
      dateFrom?: string;
      dateTo?: string;
      eventTypes?: string;
      aggregation?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as MetricsRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { dateFrom, dateTo, eventTypes, aggregation } = request.query;

      const query: MetricsQuery = {
        tenantId: tenantContext.tenantId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        eventTypes: eventTypes ? eventTypes.split(',').map(t => t.trim()) : undefined,
        aggregation: (aggregation as any) || 'day'
      };

      const data = await metricsService.getMetrics(query);

      reply.send({ data });

    } catch (error) {
      request.log.error(error, 'Error getting metrics data');
      throw error;
    }
  });

  // Get dashboard overview
  fastify.get('/dashboard', {
    schema: {
      description: 'Get metrics dashboard overview',
      tags: ['Metrics'],
      response: {
        200: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                totalDocuments: { type: 'number' },
                activeUsers: { type: 'number' },
                templatesUsed: { type: 'number' },
                apiCalls: { type: 'number' }
              }
            },
            healthScore: { type: 'object' },
            recentActivity: { type: 'array' },
            alerts: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantContext = (request as any).tenantContext as MetricsRouteContext;
      if (!tenantContext?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const tenantId = tenantContext.tenantId;

      // Get summary metrics for the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const summaryData = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'document_processed') as total_documents,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as active_users,
          COUNT(*) FILTER (WHERE event_type = 'template_executed') as templates_used,
          COUNT(*) FILTER (WHERE event_type = 'api_call') as api_calls
        FROM product_metrics 
        WHERE tenant_id = $1 AND recorded_at >= $2
      `, [tenantId, thirtyDaysAgo]);

      // Get health score
      const healthScore = await metricsService.calculateHealthScore(tenantId);

      // Get recent activity (last 10 events)
      const recentActivity = await db.query(`
        SELECT event_type, metadata, recorded_at, value
        FROM product_metrics 
        WHERE tenant_id = $1 
        ORDER BY recorded_at DESC 
        LIMIT 10
      `, [tenantId]);

      // Generate alerts based on health score
      const alerts = [];
      if (healthScore.risk === 'high') {
        alerts.push({
          type: 'warning',
          title: 'Low Health Score',
          message: `Your account health score is ${healthScore.score}/100. Consider following the recommendations.`,
          recommendations: healthScore.recommendations
        });
      }

      const summary = summaryData.rows[0];

      reply.send({
        summary: {
          totalDocuments: parseInt(summary.total_documents) || 0,
          activeUsers: parseInt(summary.active_users) || 0,
          templatesUsed: parseInt(summary.templates_used) || 0,
          apiCalls: parseInt(summary.api_calls) || 0
        },
        healthScore,
        recentActivity: recentActivity.rows,
        alerts
      });

    } catch (error) {
      request.log.error(error, 'Error getting dashboard data');
      throw error;
    }
  });

  // Administrative endpoint for all tenants health scores (admin only)
  fastify.get('/admin/health-scores', {
    schema: {
      description: 'Get health scores for all tenants (admin only)',
      tags: ['Metrics'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            healthScores: { type: 'array' },
            total: { type: 'number' },
            summary: {
              type: 'object',
              properties: {
                averageScore: { type: 'number' },
                riskDistribution: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { limit?: number; offset?: number; risk?: string }
  }>, reply: FastifyReply) => {
    try {
      // TODO: Add admin authentication check
      const { limit = 50, offset = 0, risk } = request.query;

      const conditions = ['1=1'];
      const params: any[] = [];
      let paramCount = 0;

      if (risk) {
        paramCount++;
        conditions.push(`risk = $${paramCount}`);
        params.push(risk);
      }

      paramCount++;
      params.push(limit);
      const limitParam = paramCount;
      
      paramCount++;
      params.push(offset);
      const offsetParam = paramCount;

      const result = await db.query(`
        SELECT 
          ths.*,
          t.name as tenant_name,
          t.plan
        FROM tenant_health_scores ths
        JOIN tenants t ON ths.tenant_id = t.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ths.score ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, params);

      // Get summary statistics
      const summaryResult = await db.query(`
        SELECT 
          AVG(score) as average_score,
          COUNT(*) FILTER (WHERE risk = 'low') as low_risk,
          COUNT(*) FILTER (WHERE risk = 'medium') as medium_risk,
          COUNT(*) FILTER (WHERE risk = 'high') as high_risk,
          COUNT(*) as total
        FROM tenant_health_scores
        WHERE ${conditions.slice(0, -2).join(' AND ') || '1=1'}
      `, params.slice(0, -2));

      const summary = summaryResult.rows[0];

      reply.send({
        healthScores: result.rows,
        total: parseInt(summary.total),
        summary: {
          averageScore: Math.round(parseFloat(summary.average_score) || 0),
          riskDistribution: {
            low: parseInt(summary.low_risk) || 0,
            medium: parseInt(summary.medium_risk) || 0,
            high: parseInt(summary.high_risk) || 0
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Error getting admin health scores');
      throw error;
    }
  });

  // Cleanup handler
  fastify.addHook('onClose', async () => {
    await metricsService.shutdown();
  });
}