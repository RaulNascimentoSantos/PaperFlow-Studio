import { TenantContext, TenantQuotaCheck, TenantUsageMetrics } from '../types/tenant';
import { getPlanLimit, getOveragePricing } from '../config/plans';
import { DatabaseService } from './database';
import { EventEmitter } from 'events';

export interface UsageMetrics {
  name: string;
  value: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface QuotaExceededEvent {
  tenantId: string;
  resource: string;
  currentUsage: number;
  limit: number;
  overage: number;
}

export class QuotaManager extends EventEmitter {
  constructor(private db: DatabaseService) {
    super();
  }

  async checkQuota(
    tenantId: string, 
    resource: string, 
    amount: number = 1
  ): Promise<TenantQuotaCheck> {
    try {
      // Buscar tenant
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        return {
          allowed: false,
          current: 0,
          limit: 0,
          resource,
          tenantId,
          overageAllowed: false,
        };
      }

      // Buscar uso atual
      const currentUsage = await this.getCurrentUsageForResource(tenantId, resource);
      const limit = this.getLimit(tenant.plan, resource);

      // Verificar se vai exceder
      if (currentUsage + amount > limit) {
        // Emitir evento para upsell/notificação
        this.emit('quotaExceeded', {
          tenantId,
          resource,
          currentUsage,
          limit,
          overage: (currentUsage + amount) - limit,
        } as QuotaExceededEvent);

        // Se tem billing ativo, permitir overage com cobrança
        if (tenant.billing?.allowOverage && limit !== -1) {
          await this.recordOverage(tenantId, resource, (currentUsage + amount) - limit);
          await this.incrementUsage(tenantId, resource, amount);
          
          return {
            allowed: true,
            current: currentUsage + amount,
            limit,
            resource,
            tenantId,
            overageAllowed: true,
          };
        }

        return {
          allowed: false,
          current: currentUsage,
          limit,
          resource,
          tenantId,
          overageAllowed: false,
        };
      }

      // Dentro do limite, permitir
      await this.incrementUsage(tenantId, resource, amount);
      
      return {
        allowed: true,
        current: currentUsage + amount,
        limit,
        resource,
        tenantId,
        overageAllowed: tenant.billing?.allowOverage || false,
      };

    } catch (error) {
      console.error('Error checking quota:', error);
      return {
        allowed: false,
        current: 0,
        limit: 0,
        resource,
        tenantId,
        overageAllowed: false,
      };
    }
  }

  async recordUsage(tenantId: string, metrics: UsageMetrics): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO tenant_usage (tenant_id, metric_name, value, period_start, period_end, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (tenant_id, metric_name, period_start)
        DO UPDATE SET 
          value = tenant_usage.value + $3,
          created_at = NOW()
      `, [
        tenantId,
        metrics.name,
        metrics.value,
        metrics.periodStart,
        metrics.periodEnd,
      ]);
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  async getCurrentUsage(tenantId: string, resource: string): Promise<number> {
    try {
      // Para o período atual (mês corrente)
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const result = await this.db.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM tenant_usage
        WHERE tenant_id = $1 
          AND metric_name = $2
          AND period_start >= $3
          AND period_start < $4
      `, [tenantId, resource, currentMonth, nextMonth]);

      return parseInt(result.rows[0]?.total || '0');
      
    } catch (error) {
      console.error('Error getting current usage:', error);
      return 0;
    }
  }

  async getUsageHistory(
    tenantId: string, 
    resource: string, 
    months: number = 12
  ): Promise<TenantUsageMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const result = await this.db.query(`
        SELECT 
          tenant_id as "tenantId",
          metric_name as "metricName",
          value,
          period_start as "periodStart",
          period_end as "periodEnd",
          created_at as "createdAt"
        FROM tenant_usage
        WHERE tenant_id = $1 
          AND metric_name = $2
          AND period_start >= $3
        ORDER BY period_start DESC
      `, [tenantId, resource, startDate]);

      return result.rows;
      
    } catch (error) {
      console.error('Error getting usage history:', error);
      return [];
    }
  }

  async resetUsage(tenantId: string, resource: string): Promise<void> {
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      await this.db.query(`
        DELETE FROM tenant_usage
        WHERE tenant_id = $1 
          AND metric_name = $2
          AND period_start >= $3
      `, [tenantId, resource, currentMonth]);
      
    } catch (error) {
      console.error('Error resetting usage:', error);
      throw error;
    }
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

      // Mapear para TenantContext (implementação simplificada)
      const row = result.rows[0];
      return {
        tenantId: row.id,
        tenantName: row.name,
        slug: row.slug,
        plan: row.plan,
        quotas: row.quotas || {},
        features: row.features || {},
        billing: row.billing || {},
        settings: row.settings || {},
        status: row.deleted_at ? 'deleted' : (row.suspended_at ? 'suspended' : 'active'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        suspendedAt: row.suspended_at,
        deletedAt: row.deleted_at,
      } as TenantContext;
      
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  private getLimit(plan: string, resource: string): number {
    const resourceMap: Record<string, string> = {
      documents: 'documents',
      users: 'users',
      templates: 'templates',
      webhooks: 'webhooks',
      storage: 'storageGB',
    };

    const limitKey = resourceMap[resource] as any;
    return limitKey ? getPlanLimit(plan, limitKey) : 0;
  }

  private async incrementUsage(tenantId: string, resource: string, amount: number): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await this.recordUsage(tenantId, {
      name: resource,
      value: amount,
      periodStart,
      periodEnd,
    });
  }

  private async recordOverage(tenantId: string, resource: string, overage: number): Promise<void> {
    try {
      // Registrar overage para billing
      await this.db.query(`
        INSERT INTO tenant_overages (tenant_id, resource, amount, recorded_at)
        VALUES ($1, $2, $3, NOW())
      `, [tenantId, resource, overage]);

      // Emitir evento para sistema de billing
      this.emit('overageRecorded', {
        tenantId,
        resource,
        amount: overage,
        recordedAt: new Date(),
      });
      
    } catch (error) {
      console.error('Error recording overage:', error);
      // Não falhar a operação principal por erro de overage
    }
  }

  // Método para verificar se tenant pode usar uma feature
  async canUseFeature(tenantId: string, feature: string): Promise<boolean> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return false;

      // Verificar se a feature está habilitada no plano
      const featureKey = feature as keyof TenantContext['features'];
      return tenant.features[featureKey] || false;
      
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Método para obter resumo de uso atual
  async getUsageSummary(tenantId: string): Promise<Record<string, { current: number; limit: number; percentage: number }>> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return {};

      const resources = ['documents', 'users', 'templates', 'webhooks', 'storage'];
      const summary: Record<string, any> = {};

      for (const resource of resources) {
        const current = await this.getCurrentUsageForResource(tenantId, resource);
        const limit = this.getLimit(tenant.plan, resource);
        const percentage = limit === -1 ? 0 : (current / limit) * 100;

        summary[resource] = {
          current,
          limit: limit === -1 ? 'unlimited' : limit,
          percentage: Math.min(percentage, 100),
        };
      }

      return summary;
      
    } catch (error) {
      console.error('Error getting usage summary:', error);
      return {};
    }
  }

  // Method needed by billing routes - get current usage for all resources
  async getCurrentUsage(tenantId: string): Promise<Record<string, number>>;
  async getCurrentUsage(tenantId: string, resource?: string): Promise<number | Record<string, number>> {
    if (resource) {
      // Original single resource method
      return this.getCurrentUsageForResource(tenantId, resource);
    }

    // New method for all resources
    try {
      const resources = ['documents', 'users', 'templates', 'webhooks', 'storageGB', 'apiCalls'];
      const usage: Record<string, number> = {};

      for (const resourceName of resources) {
        usage[resourceName] = await this.getCurrentUsageForResource(tenantId, resourceName);
      }

      return usage;
    } catch (error) {
      console.error('Error getting current usage for all resources:', error);
      return {};
    }
  }

  // Renamed original method to avoid overload conflicts
  private async getCurrentUsageForResource(tenantId: string, resource: string): Promise<number> {
    try {
      // Para o período atual (mês corrente)
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const result = await this.db.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM tenant_usage
        WHERE tenant_id = $1 
          AND metric_name = $2
          AND period_start >= $3
          AND period_start < $4
      `, [tenantId, resource, currentMonth, nextMonth]);

      return parseInt(result.rows[0]?.total || '0');
      
    } catch (error) {
      console.error('Error getting current usage:', error);
      return 0;
    }
  }

  // Method to get tenant quotas/limits
  async getTenantQuotas(tenantId: string): Promise<Record<string, number>> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        return {};
      }

      const resources = ['documents', 'users', 'templates', 'webhooks', 'storageGB', 'apiCalls'];
      const quotas: Record<string, number> = {};

      for (const resource of resources) {
        quotas[resource] = this.getLimit(tenant.plan, resource);
      }

      return quotas;
    } catch (error) {
      console.error('Error getting tenant quotas:', error);
      return {};
    }
  }
}