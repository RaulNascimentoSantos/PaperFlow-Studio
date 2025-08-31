import { EventEmitter } from 'events';
import { TenantContext } from '../types/tenant';
import { DatabaseService } from './database';
import { QuotaManager } from './quota-manager';

export interface BillingEvent {
  tenantId: string;
  eventType: 'usage_recorded' | 'quota_exceeded' | 'overage_used' | 'plan_changed' | 'payment_due';
  data: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UsageRecord {
  tenantId: string;
  resource: string;
  amount: number;
  cost?: number;
  currency?: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface OverageRecord {
  tenantId: string;
  resource: string;
  amount: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  timestamp: Date;
}

export class BillingHooksService extends EventEmitter {
  constructor(
    private db: DatabaseService,
    private quotaManager: QuotaManager
  ) {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to quota manager events
    this.quotaManager.on('quotaExceeded', (data) => {
      this.handleQuotaExceeded(data);
    });

    this.quotaManager.on('overageRecorded', (data) => {
      this.handleOverageRecorded(data);
    });
  }

  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      // Save usage record for billing
      await this.db.query(`
        INSERT INTO billing_usage_records (
          tenant_id, resource, amount, cost, currency, period_start, period_end, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        record.tenantId,
        record.resource,
        record.amount,
        record.cost || 0,
        record.currency || 'BRL',
        record.periodStart,
        record.periodEnd
      ]);

      // Emit billing event
      this.emitBillingEvent({
        tenantId: record.tenantId,
        eventType: 'usage_recorded',
        data: record,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error recording usage for billing:', error);
      throw error;
    }
  }

  private async handleQuotaExceeded(data: any): Promise<void> {
    const { tenantId, resource, currentUsage, limit, overage } = data;

    // Get tenant info
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return;

    // Check if overage is allowed
    if (tenant.billing?.allowOverage) {
      await this.processOverage(tenantId, resource, overage, tenant);
    } else {
      // Emit quota exceeded event for notifications
      this.emitBillingEvent({
        tenantId,
        eventType: 'quota_exceeded',
        data: {
          resource,
          currentUsage,
          limit,
          planUpgradeRequired: true
        },
        timestamp: new Date()
      });
    }
  }

  private async handleOverageRecorded(data: any): Promise<void> {
    const { tenantId, resource, amount } = data;
    
    // Calculate overage cost
    const cost = await this.calculateOverageCost(tenantId, resource, amount);
    
    if (cost > 0) {
      const overageRecord: OverageRecord = {
        tenantId,
        resource,
        amount,
        unitCost: cost.unitCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        timestamp: new Date()
      };

      await this.recordOverageBilling(overageRecord);
    }
  }

  private async processOverage(
    tenantId: string, 
    resource: string, 
    amount: number, 
    tenant: TenantContext
  ): Promise<void> {
    const cost = await this.calculateOverageCost(tenantId, resource, amount);
    
    if (cost.totalCost > 0) {
      // Record overage charge
      await this.db.query(`
        INSERT INTO billing_overage_charges (
          tenant_id, resource, amount, unit_cost, total_cost, currency, charged_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [tenantId, resource, amount, cost.unitCost, cost.totalCost, cost.currency]);

      // Emit overage event
      this.emitBillingEvent({
        tenantId,
        eventType: 'overage_used',
        data: {
          resource,
          amount,
          cost: cost.totalCost,
          currency: cost.currency
        },
        timestamp: new Date()
      });
    }
  }

  private async calculateOverageCost(tenantId: string, resource: string, amount: number): Promise<{
    unitCost: number;
    totalCost: number;
    currency: string;
  }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { unitCost: 0, totalCost: 0, currency: 'BRL' };
    }

    // Get plan-specific overage pricing
    const { getPlanConfig } = await import('../config/plans');
    const planConfig = getPlanConfig(tenant.plan);
    
    if (!planConfig?.overage.pricing) {
      return { unitCost: 0, totalCost: 0, currency: tenant.settings.currency };
    }

    const currency = tenant.settings.currency;
    const unitCost = planConfig.overage.pricing.pricePerUnit[currency] || 0;
    const totalCost = Math.ceil(amount / planConfig.overage.pricing.documentsPerUnit) * unitCost;

    return { unitCost, totalCost, currency };
  }

  private async recordOverageBilling(record: OverageRecord): Promise<void> {
    await this.db.query(`
      INSERT INTO billing_overage_charges (
        tenant_id, resource, amount, unit_cost, total_cost, currency, charged_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      record.tenantId,
      record.resource, 
      record.amount,
      record.unitCost,
      record.totalCost,
      record.currency,
      record.timestamp
    ]);
  }

  async generateBillingReport(tenantId: string, periodStart: Date, periodEnd: Date): Promise<{
    tenant: TenantContext;
    usage: UsageRecord[];
    overages: OverageRecord[];
    totalCost: number;
    currency: string;
  }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Get usage records
    const usageResult = await this.db.query(`
      SELECT * FROM billing_usage_records 
      WHERE tenant_id = $1 AND recorded_at BETWEEN $2 AND $3
      ORDER BY recorded_at DESC
    `, [tenantId, periodStart, periodEnd]);

    // Get overage charges
    const overageResult = await this.db.query(`
      SELECT * FROM billing_overage_charges
      WHERE tenant_id = $1 AND charged_at BETWEEN $2 AND $3
      ORDER BY charged_at DESC
    `, [tenantId, periodStart, periodEnd]);

    const usage: UsageRecord[] = usageResult.rows.map(row => ({
      tenantId: row.tenant_id,
      resource: row.resource,
      amount: row.amount,
      cost: row.cost,
      currency: row.currency,
      periodStart: row.period_start,
      periodEnd: row.period_end
    }));

    const overages: OverageRecord[] = overageResult.rows.map(row => ({
      tenantId: row.tenant_id,
      resource: row.resource,
      amount: row.amount,
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      currency: row.currency,
      timestamp: row.charged_at
    }));

    // Calculate total cost
    const totalCost = overages.reduce((sum, overage) => sum + overage.totalCost, 0);

    return {
      tenant,
      usage,
      overages,
      totalCost,
      currency: tenant.settings.currency
    };
  }

  async createInvoice(tenantId: string, periodStart: Date, periodEnd: Date): Promise<{
    invoiceId: string;
    tenant: TenantContext;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    subtotal: number;
    taxes: number;
    total: number;
    currency: string;
    dueDate: Date;
  }> {
    const report = await this.generateBillingReport(tenantId, periodStart, periodEnd);
    const invoiceId = `INV-${tenantId.slice(0, 8)}-${Date.now()}`;

    // Create invoice items from overages
    const items = report.overages.map(overage => ({
      description: `Overage - ${overage.resource} (${overage.amount} units)`,
      quantity: overage.amount,
      unitPrice: overage.unitCost,
      totalPrice: overage.totalCost
    }));

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxes = subtotal * 0.1; // 10% tax rate
    const total = subtotal + taxes;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days to pay

    // Save invoice
    await this.db.query(`
      INSERT INTO billing_invoices (
        id, tenant_id, period_start, period_end, subtotal, taxes, total, 
        currency, due_date, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
    `, [invoiceId, tenantId, periodStart, periodEnd, subtotal, taxes, total, report.currency, dueDate]);

    // Emit payment due event
    this.emitBillingEvent({
      tenantId,
      eventType: 'payment_due',
      data: {
        invoiceId,
        amount: total,
        currency: report.currency,
        dueDate
      },
      timestamp: new Date()
    });

    return {
      invoiceId,
      tenant: report.tenant,
      items,
      subtotal,
      taxes,
      total,
      currency: report.currency,
      dueDate
    };
  }

  private emitBillingEvent(event: BillingEvent): void {
    this.emit('billingEvent', event);
    
    // Log billing events
    console.log(`💳 Billing Event: ${event.eventType} for tenant ${event.tenantId}`, event.data);
  }

  private async getTenant(tenantId: string): Promise<TenantContext | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        tenantId: row.id,
        tenantName: row.name,
        slug: row.slug,
        plan: row.plan,
        quotas: typeof row.quotas === 'string' ? JSON.parse(row.quotas) : row.quotas,
        features: {}, // Placeholder
        billing: typeof row.billing === 'string' ? JSON.parse(row.billing) : row.billing,
        settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
        status: row.deleted_at ? 'deleted' : (row.suspended_at ? 'suspended' : 'active'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        suspendedAt: row.suspended_at,
        deletedAt: row.deleted_at
      };
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  // Webhook endpoints for payment providers (Stripe, PayPal, etc.)
  async handlePaymentWebhook(provider: string, payload: any): Promise<void> {
    try {
      switch (provider) {
        case 'stripe':
          await this.handleStripeWebhook(payload);
          break;
        case 'pagarme':
          await this.handlePagarmeWebhook(payload);
          break;
        default:
          console.warn(`Unknown payment provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error handling ${provider} webhook:`, error);
      throw error;
    }
  }

  private async handleStripeWebhook(payload: any): Promise<void> {
    const { type, data } = payload;
    
    switch (type) {
      case 'invoice.payment_succeeded':
        await this.markInvoiceAsPaid(data.object.metadata.invoiceId);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data.object.metadata.tenantId);
        break;
    }
  }

  private async handlePagarmeWebhook(payload: any): Promise<void> {
    // Implementation for Brazilian payment provider
    const { event_type, transaction } = payload;
    
    switch (event_type) {
      case 'transaction_status_changed':
        if (transaction.status === 'paid') {
          await this.markInvoiceAsPaid(transaction.metadata.invoiceId);
        }
        break;
    }
  }

  private async markInvoiceAsPaid(invoiceId: string): Promise<void> {
    await this.db.query(`
      UPDATE billing_invoices 
      SET status = 'paid', paid_at = NOW() 
      WHERE id = $1
    `, [invoiceId]);
  }

  private async handlePaymentFailed(tenantId: string): Promise<void> {
    // Emit event for handling failed payments
    this.emitBillingEvent({
      tenantId,
      eventType: 'payment_due',
      data: { paymentFailed: true },
      timestamp: new Date()
    });
  }
}