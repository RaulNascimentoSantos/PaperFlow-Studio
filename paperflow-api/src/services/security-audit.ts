import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import logger from '../config/logger';
import { createHash } from 'crypto';

export interface AuditEvent {
  eventType: string;
  tenantId: string;
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  sessionId?: string;
  correlationId?: string;
}

export interface SecurityAlert {
  id: string;
  type: 'anomaly' | 'suspicious' | 'policy_violation' | 'brute_force' | 'data_exfiltration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  tenantId: string;
  userId?: string;
  resourceId?: string;
  detectedAt: Date;
  evidence: Record<string, any>;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
  actionsTaken?: string[];
}

export interface ForensicQuery {
  tenantId?: string;
  userId?: string;
  eventTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  resourceId?: string;
  ipAddress?: string;
  outcome?: string[];
  severity?: string[];
  limit?: number;
  offset?: number;
}

export interface AnomalyPattern {
  type: string;
  description: string;
  threshold: number;
  timeWindow: number; // minutes
  enabled: boolean;
}

export class SecurityAuditService extends EventEmitter {
  private db: DatabaseService;
  private anomalyPatterns: Map<string, AnomalyPattern>;
  private auditBuffer: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(db: DatabaseService) {
    super();
    this.db = db;
    this.anomalyPatterns = new Map();
    
    // Initialize default anomaly patterns
    this.initializeAnomalyPatterns();
    
    // Flush audit events every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushAuditEvents();
    }, 10000);
  }

  private initializeAnomalyPatterns(): void {
    const patterns: AnomalyPattern[] = [
      {
        type: 'brute_force_login',
        description: 'Multiple failed login attempts from same IP',
        threshold: 5,
        timeWindow: 15,
        enabled: true
      },
      {
        type: 'unusual_api_activity',
        description: 'Unusually high API call volume',
        threshold: 1000,
        timeWindow: 60,
        enabled: true
      },
      {
        type: 'after_hours_access',
        description: 'Access outside business hours',
        threshold: 1,
        timeWindow: 60,
        enabled: true
      },
      {
        type: 'bulk_data_access',
        description: 'Large number of documents accessed in short time',
        threshold: 50,
        timeWindow: 30,
        enabled: true
      },
      {
        type: 'privilege_escalation',
        description: 'Unauthorized access to admin functions',
        threshold: 1,
        timeWindow: 5,
        enabled: true
      },
      {
        type: 'data_export_anomaly',
        description: 'Unusual data export patterns',
        threshold: 10,
        timeWindow: 30,
        enabled: true
      }
    ];

    patterns.forEach(pattern => {
      this.anomalyPatterns.set(pattern.type, pattern);
    });
  }

  async logEvent(event: AuditEvent): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
      correlationId: event.correlationId || this.generateCorrelationId()
    };

    // Add to buffer for batch processing
    this.auditBuffer.push(auditEvent);

    // Emit for real-time processing
    this.emit('audit:event', auditEvent);

    // Check for anomalies
    await this.detectAnomalies(auditEvent);

    logger.debug('Security audit event logged', {
      eventType: event.eventType,
      tenantId: event.tenantId,
      action: event.action,
      outcome: event.outcome,
      severity: event.severity
    });
  }

  private async flushAuditEvents(): Promise<void> {
    if (this.auditBuffer.length === 0) return;

    const events = [...this.auditBuffer];
    this.auditBuffer = [];

    try {
      for (const event of events) {
        await this.db.query(`
          INSERT INTO security_audit_log (
            event_type, tenant_id, user_id, resource_id, resource_type,
            action, outcome, severity, metadata, ip_address, user_agent,
            session_id, correlation_id, logged_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          event.eventType,
          event.tenantId,
          event.userId,
          event.resourceId,
          event.resourceType,
          event.action,
          event.outcome,
          event.severity,
          JSON.stringify(event.metadata || {}),
          event.ipAddress,
          event.userAgent,
          event.sessionId,
          event.correlationId,
          event.timestamp
        ]);
      }

      logger.debug(`Flushed ${events.length} audit events to database`);
    } catch (error) {
      logger.error('Failed to flush audit events', error);
      // Re-add failed events to buffer for retry
      this.auditBuffer.unshift(...events);
    }
  }

  private async detectAnomalies(event: AuditEvent): Promise<void> {
    try {
      // Check each anomaly pattern
      for (const [patternType, pattern] of this.anomalyPatterns.entries()) {
        if (!pattern.enabled) continue;

        const isAnomaly = await this.checkAnomalyPattern(event, pattern);
        if (isAnomaly) {
          await this.createSecurityAlert({
            id: this.generateAlertId(),
            type: 'anomaly',
            severity: this.mapSeverityToAlert(event.severity),
            title: `Anomaly Detected: ${pattern.description}`,
            description: `Pattern "${patternType}" triggered for tenant ${event.tenantId}`,
            tenantId: event.tenantId,
            userId: event.userId,
            resourceId: event.resourceId,
            detectedAt: new Date(),
            evidence: {
              pattern: patternType,
              threshold: pattern.threshold,
              timeWindow: pattern.timeWindow,
              triggerEvent: event
            },
            status: 'active'
          });
        }
      }
    } catch (error) {
      logger.error('Error detecting anomalies', error);
    }
  }

  private async checkAnomalyPattern(event: AuditEvent, pattern: AnomalyPattern): Promise<boolean> {
    const timeThreshold = new Date(Date.now() - pattern.timeWindow * 60 * 1000);

    switch (pattern.type) {
      case 'brute_force_login':
        if (event.eventType === 'authentication' && event.outcome === 'failure') {
          const failedAttempts = await this.db.query(`
            SELECT COUNT(*) as count
            FROM security_audit_log
            WHERE event_type = 'authentication'
            AND outcome = 'failure'
            AND ip_address = $1
            AND logged_at >= $2
          `, [event.ipAddress, timeThreshold]);

          return parseInt(failedAttempts.rows[0]?.count || '0') >= pattern.threshold;
        }
        break;

      case 'unusual_api_activity':
        if (event.eventType === 'api_call') {
          const apiCalls = await this.db.query(`
            SELECT COUNT(*) as count
            FROM security_audit_log
            WHERE event_type = 'api_call'
            AND tenant_id = $1
            AND logged_at >= $2
          `, [event.tenantId, timeThreshold]);

          return parseInt(apiCalls.rows[0]?.count || '0') >= pattern.threshold;
        }
        break;

      case 'after_hours_access':
        if (event.timestamp) {
          const hour = event.timestamp.getHours();
          // Consider 6 PM to 6 AM as after hours
          return hour >= 18 || hour < 6;
        }
        break;

      case 'bulk_data_access':
        if (event.eventType === 'document_access') {
          const documentAccess = await this.db.query(`
            SELECT COUNT(DISTINCT resource_id) as count
            FROM security_audit_log
            WHERE event_type = 'document_access'
            AND tenant_id = $1
            AND user_id = $2
            AND logged_at >= $3
          `, [event.tenantId, event.userId, timeThreshold]);

          return parseInt(documentAccess.rows[0]?.count || '0') >= pattern.threshold;
        }
        break;

      case 'privilege_escalation':
        if (event.action === 'admin_access' || event.resourceType === 'admin_panel') {
          return true; // Any admin access is flagged for review
        }
        break;

      case 'data_export_anomaly':
        if (event.eventType === 'data_export') {
          const exports = await this.db.query(`
            SELECT COUNT(*) as count
            FROM security_audit_log
            WHERE event_type = 'data_export'
            AND tenant_id = $1
            AND user_id = $2
            AND logged_at >= $3
          `, [event.tenantId, event.userId, timeThreshold]);

          return parseInt(exports.rows[0]?.count || '0') >= pattern.threshold;
        }
        break;
    }

    return false;
  }

  async createSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_alerts (
          id, type, severity, title, description, tenant_id, user_id,
          resource_id, detected_at, evidence, status, assigned_to,
          resolved_at, actions_taken
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.description,
        alert.tenantId,
        alert.userId,
        alert.resourceId,
        alert.detectedAt,
        JSON.stringify(alert.evidence),
        alert.status,
        alert.assignedTo,
        alert.resolvedAt,
        JSON.stringify(alert.actionsTaken || [])
      ]);

      // Emit alert for notifications
      this.emit('security:alert', alert);

      logger.warn('Security alert created', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        tenantId: alert.tenantId
      });

    } catch (error) {
      logger.error('Failed to create security alert', error);
      throw error;
    }
  }

  async queryForensicData(query: ForensicQuery): Promise<any[]> {
    try {
      const conditions = ['1=1'];
      const params: any[] = [];
      let paramCount = 0;

      if (query.tenantId) {
        paramCount++;
        conditions.push(`tenant_id = $${paramCount}`);
        params.push(query.tenantId);
      }

      if (query.userId) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        params.push(query.userId);
      }

      if (query.eventTypes?.length) {
        paramCount++;
        conditions.push(`event_type = ANY($${paramCount})`);
        params.push(query.eventTypes);
      }

      if (query.dateFrom) {
        paramCount++;
        conditions.push(`logged_at >= $${paramCount}`);
        params.push(query.dateFrom);
      }

      if (query.dateTo) {
        paramCount++;
        conditions.push(`logged_at <= $${paramCount}`);
        params.push(query.dateTo);
      }

      if (query.resourceId) {
        paramCount++;
        conditions.push(`resource_id = $${paramCount}`);
        params.push(query.resourceId);
      }

      if (query.ipAddress) {
        paramCount++;
        conditions.push(`ip_address = $${paramCount}`);
        params.push(query.ipAddress);
      }

      if (query.outcome?.length) {
        paramCount++;
        conditions.push(`outcome = ANY($${paramCount})`);
        params.push(query.outcome);
      }

      if (query.severity?.length) {
        paramCount++;
        conditions.push(`severity = ANY($${paramCount})`);
        params.push(query.severity);
      }

      const limit = query.limit || 100;
      const offset = query.offset || 0;

      paramCount++;
      params.push(limit);
      const limitParam = paramCount;

      paramCount++;
      params.push(offset);
      const offsetParam = paramCount;

      const result = await this.db.query(`
        SELECT *
        FROM security_audit_log
        WHERE ${conditions.join(' AND ')}
        ORDER BY logged_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, params);

      return result.rows;

    } catch (error) {
      logger.error('Failed to query forensic data', error);
      throw error;
    }
  }

  async getSecurityAlerts(tenantId?: string, status?: string): Promise<SecurityAlert[]> {
    try {
      const conditions = ['1=1'];
      const params: any[] = [];
      let paramCount = 0;

      if (tenantId) {
        paramCount++;
        conditions.push(`tenant_id = $${paramCount}`);
        params.push(tenantId);
      }

      if (status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        params.push(status);
      }

      const result = await this.db.query(`
        SELECT *
        FROM security_alerts
        WHERE ${conditions.join(' AND ')}
        ORDER BY detected_at DESC
      `, params);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        description: row.description,
        tenantId: row.tenant_id,
        userId: row.user_id,
        resourceId: row.resource_id,
        detectedAt: row.detected_at,
        evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence,
        status: row.status,
        assignedTo: row.assigned_to,
        resolvedAt: row.resolved_at,
        actionsTaken: typeof row.actions_taken === 'string' ? JSON.parse(row.actions_taken) : row.actions_taken
      }));

    } catch (error) {
      logger.error('Failed to get security alerts', error);
      throw error;
    }
  }

  async updateAlert(alertId: string, updates: Partial<SecurityAlert>): Promise<void> {
    try {
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      if (updates.status) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        params.push(updates.status);
      }

      if (updates.assignedTo) {
        paramCount++;
        updateFields.push(`assigned_to = $${paramCount}`);
        params.push(updates.assignedTo);
      }

      if (updates.resolvedAt) {
        paramCount++;
        updateFields.push(`resolved_at = $${paramCount}`);
        params.push(updates.resolvedAt);
      }

      if (updates.actionsTaken) {
        paramCount++;
        updateFields.push(`actions_taken = $${paramCount}`);
        params.push(JSON.stringify(updates.actionsTaken));
      }

      if (updateFields.length === 0) return;

      paramCount++;
      params.push(alertId);

      await this.db.query(`
        UPDATE security_alerts
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
      `, params);

    } catch (error) {
      logger.error('Failed to update security alert', error);
      throw error;
    }
  }

  async generateForensicReport(tenantId: string, dateFrom: Date, dateTo: Date): Promise<any> {
    try {
      const [eventsData, alertsData, summaryData] = await Promise.all([
        // Get events summary
        this.db.query(`
          SELECT 
            event_type,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE outcome = 'failure') as failures,
            COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as high_severity
          FROM security_audit_log
          WHERE tenant_id = $1 AND logged_at BETWEEN $2 AND $3
          GROUP BY event_type
          ORDER BY count DESC
        `, [tenantId, dateFrom, dateTo]),

        // Get alerts summary
        this.db.query(`
          SELECT 
            type,
            severity,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved
          FROM security_alerts
          WHERE tenant_id = $1 AND detected_at BETWEEN $2 AND $3
          GROUP BY type, severity
          ORDER BY count DESC
        `, [tenantId, dateFrom, dateTo]),

        // Get overall summary
        this.db.query(`
          SELECT 
            COUNT(DISTINCT sal.user_id) as unique_users,
            COUNT(DISTINCT sal.ip_address) as unique_ips,
            COUNT(DISTINCT sal.session_id) as unique_sessions,
            COUNT(*) as total_events,
            COUNT(sa.id) as total_alerts
          FROM security_audit_log sal
          LEFT JOIN security_alerts sa ON sa.tenant_id = sal.tenant_id 
            AND sa.detected_at BETWEEN $2 AND $3
          WHERE sal.tenant_id = $1 AND sal.logged_at BETWEEN $2 AND $3
        `, [tenantId, dateFrom, dateTo])
      ]);

      return {
        tenantId,
        reportPeriod: { from: dateFrom, to: dateTo },
        generatedAt: new Date(),
        summary: summaryData.rows[0] || {},
        eventsSummary: eventsData.rows,
        alertsSummary: alertsData.rows,
        metadata: {
          reportId: this.generateCorrelationId(),
          version: '1.0'
        }
      };

    } catch (error) {
      logger.error('Failed to generate forensic report', error);
      throw error;
    }
  }

  private generateCorrelationId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private mapSeverityToAlert(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushAuditEvents();
  }
}