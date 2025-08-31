import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SecurityAuditService, ForensicQuery, AuditEvent } from '../services/security-audit';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

interface SecurityRouteContext {
  tenantId: string;
  userId?: string;
}

interface AuditLogBody {
  eventType: string;
  resourceId?: string;
  resourceType?: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

interface UpdateAlertBody {
  status?: 'active' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  actionsTaken?: string[];
}

export default async function securityRoutes(fastify: FastifyInstance) {
  const db = new DatabaseService();
  const securityAudit = new SecurityAuditService(db);

  // Log security audit event
  fastify.post<{
    Body: AuditLogBody;
  }>('/audit/log', {
    schema: {
      description: 'Log a security audit event',
      tags: ['Security'],
      body: {
        type: 'object',
        required: ['eventType', 'action', 'outcome', 'severity'],
        properties: {
          eventType: { type: 'string' },
          resourceId: { type: 'string' },
          resourceType: { type: 'string' },
          action: { type: 'string' },
          outcome: { type: 'string', enum: ['success', 'failure', 'partial'] },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          metadata: { type: 'object' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            correlationId: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: AuditLogBody }>, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { eventType, resourceId, resourceType, action, outcome, severity, metadata } = request.body;

      const auditEvent: AuditEvent = {
        eventType,
        tenantId: context.tenantId,
        userId: context.userId,
        resourceId,
        resourceType,
        action,
        outcome,
        severity,
        metadata,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        sessionId: request.headers['x-session-id'] as string
      };

      await securityAudit.logEvent(auditEvent);

      reply.status(201).send({
        success: true,
        message: 'Audit event logged successfully',
        correlationId: auditEvent.correlationId
      });

    } catch (error) {
      request.log.error(error, 'Error logging audit event');
      throw error;
    }
  });

  // Get forensic audit data
  fastify.get('/audit/forensic', {
    schema: {
      description: 'Query forensic audit data',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          eventTypes: { type: 'string' }, // comma-separated
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          resourceId: { type: 'string' },
          ipAddress: { type: 'string' },
          outcome: { type: 'string' }, // comma-separated
          severity: { type: 'string' }, // comma-separated
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            total: { type: 'number' },
            query: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: {
      userId?: string;
      eventTypes?: string;
      dateFrom?: string;
      dateTo?: string;
      resourceId?: string;
      ipAddress?: string;
      outcome?: string;
      severity?: string;
      limit?: number;
      offset?: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const {
        userId,
        eventTypes,
        dateFrom,
        dateTo,
        resourceId,
        ipAddress,
        outcome,
        severity,
        limit = 100,
        offset = 0
      } = request.query;

      const query: ForensicQuery = {
        tenantId: context.tenantId,
        userId,
        eventTypes: eventTypes ? eventTypes.split(',').map(t => t.trim()) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        resourceId,
        ipAddress,
        outcome: outcome ? outcome.split(',').map(o => o.trim()) : undefined,
        severity: severity ? severity.split(',').map(s => s.trim()) : undefined,
        limit,
        offset
      };

      const data = await securityAudit.queryForensicData(query);

      reply.send({
        data,
        total: data.length,
        query: {
          ...query,
          dateFrom: query.dateFrom?.toISOString(),
          dateTo: query.dateTo?.toISOString()
        }
      });

    } catch (error) {
      request.log.error(error, 'Error querying forensic data');
      throw error;
    }
  });

  // Generate forensic report
  fastify.post('/audit/report', {
    schema: {
      description: 'Generate forensic audit report',
      tags: ['Security'],
      body: {
        type: 'object',
        required: ['dateFrom', 'dateTo'],
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            reportPeriod: { type: 'object' },
            generatedAt: { type: 'string', format: 'date-time' },
            summary: { type: 'object' },
            eventsSummary: { type: 'array' },
            alertsSummary: { type: 'array' },
            metadata: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Body: { dateFrom: string; dateTo: string }
  }>, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { dateFrom, dateTo } = request.body;

      const report = await securityAudit.generateForensicReport(
        context.tenantId,
        new Date(dateFrom),
        new Date(dateTo)
      );

      reply.send(report);

    } catch (error) {
      request.log.error(error, 'Error generating forensic report');
      throw error;
    }
  });

  // Get security alerts
  fastify.get('/alerts', {
    schema: {
      description: 'Get security alerts',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['active', 'investigating', 'resolved', 'false_positive'] 
          },
          severity: { 
            type: 'string', 
            enum: ['low', 'medium', 'high', 'critical'] 
          },
          type: { 
            type: 'string', 
            enum: ['anomaly', 'suspicious', 'policy_violation', 'brute_force', 'data_exfiltration'] 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            alerts: { type: 'array' },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
                high_severity: { type: 'number' },
                resolved: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { status?: string; severity?: string; type?: string }
  }>, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { status } = request.query;
      const alerts = await securityAudit.getSecurityAlerts(context.tenantId, status);

      const summary = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        high_severity: alerts.filter(a => ['high', 'critical'].includes(a.severity)).length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      };

      reply.send({ alerts, summary });

    } catch (error) {
      request.log.error(error, 'Error getting security alerts');
      throw error;
    }
  });

  // Update security alert
  fastify.put<{
    Params: { alertId: string };
    Body: UpdateAlertBody;
  }>('/alerts/:alertId', {
    schema: {
      description: 'Update security alert',
      tags: ['Security'],
      params: {
        type: 'object',
        required: ['alertId'],
        properties: {
          alertId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['active', 'investigating', 'resolved', 'false_positive'] 
          },
          assignedTo: { type: 'string' },
          actionsTaken: { 
            type: 'array', 
            items: { type: 'string' } 
          }
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
  }, async (request: FastifyRequest<{ 
    Params: { alertId: string }; 
    Body: UpdateAlertBody 
  }>, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const { alertId } = request.params;
      const updates = request.body;

      // Set resolved timestamp if status is being set to resolved
      if (updates.status === 'resolved') {
        updates.resolvedAt = new Date();
      }

      await securityAudit.updateAlert(alertId, updates);

      // Log the alert update
      await securityAudit.logEvent({
        eventType: 'security_alert_updated',
        tenantId: context.tenantId,
        userId: context.userId,
        resourceId: alertId,
        resourceType: 'security_alert',
        action: 'update',
        outcome: 'success',
        severity: 'low',
        metadata: { updates },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      reply.send({
        success: true,
        message: 'Security alert updated successfully'
      });

    } catch (error) {
      request.log.error(error, 'Error updating security alert');
      throw error;
    }
  });

  // Get security dashboard
  fastify.get('/dashboard', {
    schema: {
      description: 'Get security dashboard overview',
      tags: ['Security'],
      response: {
        200: {
          type: 'object',
          properties: {
            overview: {
              type: 'object',
              properties: {
                totalEvents: { type: 'number' },
                failedEvents: { type: 'number' },
                activeAlerts: { type: 'number' },
                criticalAlerts: { type: 'number' },
                uniqueUsers: { type: 'number' },
                uniqueIPs: { type: 'number' }
              }
            },
            recentAlerts: { type: 'array' },
            eventsTrend: { type: 'array' },
            riskScore: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = (request as any).tenantContext as SecurityRouteContext;
      if (!context?.tenantId) {
        throw createError.unauthorized('Tenant context required');
      }

      const tenantId = context.tenantId;
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get overview stats
      const overviewData = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE outcome = 'failure') as failed_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM security_audit_log
        WHERE tenant_id = $1 AND logged_at >= $2
      `, [tenantId, last24Hours]);

      // Get active alerts
      const alertsData = await db.query(`
        SELECT 
          COUNT(*) as active_alerts,
          COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as critical_alerts
        FROM security_alerts
        WHERE tenant_id = $1 AND status = 'active'
      `, [tenantId]);

      // Get recent alerts
      const recentAlerts = await securityAudit.getSecurityAlerts(tenantId);
      const recentAlertsLimited = recentAlerts.slice(0, 5);

      // Get events trend (last 7 days)
      const eventsTrendData = await db.query(`
        SELECT 
          DATE(logged_at) as date,
          COUNT(*) as events,
          COUNT(*) FILTER (WHERE outcome = 'failure') as failures
        FROM security_audit_log
        WHERE tenant_id = $1 AND logged_at >= $2
        GROUP BY DATE(logged_at)
        ORDER BY date DESC
      `, [tenantId, last7Days]);

      // Calculate risk score (0-100)
      const overview = overviewData.rows[0] || {};
      const alerts = alertsData.rows[0] || {};
      
      const failureRate = overview.total_events > 0 
        ? (parseInt(overview.failed_events) / parseInt(overview.total_events)) * 100 
        : 0;
      
      const riskScore = Math.min(100, Math.round(
        (parseInt(alerts.active_alerts) * 10) +
        (parseInt(alerts.critical_alerts) * 20) +
        (failureRate * 0.5)
      ));

      reply.send({
        overview: {
          totalEvents: parseInt(overview.total_events) || 0,
          failedEvents: parseInt(overview.failed_events) || 0,
          activeAlerts: parseInt(alerts.active_alerts) || 0,
          criticalAlerts: parseInt(alerts.critical_alerts) || 0,
          uniqueUsers: parseInt(overview.unique_users) || 0,
          uniqueIPs: parseInt(overview.unique_ips) || 0
        },
        recentAlerts: recentAlertsLimited,
        eventsTrend: eventsTrendData.rows,
        riskScore
      });

    } catch (error) {
      request.log.error(error, 'Error getting security dashboard');
      throw error;
    }
  });

  // Cleanup handler
  fastify.addHook('onClose', async () => {
    await securityAudit.shutdown();
  });
}