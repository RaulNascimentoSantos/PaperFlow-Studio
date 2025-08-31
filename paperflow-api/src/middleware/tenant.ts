import { FastifyRequest, FastifyReply } from 'fastify';
import { TenantContext } from '../types/tenant';
import { getPlanConfig } from '../config/plans';
import { DatabaseService } from '../services/database';

export class TenantMiddleware {
  constructor(private db: DatabaseService) {}

  async extractTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Skip tenant validation for public endpoints
      const publicPaths = ['/v1/templates/marketplace'];
      const requestPath = request.url.split('?')[0]; // Remove query parameters
      if (publicPaths.includes(requestPath)) {
        return; // Continue without tenant context
      }
      
      // 1. Extrair tenant identifier
      const tenantId = this.extractTenantId(request);
      
      if (!tenantId) {
        return reply.code(400).send({
          error: 'MISSING_TENANT',
          message: 'Tenant ID is required. Use x-tenant-id header or custom domain.',
        });
      }

      // 2. Buscar tenant no banco
      const tenant = await this.getTenantById(tenantId);
      
      if (!tenant) {
        return reply.code(404).send({
          error: 'TENANT_NOT_FOUND',
          message: 'Tenant not found or inactive.',
        });
      }

      // 3. Verificar status do tenant
      if (tenant.status !== 'active') {
        const statusMessages = {
          suspended: 'Tenant suspended. Contact support.',
          deleted: 'Tenant no longer exists.',
        };
        
        return reply.code(403).send({
          error: 'TENANT_INACTIVE',
          message: statusMessages[tenant.status] || 'Tenant is not active.',
        });
      }

      // 4. Verificar rate limits específicos do plano
      const rateLimitPassed = await this.checkRateLimit(tenant, request);
      if (!rateLimitPassed) {
        return reply.code(429).send({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded for your plan.',
        });
      }

      // 5. Injetar contexto do tenant na requisição
      request.tenant = tenant;
      
    } catch (error) {
      request.log.error('Tenant middleware error:', error);
      return reply.code(500).send({
        error: 'TENANT_MIDDLEWARE_ERROR',
        message: 'Internal server error processing tenant context.',
      });
    }
  }

  private extractTenantId(request: FastifyRequest): string | null {
    // Prioridade 1: Header x-tenant-id
    const headerTenantId = request.headers['x-tenant-id'] as string;
    if (headerTenantId) {
      return headerTenantId;
    }

    // Prioridade 2: Custom domain
    const host = request.headers.host;
    if (host && !this.isMainDomain(host)) {
      return this.extractTenantFromDomain(host);
    }

    // Prioridade 3: Subdomain
    if (host) {
      const subdomain = this.extractSubdomain(host);
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }

    return null;
  }

  private isMainDomain(host: string): boolean {
    const mainDomains = [
      'paperflow.com.br',
      'api.paperflow.com.br',
      'localhost:3002',
      'localhost',
    ];
    
    return mainDomains.some(domain => host.includes(domain));
  }

  private extractTenantFromDomain(host: string): string | null {
    // Para custom domains, buscar no banco qual tenant possui esse domínio
    // Por enquanto, retornamos null e implementamos depois
    return null;
  }

  private extractSubdomain(host: string): string | null {
    const parts = host.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
    return null;
  }

  private async getTenantById(tenantId: string): Promise<TenantContext | null> {
    try {
      // Support multiple mock tenants for testing
      const mockTenants = ['demo-tenant', 'test-tenant-complete-v3', 'dev-tenant'];
      if (mockTenants.includes(tenantId)) {
        return this.createMockTenant(tenantId);
      }
      
      // Try database lookup
      try {
        const result = await this.db.query(
          'SELECT * FROM tenants WHERE id = $1 OR slug = $1 AND deleted_at IS NULL',
          [tenantId]
        );

        if (result.rows.length > 0) {
          return this.mapDatabaseToTenant(result.rows[0]);
        }
      } catch (dbError) {
        // Database might not be available in test/dev mode, log and continue with mock
        console.warn('Database query failed, using mock tenant:', dbError.message);
      }
      
      return null;
      
    } catch (error) {
      console.error('Error fetching tenant:', error);
      return null;
    }
  }

  private createMockTenant(tenantId: string = 'demo-tenant'): TenantContext {
    const planConfig = getPlanConfig('pro')!;
    
    const tenantNames = {
      'demo-tenant': 'Demo Company',
      'test-tenant-complete-v3': 'Test Company V3',
      'dev-tenant': 'Development Tenant'
    };
    
    return {
      tenantId,
      tenantName: tenantNames[tenantId] || 'Mock Company',
      slug: tenantId,
      plan: 'pro',
      quotas: {
        maxDocuments: planConfig.limits.documents,
        maxUsers: planConfig.limits.users,
        maxTemplates: planConfig.limits.templates,
        maxWebhooks: planConfig.limits.webhooks,
        maxStorageGB: planConfig.limits.storageGB,
        currentUsage: {
          documents: 5,
          users: 2,
          templates: 1,
          webhooks: 1,
          storageGB: 0.8,
        },
      },
      features: planConfig.features,
      billing: {
        allowOverage: planConfig.overage.allowed,
      },
      settings: {
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        currency: 'BRL',
        dateFormat: 'DD/MM/YYYY',
      },
      status: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };
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
      settings: row.settings || {
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        currency: 'BRL',
        dateFormat: 'DD/MM/YYYY',
      },
      status: row.deleted_at ? 'deleted' : (row.suspended_at ? 'suspended' : 'active'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suspendedAt: row.suspended_at,
      deletedAt: row.deleted_at,
    };
  }

  private async checkRateLimit(tenant: TenantContext, request: FastifyRequest): Promise<boolean> {
    const planConfig = getPlanConfig(tenant.plan);
    if (!planConfig) return false;

    const limit = planConfig.limits.apiCallsPerMinute;
    if (limit === -1) return true; // Unlimited for enterprise

    // Implementar rate limiting com Redis
    // Por enquanto, retornamos true
    return true;
  }
}

// Factory function para criar o middleware
export function createTenantMiddleware(db: DatabaseService) {
  const tenantMiddleware = new TenantMiddleware(db);
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await tenantMiddleware.extractTenant(request, reply);
  };
}