import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import logger from '../config/logger';

export interface MetricsEvent {
  eventType: string;
  tenantId: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  value?: number;
  currency?: string;
}

export interface AAARRRMetrics {
  acquisition: {
    newTenants: number;
    signupRate: number;
    activationRate: number;
    sources: Record<string, number>;
  };
  activation: {
    onboardingCompleted: number;
    firstDocumentProcessed: number;
    timeToFirstValue: number; // hours
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
    churnRate: number;
  };
  revenue: {
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Recurring Revenue
    arpu: number; // Average Revenue Per User
    ltv: number; // Lifetime Value
  };
  referral: {
    referralRate: number;
    viralCoefficient: number;
    referralConversions: number;
  };
}

export interface HealthScore {
  tenantId: string;
  score: number; // 0-100
  factors: {
    usage: number;
    engagement: number;
    billing: number;
    support: number;
    integrations: number;
  };
  risk: 'low' | 'medium' | 'high';
  recommendations: string[];
  lastUpdated: Date;
}

export interface MetricsQuery {
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  eventTypes?: string[];
  aggregation?: 'hour' | 'day' | 'week' | 'month';
}

export class ProductMetricsService extends EventEmitter {
  private db: DatabaseService;
  private metricsBuffer: MetricsEvent[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(db: DatabaseService) {
    super();
    this.db = db;
    
    // Flush metrics buffer every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  async recordEvent(event: MetricsEvent): Promise<void> {
    const metricsEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    // Add to buffer for batch processing
    this.metricsBuffer.push(metricsEvent);

    // Emit event for real-time processing
    this.emit('metrics:event', metricsEvent);

    logger.debug('Metrics event recorded', {
      eventType: event.eventType,
      tenantId: event.tenantId,
      value: event.value
    });
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const events = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      for (const event of events) {
        await this.db.query(`
          INSERT INTO product_metrics (
            event_type, tenant_id, user_id, metadata, 
            value, currency, recorded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          event.eventType,
          event.tenantId,
          event.userId,
          JSON.stringify(event.metadata || {}),
          event.value,
          event.currency,
          event.timestamp
        ]);
      }

      logger.debug(`Flushed ${events.length} metrics events to database`);
    } catch (error) {
      logger.error('Failed to flush metrics events', error);
      // Re-add failed events to buffer for retry
      this.metricsBuffer.unshift(...events);
    }
  }

  async getAAARRRMetrics(tenantId?: string, period: string = '30d'): Promise<AAARRRMetrics> {
    const dateFrom = this.calculateDateFrom(period);
    
    try {
      // Acquisition Metrics
      const acquisitionData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'tenant_created') as new_tenants,
          COUNT(*) FILTER (WHERE event_type = 'user_signup') as signups,
          COUNT(*) FILTER (WHERE event_type = 'onboarding_completed') as activations
        FROM product_metrics 
        WHERE recorded_at >= $1 
        ${tenantId ? 'AND tenant_id = $2' : ''}
      `, tenantId ? [dateFrom, tenantId] : [dateFrom]);

      // Activation Metrics
      const activationData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'onboarding_completed') as onboarding_completed,
          COUNT(*) FILTER (WHERE event_type = 'first_document_processed') as first_document,
          AVG(EXTRACT(EPOCH FROM (recorded_at - created_at))/3600) as avg_time_to_value
        FROM product_metrics pm
        JOIN tenants t ON pm.tenant_id = t.id
        WHERE pm.recorded_at >= $1
        ${tenantId ? 'AND pm.tenant_id = $2' : ''}
      `, tenantId ? [dateFrom, tenantId] : [dateFrom]);

      // Retention Metrics
      const retentionData = await this.db.query(`
        WITH daily_active AS (
          SELECT tenant_id, DATE(recorded_at) as date
          FROM product_metrics 
          WHERE event_type IN ('document_processed', 'template_executed', 'api_call')
          AND recorded_at >= $1 - INTERVAL '7 days'
          ${tenantId ? 'AND tenant_id = $2' : ''}
          GROUP BY tenant_id, DATE(recorded_at)
        ),
        retention_cohort AS (
          SELECT 
            tenant_id,
            COUNT(DISTINCT date) as active_days,
            MAX(date) as last_active
          FROM daily_active 
          GROUP BY tenant_id
        )
        SELECT 
          COUNT(*) FILTER (WHERE active_days >= 1) as daily_retention,
          COUNT(*) FILTER (WHERE active_days >= 7) as weekly_retention,
          COUNT(*) FILTER (WHERE active_days >= 30) as monthly_retention,
          COUNT(*) FILTER (WHERE last_active < CURRENT_DATE - 30) as churned
        FROM retention_cohort
      `, tenantId ? [dateFrom, tenantId] : [dateFrom]);

      // Revenue Metrics
      const revenueData = await this.db.query(`
        SELECT 
          SUM(value) FILTER (WHERE event_type = 'payment_received' AND recorded_at >= CURRENT_DATE - INTERVAL '30 days') as monthly_revenue,
          SUM(value) FILTER (WHERE event_type = 'payment_received') as total_revenue,
          COUNT(DISTINCT tenant_id) FILTER (WHERE event_type = 'payment_received') as paying_customers
        FROM product_metrics 
        WHERE recorded_at >= $1
        ${tenantId ? 'AND tenant_id = $2' : ''}
      `, tenantId ? [dateFrom, tenantId] : [dateFrom]);

      // Referral Metrics
      const referralData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'referral_sent') as referrals_sent,
          COUNT(*) FILTER (WHERE event_type = 'referral_converted') as referrals_converted
        FROM product_metrics 
        WHERE recorded_at >= $1
        ${tenantId ? 'AND tenant_id = $2' : ''}
      `, tenantId ? [dateFrom, tenantId] : [dateFrom]);

      const acquisition = acquisitionData.rows[0];
      const activation = activationData.rows[0];
      const retention = retentionData.rows[0];
      const revenue = revenueData.rows[0];
      const referral = referralData.rows[0];

      return {
        acquisition: {
          newTenants: parseInt(acquisition.new_tenants) || 0,
          signupRate: acquisition.signups > 0 ? (acquisition.activations / acquisition.signups) * 100 : 0,
          activationRate: acquisition.new_tenants > 0 ? (activation.onboarding_completed / acquisition.new_tenants) * 100 : 0,
          sources: {} // TODO: Track signup sources
        },
        activation: {
          onboardingCompleted: parseInt(activation.onboarding_completed) || 0,
          firstDocumentProcessed: parseInt(activation.first_document) || 0,
          timeToFirstValue: parseFloat(activation.avg_time_to_value) || 0
        },
        retention: {
          daily: parseInt(retention.daily_retention) || 0,
          weekly: parseInt(retention.weekly_retention) || 0,
          monthly: parseInt(retention.monthly_retention) || 0,
          churnRate: retention.churned > 0 ? (retention.churned / (retention.monthly_retention + retention.churned)) * 100 : 0
        },
        revenue: {
          mrr: parseFloat(revenue.monthly_revenue) || 0,
          arr: (parseFloat(revenue.monthly_revenue) || 0) * 12,
          arpu: revenue.paying_customers > 0 ? (parseFloat(revenue.monthly_revenue) || 0) / revenue.paying_customers : 0,
          ltv: 0 // TODO: Calculate based on churn and ARPU
        },
        referral: {
          referralRate: referral.referrals_sent > 0 ? (referral.referrals_converted / referral.referrals_sent) * 100 : 0,
          viralCoefficient: 0, // TODO: Calculate viral coefficient
          referralConversions: parseInt(referral.referrals_converted) || 0
        }
      };

    } catch (error) {
      logger.error('Failed to calculate AARRR metrics', error);
      throw error;
    }
  }

  async calculateHealthScore(tenantId: string): Promise<HealthScore> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Usage Score (0-30 points)
      const usageData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'document_processed') as documents_processed,
          COUNT(*) FILTER (WHERE event_type = 'template_executed') as templates_used,
          COUNT(*) FILTER (WHERE event_type = 'api_call') as api_calls,
          COUNT(DISTINCT DATE(recorded_at)) as active_days
        FROM product_metrics 
        WHERE tenant_id = $1 AND recorded_at >= $2
      `, [tenantId, thirtyDaysAgo]);

      const usage = usageData.rows[0];
      const usageScore = Math.min(30, 
        (parseInt(usage.documents_processed) * 0.5) + 
        (parseInt(usage.templates_used) * 2) + 
        (parseInt(usage.api_calls) * 0.1) +
        (parseInt(usage.active_days) * 1)
      );

      // Engagement Score (0-25 points)
      const engagementData = await this.db.query(`
        SELECT 
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) FILTER (WHERE event_type = 'feature_used') as feature_usage,
          COUNT(*) FILTER (WHERE event_type = 'integration_used') as integration_usage
        FROM product_metrics 
        WHERE tenant_id = $1 AND recorded_at >= $2
      `, [tenantId, thirtyDaysAgo]);

      const engagement = engagementData.rows[0];
      const engagementScore = Math.min(25,
        (parseInt(engagement.active_users) * 5) +
        (parseInt(engagement.feature_usage) * 0.5) +
        (parseInt(engagement.integration_usage) * 2)
      );

      // Billing Score (0-20 points)
      const billingData = await this.db.query(`
        SELECT 
          plan,
          COUNT(*) FILTER (WHERE event_type = 'payment_received') as payments,
          SUM(value) FILTER (WHERE event_type = 'quota_exceeded') as overages
        FROM product_metrics pm
        JOIN tenants t ON pm.tenant_id = t.id
        WHERE pm.tenant_id = $1 AND pm.recorded_at >= $2
        GROUP BY plan
      `, [tenantId, thirtyDaysAgo]);

      const billing = billingData.rows[0] || {};
      const billingScore = Math.min(20,
        (billing.plan === 'enterprise' ? 20 : billing.plan === 'business' ? 15 : billing.plan === 'pro' ? 10 : 5) +
        (parseInt(billing.payments) > 0 ? 5 : 0) -
        (parseInt(billing.overages) > 0 ? 5 : 0)
      );

      // Support Score (0-15 points)
      const supportData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'support_ticket_created') as tickets,
          COUNT(*) FILTER (WHERE event_type = 'support_ticket_resolved') as resolved_tickets,
          AVG(EXTRACT(EPOCH FROM metadata->>'resolution_time')::numeric/3600) as avg_resolution_hours
        FROM product_metrics 
        WHERE tenant_id = $1 AND recorded_at >= $2
      `, [tenantId, thirtyDaysAgo]);

      const support = supportData.rows[0];
      const supportScore = Math.min(15, 15 - (parseInt(support.tickets) * 2) + (parseInt(support.resolved_tickets) * 1));

      // Integrations Score (0-10 points)
      const integrationData = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'integration_configured') as integrations_setup,
          COUNT(*) FILTER (WHERE event_type = 'webhook_success') as webhook_success,
          COUNT(*) FILTER (WHERE event_type = 'webhook_failed') as webhook_failures
        FROM product_metrics 
        WHERE tenant_id = $1 AND recorded_at >= $2
      `, [tenantId, thirtyDaysAgo]);

      const integrations = integrationData.rows[0];
      const integrationsScore = Math.min(10,
        (parseInt(integrations.integrations_setup) * 3) +
        (parseInt(integrations.webhook_success) * 0.1) -
        (parseInt(integrations.webhook_failures) * 0.5)
      );

      const totalScore = Math.round(usageScore + engagementScore + billingScore + supportScore + integrationsScore);
      
      const risk = totalScore >= 70 ? 'low' : totalScore >= 40 ? 'medium' : 'high';
      
      const recommendations = [];
      if (usageScore < 15) recommendations.push('Increase document processing activity');
      if (engagementScore < 12) recommendations.push('Improve user engagement with features');
      if (billingScore < 10) recommendations.push('Consider plan upgrade or payment issues');
      if (supportScore < 10) recommendations.push('Address support tickets promptly');
      if (integrationsScore < 5) recommendations.push('Setup more integrations');

      const healthScore: HealthScore = {
        tenantId,
        score: totalScore,
        factors: {
          usage: Math.round(usageScore),
          engagement: Math.round(engagementScore),
          billing: Math.round(billingScore),
          support: Math.round(supportScore),
          integrations: Math.round(integrationsScore)
        },
        risk,
        recommendations,
        lastUpdated: now
      };

      // Store health score for historical tracking
      await this.db.query(`
        INSERT INTO tenant_health_scores (
          tenant_id, score, factors, risk, recommendations, calculated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id) DO UPDATE SET
          score = $2, factors = $3, risk = $4, recommendations = $5, calculated_at = $6
      `, [
        tenantId,
        totalScore,
        JSON.stringify(healthScore.factors),
        risk,
        JSON.stringify(recommendations),
        now
      ]);

      return healthScore;

    } catch (error) {
      logger.error('Failed to calculate health score', error);
      throw error;
    }
  }

  async getMetrics(query: MetricsQuery): Promise<any[]> {
    try {
      const conditions = ['1=1'];
      const params: any[] = [];
      let paramCount = 0;

      if (query.tenantId) {
        paramCount++;
        conditions.push(`tenant_id = $${paramCount}`);
        params.push(query.tenantId);
      }

      if (query.dateFrom) {
        paramCount++;
        conditions.push(`recorded_at >= $${paramCount}`);
        params.push(query.dateFrom);
      }

      if (query.dateTo) {
        paramCount++;
        conditions.push(`recorded_at <= $${paramCount}`);
        params.push(query.dateTo);
      }

      if (query.eventTypes?.length) {
        paramCount++;
        conditions.push(`event_type = ANY($${paramCount})`);
        params.push(query.eventTypes);
      }

      const aggregation = query.aggregation || 'day';
      const dateFormat = {
        hour: 'YYYY-MM-DD HH24:00:00',
        day: 'YYYY-MM-DD',
        week: 'YYYY-WW',
        month: 'YYYY-MM'
      }[aggregation];

      const result = await this.db.query(`
        SELECT 
          TO_CHAR(recorded_at, '${dateFormat}') as period,
          event_type,
          COUNT(*) as count,
          SUM(value) as total_value,
          AVG(value) as avg_value
        FROM product_metrics 
        WHERE ${conditions.join(' AND ')}
        GROUP BY period, event_type
        ORDER BY period DESC, event_type
      `, params);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get metrics', error);
      throw error;
    }
  }

  private calculateDateFrom(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1d': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushMetrics();
  }
}