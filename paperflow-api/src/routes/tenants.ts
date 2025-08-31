import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TenantManager } from '@/services/tenant-manager';
import { QuotaManager } from '@/services/quota-manager';
import { DatabaseService } from '@/services/database';
import { createError } from '@/utils/errors';

// Schemas para validação
const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(63).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  plan: z.enum(['free', 'pro', 'business', 'enterprise']).default('free'),
  customDomain: z.string().optional(),
  settings: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.enum(['BRL', 'USD', 'EUR']).optional(),
    dateFormat: z.string().optional(),
  }).optional(),
  adminUser: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  plan: z.enum(['free', 'pro', 'business', 'enterprise']).optional(),
  customDomain: z.string().optional(),
  settings: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.enum(['BRL', 'USD', 'EUR']).optional(),
    dateFormat: z.string().optional(),
  }).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

const listTenantsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  plan: z.enum(['free', 'pro', 'business', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  search: z.string().optional(),
});

const tenantRoutes: FastifyPluginAsync = async function (fastify) {
  const db = new DatabaseService();
  const tenantManager = new TenantManager(db);
  const quotaManager = new QuotaManager(db);

  // Criar tenant (apenas para super admins)
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new tenant',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 3, maxLength: 63, pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$' },
            plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'], default: 'free' },
            customDomain: { type: 'string' },
            settings: {
              type: 'object',
              properties: {
                timezone: { type: 'string' },
                locale: { type: 'string' },
                currency: { type: 'string', enum: ['BRL', 'USD', 'EUR'] },
                dateFormat: { type: 'string' },
              },
            },
            adminUser: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
              },
              required: ['name', 'email', 'password'],
            },
          },
          required: ['name', 'slug', 'adminUser'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              slug: { type: 'string' },
              name: { type: 'string' },
              plan: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const data = createTenantSchema.parse(request.body);
        const tenant = await tenantManager.createTenant(data);

        return {
          tenantId: tenant.tenantId,
          slug: tenant.slug,
          name: tenant.tenantName,
          plan: tenant.plan,
          status: tenant.status,
          createdAt: tenant.createdAt,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError.badRequest('Validation error', error.errors);
        }
        
        if (error instanceof Error && error.message.includes('already exists')) {
          throw createError.conflict(error.message);
        }
        
        request.log.error('Error creating tenant:', error);
        
        // Em development, mostrar erro detalhado
        if (process.env.NODE_ENV === 'development') {
          throw createError.internalError(`Failed to create tenant: ${error.message}`);
        } else {
          throw createError.internalError('Failed to create tenant');
        }
      }
    }
  );

  // Listar tenants (apenas para super admins)
  fastify.get(
    '/',
    {
      schema: {
        description: 'List all tenants with pagination and filters',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'] },
            status: { type: 'string', enum: ['active', 'suspended'] },
            search: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tenants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tenantId: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    plan: { type: 'string' },
                    status: { type: 'string' },
                    customDomain: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const query = listTenantsSchema.parse(request.query);
        const result = await tenantManager.listTenants(query.page, query.limit, {
          plan: query.plan,
          status: query.status,
          search: query.search,
        });

        return {
          tenants: result.tenants.map(tenant => ({
            tenantId: tenant.tenantId,
            slug: tenant.slug,
            name: tenant.tenantName,
            plan: tenant.plan,
            status: tenant.status,
            customDomain: tenant.customDomain,
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        };
      } catch (error) {
        request.log.error('Error listing tenants:', error);
        throw createError.internalError('Failed to list tenants');
      }
    }
  );

  // Obter tenant específico
  fastify.get(
    '/:tenantId',
    {
      schema: {
        description: 'Get tenant details',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
          required: ['tenantId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              slug: { type: 'string' },
              name: { type: 'string' },
              plan: { type: 'string' },
              status: { type: 'string' },
              customDomain: { type: 'string' },
              quotas: {
                type: 'object',
                properties: {
                  maxDocuments: { type: 'number' },
                  maxUsers: { type: 'number' },
                  maxTemplates: { type: 'number' },
                  maxWebhooks: { type: 'number' },
                  maxStorageGB: { type: 'number' },
                  currentUsage: {
                    type: 'object',
                    properties: {
                      documents: { type: 'number' },
                      users: { type: 'number' },
                      templates: { type: 'number' },
                      webhooks: { type: 'number' },
                      storageGB: { type: 'number' },
                    },
                  },
                },
              },
              features: { type: 'object' },
              settings: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { tenantId } = request.params as { tenantId: string };
        const tenant = await tenantManager.getTenant(tenantId);

        if (!tenant) {
          throw createError.notFound('Tenant not found');
        }

        return tenant;
      } catch (error) {
        if (error.statusCode) throw error;
        
        request.log.error('Error getting tenant:', error);
        throw createError.internalError('Failed to get tenant');
      }
    }
  );

  // Atualizar tenant
  fastify.put(
    '/:tenantId',
    {
      schema: {
        description: 'Update tenant details',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
          required: ['tenantId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'] },
            customDomain: { type: 'string' },
            settings: {
              type: 'object',
              properties: {
                timezone: { type: 'string' },
                locale: { type: 'string' },
                currency: { type: 'string', enum: ['BRL', 'USD', 'EUR'] },
                dateFormat: { type: 'string' },
              },
            },
            status: { type: 'string', enum: ['active', 'suspended'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              slug: { type: 'string' },
              name: { type: 'string' },
              plan: { type: 'string' },
              status: { type: 'string' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { tenantId } = request.params as { tenantId: string };
        const data = updateTenantSchema.parse(request.body);
        
        const tenant = await tenantManager.updateTenant(tenantId, data);

        if (!tenant) {
          throw createError.notFound('Tenant not found');
        }

        return {
          tenantId: tenant.tenantId,
          slug: tenant.slug,
          name: tenant.tenantName,
          plan: tenant.plan,
          status: tenant.status,
          updatedAt: tenant.updatedAt,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError.badRequest('Validation error', error.errors);
        }
        if (error.statusCode) throw error;
        
        request.log.error('Error updating tenant:', error);
        throw createError.internalError('Failed to update tenant');
      }
    }
  );

  // Deletar tenant (soft delete)
  fastify.delete(
    '/:tenantId',
    {
      schema: {
        description: 'Delete tenant (soft delete)',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
          required: ['tenantId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              deletedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { tenantId } = request.params as { tenantId: string };
        const success = await tenantManager.deleteTenant(tenantId, true);

        if (!success) {
          throw createError.notFound('Tenant not found or already deleted');
        }

        return {
          message: 'Tenant deleted successfully',
          deletedAt: new Date().toISOString(),
        };
      } catch (error) {
        if (error.statusCode) throw error;
        
        request.log.error('Error deleting tenant:', error);
        throw createError.internalError('Failed to delete tenant');
      }
    }
  );

  // Obter uso/quotas do tenant
  fastify.get(
    '/:tenantId/usage',
    {
      schema: {
        description: 'Get tenant usage and quota information',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
          required: ['tenantId'],
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                current: { type: ['number', 'string'] },
                limit: { type: ['number', 'string'] },
                percentage: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { tenantId } = request.params as { tenantId: string };
        const usage = await quotaManager.getUsageSummary(tenantId);

        return usage;
      } catch (error) {
        request.log.error('Error getting tenant usage:', error);
        throw createError.internalError('Failed to get tenant usage');
      }
    }
  );

  // Resetar uso do tenant (para testes)
  fastify.post(
    '/:tenantId/usage/reset',
    {
      schema: {
        description: 'Reset tenant usage metrics',
        tags: ['Tenants'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
          required: ['tenantId'],
        },
        body: {
          type: 'object',
          properties: {
            resource: { type: 'string' },
          },
          required: ['resource'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              resource: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      try {
        const { tenantId } = request.params as { tenantId: string };
        const { resource } = request.body as { resource: string };
        
        await quotaManager.resetUsage(tenantId, resource);

        return {
          message: `Usage reset for resource: ${resource}`,
          resource,
        };
      } catch (error) {
        request.log.error('Error resetting tenant usage:', error);
        throw createError.internalError('Failed to reset tenant usage');
      }
    }
  );
};

export default tenantRoutes;