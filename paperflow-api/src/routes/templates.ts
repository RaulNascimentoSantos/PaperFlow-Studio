import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TemplateEngine } from '@/services/template-engine';
import { QuotaManager } from '@/services/quota-manager';
import { DatabaseService } from '@/services/database';
import { createError } from '@/utils/errors';
import { 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateMarketplaceFilter 
} from '@/types/templates';

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(3).max(500),
  slug: z.string().min(3).max(255).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  description: z.string().max(2000),
  category: z.enum(['hr', 'finance', 'legal', 'compliance', 'procurement', 'sales']),
  icon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'tenant', 'public', 'marketplace']).optional(),
  workflow: z.object({
    steps: z.array(z.object({
      name: z.string(),
      type: z.enum(['upload', 'validation', 'extraction', 'approval', 'signature', 'package', 'integration', 'ai_analysis', 'ocr', 'webhook', 'notification']),
      order: z.number(),
      required: z.boolean(),
      config: z.record(z.any()),
      conditions: z.array(z.any()).optional(),
      retryPolicy: z.any().optional(),
      timeout: z.number().optional(),
      dependencies: z.array(z.string()).optional(),
    })).min(1)
  }),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'file', 'email', 'phone', 'url', 'json']),
    required: z.boolean(),
    defaultValue: z.any().optional(),
    placeholder: z.string().optional(),
    description: z.string().optional(),
    options: z.array(z.any()).optional(),
    validation: z.any().optional(),
    extraction: z.any().optional(),
    display: z.any().optional(),
  })),
  validations: z.array(z.any()).optional(),
  piiDetection: z.object({
    enabled: z.boolean(),
    patterns: z.array(z.string()),
    redactionStrategy: z.enum(['full', 'partial', 'custom'])
  }).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().omit(['slug']);

const executeTemplateSchema = z.object({
  documentId: z.string(),
  inputData: z.record(z.any()).optional(),
});

const templateListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.enum(['hr', 'finance', 'legal', 'compliance', 'procurement', 'sales']).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'tenant', 'public', 'marketplace']).optional(),
  search: z.string().optional(),
});

const templatesRoutes: FastifyPluginAsync = async function (fastify) {
  const db = new DatabaseService();
  const quotaManager = new QuotaManager(db);
  const templateEngine = new TemplateEngine(db, quotaManager);

  // Criar template
  fastify.post(
    '/',
    {
      preHandler: async (request) => {
        // Tenant middleware já aplicado - verificar se tenant tem permissão para criar templates
        const canCreate = await quotaManager.canUseFeature(request.tenant.tenantId, 'templatesEnabled');
        if (!canCreate) {
          throw createError.forbidden('Template creation not available in your plan');
        }
      },
      schema: {
        description: 'Create a new document template',
        tags: ['Templates'],
        security: [{ ApiKeyAuth: [] }],
        headers: {
          type: 'object',
          properties: {
            'x-tenant-id': { type: 'string' }
          },
          required: ['x-tenant-id']
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 500 },
            slug: { type: 'string', minLength: 3, maxLength: 255, pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$' },
            description: { type: 'string', maxLength: 2000 },
            category: { type: 'string', enum: ['hr', 'finance', 'legal', 'compliance', 'procurement', 'sales'] },
            icon: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            visibility: { type: 'string', enum: ['private', 'tenant', 'public', 'marketplace'], default: 'tenant' },
            workflow: {
              type: 'object',
              properties: {
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string', enum: ['upload', 'validation', 'extraction', 'approval', 'signature', 'package', 'integration', 'ai_analysis', 'ocr', 'webhook', 'notification'] },
                      order: { type: 'number' },
                      required: { type: 'boolean' },
                      config: { type: 'object' }
                    },
                    required: ['name', 'type', 'order', 'required', 'config']
                  },
                  minItems: 1
                }
              },
              required: ['steps']
            },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  label: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'file', 'email', 'phone', 'url', 'json'] },
                  required: { type: 'boolean' }
                },
                required: ['name', 'label', 'type', 'required']
              }
            }
          },
          required: ['name', 'slug', 'description', 'category', 'workflow', 'fields']
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string' },
              name: { type: 'string' },
              category: { type: 'string' },
              visibility: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const data = createTemplateSchema.parse(request.body);
        const template = await templateEngine.createTemplate(request.tenant.tenantId, data);

        return {
          id: template.id,
          slug: template.slug,
          name: template.name,
          category: template.category,
          visibility: template.visibility,
          createdAt: template.createdAt,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError.badRequest('Validation error', error.errors);
        }
        
        if (error.message.includes('quota exceeded')) {
          throw createError.forbidden(error.message);
        }
        
        if (error.message.includes('already exists')) {
          throw createError.conflict(error.message);
        }
        
        request.log.error('Error creating template:', error);
        throw createError.internalError('Failed to create template');
      }
    }
  );

  // Listar templates
  fastify.get(
    '/',
    {
      schema: {
        description: 'List available templates with filtering and pagination',
        tags: ['Templates'],
        security: [{ ApiKeyAuth: [] }],
        headers: {
          type: 'object',
          properties: {
            'x-tenant-id': { type: 'string' }
          },
          required: ['x-tenant-id']
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            category: { type: 'string', enum: ['hr', 'finance', 'legal', 'compliance', 'procurement', 'sales'] },
            visibility: { type: 'string', enum: ['private', 'tenant', 'public', 'marketplace'] },
            search: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              templates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    icon: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    visibility: { type: 'string' },
                    metrics: {
                      type: 'object',
                      properties: {
                        usageCount: { type: 'number' },
                        rating: { type: 'number' },
                        reviews: { type: 'number' }
                      }
                    },
                    createdAt: { type: 'string', format: 'date-time' }
                  }
                }
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const query = templateListSchema.parse(request.query);
        const result = await templateEngine.listTemplates(
          request.tenant.tenantId,
          {
            category: query.category,
            tags: query.tags,
            visibility: query.visibility,
            search: query.search,
          },
          query.page,
          query.limit
        );

        return {
          templates: result.templates.map(template => ({
            id: template.id,
            slug: template.slug,
            name: template.name,
            description: template.description,
            category: template.category,
            icon: template.icon,
            tags: template.tags,
            visibility: template.visibility,
            metrics: {
              usageCount: template.metrics.usageCount,
              rating: template.metrics.rating,
              reviews: template.metrics.reviews,
            },
            createdAt: template.createdAt,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        };
      } catch (error) {
        request.log.error('Error listing templates:', error);
        throw createError.internalError('Failed to list templates');
      }
    }
  );

  // Obter template específico
  fastify.get(
    '/:templateId',
    {
      schema: {
        description: 'Get template details',
        tags: ['Templates'],
        security: [{ ApiKeyAuth: [] }],
        headers: {
          type: 'object',
          properties: {
            'x-tenant-id': { type: 'string' }
          },
          required: ['x-tenant-id']
        },
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string' }
          },
          required: ['templateId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              icon: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              visibility: { type: 'string' },
              workflow: { type: 'object', additionalProperties: true },
              fields: { type: 'array', items: { type: 'object', additionalProperties: true } },
              validations: { type: 'array', items: { type: 'object', additionalProperties: true } },
              piiDetection: { type: 'object', additionalProperties: true },
              metrics: { type: 'object', additionalProperties: true },
              version: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const { templateId } = request.params as { templateId: string };
        const template = await templateEngine.getTemplate(templateId, request.tenant.tenantId);

        if (!template) {
          throw createError.notFound('Template not found');
        }

        return template;
      } catch (error) {
        if (error.statusCode) throw error;
        
        request.log.error('Error getting template:', error);
        throw createError.internalError('Failed to get template');
      }
    }
  );

  // Executar template
  fastify.post(
    '/:templateId/execute',
    {
      schema: {
        description: 'Execute template workflow with document',
        tags: ['Templates'],
        security: [{ ApiKeyAuth: [] }],
        headers: {
          type: 'object',
          properties: {
            'x-tenant-id': { type: 'string' }
          },
          required: ['x-tenant-id']
        },
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string' }
          },
          required: ['templateId']
        },
        body: {
          type: 'object',
          properties: {
            documentId: { type: 'string' },
            inputData: { type: 'object' }
          },
          required: ['documentId']
        },
        response: {
          201: {
            type: 'object',
            properties: {
              executionId: { type: 'string' },
              templateId: { type: 'string' },
              documentId: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const { templateId } = request.params as { templateId: string };
        const data = executeTemplateSchema.parse(request.body);
        
        // Check document quota
        const quotaCheck = await quotaManager.checkQuota(request.tenant.tenantId, 'documents', 1);
        if (!quotaCheck.allowed) {
          throw createError.forbidden('Document processing quota exceeded');
        }

        const execution = await templateEngine.executeTemplate(
          templateId,
          request.tenant.tenantId,
          data.documentId,
          'current-user-id', // TODO: Get from auth context
          data.inputData || {}
        );

        return {
          executionId: execution.id,
          templateId: execution.templateId,
          documentId: execution.documentId,
          status: execution.status,
          createdAt: execution.createdAt,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError.badRequest('Validation error', error.errors);
        }
        
        if (error.message.includes('quota exceeded')) {
          throw createError.forbidden(error.message);
        }
        
        if (error.message.includes('not found')) {
          throw createError.notFound(error.message);
        }
        
        request.log.error('Error executing template:', error);
        throw createError.internalError('Failed to execute template');
      }
    }
  );

  // Obter status da execução
  fastify.get(
    '/executions/:executionId',
    {
      schema: {
        description: 'Get template execution status and results',
        tags: ['Templates'],
        security: [{ ApiKeyAuth: [] }],
        headers: {
          type: 'object',
          properties: {
            'x-tenant-id': { type: 'string' }
          },
          required: ['x-tenant-id']
        },
        params: {
          type: 'object',
          properties: {
            executionId: { type: 'string' }
          },
          required: ['executionId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              templateId: { type: 'string' },
              documentId: { type: 'string' },
              status: { type: 'string' },
              currentStep: { type: 'string' },
              stepResults: { type: 'object' },
              data: { type: 'object' },
              errors: { type: 'array' },
              metrics: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              completedAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const { executionId } = request.params as { executionId: string };
        
        const result = await db.query(
          `SELECT * FROM template_executions 
           WHERE id = $1 AND tenant_id = $2`,
          [executionId, request.tenant.tenantId]
        );

        if (result.rows.length === 0) {
          throw createError.notFound('Execution not found');
        }

        const execution = result.rows[0];
        
        return {
          id: execution.id,
          templateId: execution.template_id,
          documentId: execution.document_id,
          status: execution.status,
          currentStep: execution.current_step,
          stepResults: typeof execution.step_results === 'string' ? JSON.parse(execution.step_results) : execution.step_results,
          data: typeof execution.data === 'string' ? JSON.parse(execution.data) : execution.data,
          errors: typeof execution.errors === 'string' ? JSON.parse(execution.errors) : execution.errors,
          metrics: typeof execution.metrics === 'string' ? JSON.parse(execution.metrics) : execution.metrics,
          createdAt: execution.created_at,
          updatedAt: execution.updated_at,
          completedAt: execution.completed_at,
        };
      } catch (error) {
        if (error.statusCode) throw error;
        
        request.log.error('Error getting execution:', error);
        throw createError.internalError('Failed to get execution status');
      }
    }
  );

  // Template marketplace - listar templates públicos
  fastify.get(
    '/marketplace',
    {
      schema: {
        description: 'Browse public templates marketplace',
        tags: ['Templates'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            category: { type: 'string', enum: ['hr', 'finance', 'legal', 'compliance', 'procurement', 'sales'] },
            search: { type: 'string' },
            popular: { type: 'boolean' },
            recent: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              templates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    icon: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    metrics: {
                      type: 'object',
                      properties: {
                        usageCount: { type: 'number' },
                        rating: { type: 'number' },
                        reviews: { type: 'number' }
                      }
                    },
                    marketplace: {
                      type: 'object',
                      properties: {
                        price: { type: 'number' },
                        currency: { type: 'string' },
                        purchaseCount: { type: 'number' }
                      }
                    }
                  }
                }
              },
              pagination: { type: 'object' }
            }
          }
        }
      }
    },
    async (request) => {
      try {
        const query = templateListSchema.parse(request.query);
        
        // Force visibility to marketplace and public only
        const result = await templateEngine.listTemplates(
          '', // No tenant filter for marketplace
          {
            category: query.category,
            visibility: 'public', // Only public templates in marketplace
            search: query.search,
          },
          query.page,
          query.limit
        );

        return {
          templates: result.templates.map(template => ({
            id: template.id,
            slug: template.slug,
            name: template.name,
            description: template.description,
            category: template.category,
            icon: template.icon,
            tags: template.tags,
            metrics: {
              usageCount: template.metrics.usageCount,
              rating: template.metrics.rating,
              reviews: template.metrics.reviews,
            },
            marketplace: template.marketplace,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        };
      } catch (error) {
        request.log.error('Error listing marketplace templates:', error);
        throw createError.internalError('Failed to list marketplace templates');
      }
    }
  );
};

export default templatesRoutes;