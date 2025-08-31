import { TenantContext, CreateTenantRequest, UpdateTenantRequest } from '../types/tenant';
import { getPlanConfig } from '../config/plans';
import { DatabaseService } from './database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class TenantManager {
  constructor(private db: DatabaseService) {}

  async createTenant(request: CreateTenantRequest): Promise<TenantContext> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      // 1. Validar dados
      await this.validateTenantCreation(request);

      // 2. Criar tenant
      const tenantId = crypto.randomUUID();
      const planConfig = getPlanConfig(request.plan || 'free')!;
      
      const tenantResult = await client.query(`
        INSERT INTO tenants (
          id, slug, name, plan, custom_domain, settings, quotas, billing
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        tenantId,
        request.slug,
        request.name,
        request.plan || 'free',
        request.customDomain,
        JSON.stringify(request.settings || this.getDefaultSettings()),
        JSON.stringify(this.getInitialQuotas(planConfig)),
        JSON.stringify(this.getInitialBilling(planConfig)),
      ]);

      // 3. Criar usuário admin
      const hashedPassword = await bcrypt.hash(request.adminUser.password, 12);
      
      await client.query(`
        INSERT INTO users (
          tenant_id, name, email, password_hash, role, active
        ) VALUES ($1, $2, $3, $4, 'admin', true)
      `, [
        tenantId,
        request.adminUser.name,
        request.adminUser.email,
        hashedPassword,
      ]);

      // 4. Inicializar métricas de uso
      await this.initializeUsageMetrics(tenantId);

      // 5. Audit log
      await this.recordAuditEvent(tenantId, 'tenant_created', {
        tenantId,
        name: request.name,
        plan: request.plan || 'free',
        adminUser: request.adminUser.email,
      });

      await client.query('COMMIT');

      // 6. Retornar tenant criado
      return this.mapDatabaseToTenant(tenantResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTenant(tenantId: string): Promise<TenantContext | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM tenants WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToTenant(result.rows[0]);
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  async updateTenant(tenantId: string, request: UpdateTenantRequest): Promise<TenantContext | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (request.name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(request.name);
      }

      if (request.plan) {
        updates.push(`plan = $${paramIndex++}`);
        values.push(request.plan);
        
        // Atualizar quotas baseado no novo plano
        const planConfig = getPlanConfig(request.plan);
        if (planConfig) {
          updates.push(`quotas = quotas || $${paramIndex++}::jsonb`);
          values.push(JSON.stringify(this.getInitialQuotas(planConfig)));
        }
      }

      if (request.customDomain !== undefined) {
        updates.push(`custom_domain = $${paramIndex++}`);
        values.push(request.customDomain);
      }

      if (request.settings) {
        updates.push(`settings = settings || $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(request.settings));
      }

      if (request.status === 'suspended') {
        updates.push(`suspended_at = NOW()`);
      } else if (request.status === 'active') {
        updates.push(`suspended_at = NULL`);
      }

      if (updates.length === 0) {
        return this.getTenant(tenantId);
      }

      updates.push(`updated_at = NOW()`);
      values.push(tenantId);

      const query = `
        UPDATE tenants 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      // Audit log
      await this.recordAuditEvent(tenantId, 'tenant_updated', request);

      return this.mapDatabaseToTenant(result.rows[0]);

    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async deleteTenant(tenantId: string, softDelete: boolean = true): Promise<boolean> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      if (softDelete) {
        // Soft delete - apenas marcar como deletado
        await client.query(
          'UPDATE tenants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
          [tenantId]
        );
      } else {
        // Hard delete - remover completamente (cuidado!)
        await client.query('DELETE FROM tenant_usage WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM tenant_overages WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM documents WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM webhooks WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM audit_log WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      }

      // Audit log
      await this.recordAuditEvent(tenantId, 'tenant_deleted', { 
        softDelete,
        timestamp: new Date() 
      });

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting tenant:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async listTenants(
    page: number = 1,
    limit: number = 20,
    filters: { plan?: string; status?: string; search?: string } = {}
  ): Promise<{ tenants: TenantContext[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = ['deleted_at IS NULL'];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.plan) {
        conditions.push(`plan = $${paramIndex++}`);
        values.push(filters.plan);
      }

      if (filters.status) {
        if (filters.status === 'active') {
          conditions.push('suspended_at IS NULL');
        } else if (filters.status === 'suspended') {
          conditions.push('suspended_at IS NOT NULL');
        }
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${paramIndex++} OR slug ILIKE $${paramIndex++})`);
        values.push(`%${filters.search}%`, `%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM tenants ${whereClause}`,
        values
      );

      // Get tenants
      values.push(limit, offset);
      const result = await this.db.query(
        `SELECT * FROM tenants ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        values
      );

      return {
        tenants: result.rows.map(row => this.mapDatabaseToTenant(row)),
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
      };

    } catch (error) {
      console.error('Error listing tenants:', error);
      return { tenants: [], total: 0, page, limit };
    }
  }

  private async validateTenantCreation(request: CreateTenantRequest): Promise<void> {
    // Validar slug único
    const existingSlug = await this.db.query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [request.slug]
    );

    if (existingSlug.rows.length > 0) {
      throw new Error(`Slug '${request.slug}' already exists`);
    }

    // Validar domínio customizado único (se fornecido)
    if (request.customDomain) {
      const existingDomain = await this.db.query(
        'SELECT id FROM tenants WHERE custom_domain = $1 AND deleted_at IS NULL',
        [request.customDomain]
      );

      if (existingDomain.rows.length > 0) {
        throw new Error(`Custom domain '${request.customDomain}' already exists`);
      }
    }

    // Validar email admin único
    const existingEmail = await this.db.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [request.adminUser.email]
    );

    if (existingEmail.rows.length > 0) {
      throw new Error(`Email '${request.adminUser.email}' already exists`);
    }
  }

  private getDefaultSettings() {
    return {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      currency: 'BRL',
      dateFormat: 'DD/MM/YYYY',
    };
  }

  private getInitialQuotas(planConfig: any) {
    return {
      currentUsage: {
        documents: 0,
        users: 1, // Admin user
        templates: 0,
        webhooks: 0,
        storageGB: 0,
      },
    };
  }

  private getInitialBilling(planConfig: any) {
    return {
      allowOverage: planConfig.overage?.allowed || false,
    };
  }

  private async initializeUsageMetrics(tenantId: string): Promise<void> {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const metrics = ['documents', 'users', 'templates', 'webhooks', 'storage'];

    for (const metric of metrics) {
      await this.db.query(`
        INSERT INTO tenant_usage (tenant_id, metric_name, value, period_start, period_end)
        VALUES ($1, $2, $3, $4, $5)
      `, [tenantId, metric, metric === 'users' ? 1 : 0, currentMonth, nextMonth]);
    }
  }

  private async recordAuditEvent(tenantId: string, eventType: string, data: any): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO audit_log (tenant_id, event_type, event_data, actor, ip_address)
        VALUES ($1, $2, $3, 'system', '127.0.0.1')
      `, [tenantId, eventType, JSON.stringify(data)]);
    } catch (error) {
      console.error('Error recording audit event:', error);
      // Não falhar a operação principal
    }
  }

  private mapDatabaseToTenant(row: any): TenantContext {
    const planConfig = getPlanConfig(row.plan) || getPlanConfig('free')!;
    
    return {
      tenantId: row.id,
      tenantName: row.name,
      slug: row.slug,
      plan: row.plan,
      customDomain: row.custom_domain,
      quotas: {
        maxDocuments: planConfig.limits.documents,
        maxUsers: planConfig.limits.users,
        maxTemplates: planConfig.limits.templates,
        maxWebhooks: planConfig.limits.webhooks,
        maxStorageGB: planConfig.limits.storageGB,
        currentUsage: row.quotas?.currentUsage || {
          documents: 0,
          users: 0,
          templates: 0,
          webhooks: 0,
          storageGB: 0,
        },
      },
      features: planConfig.features,
      billing: row.billing || { allowOverage: planConfig.overage.allowed },
      settings: row.settings || this.getDefaultSettings(),
      status: row.deleted_at ? 'deleted' : (row.suspended_at ? 'suspended' : 'active'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suspendedAt: row.suspended_at,
      deletedAt: row.deleted_at,
    };
  }
}