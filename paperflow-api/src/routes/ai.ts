import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '@/middleware/auth';
import { aiService } from '@/services/ai';
import { UsageLogger } from '@/services/usage-logger';
import { DocumentClassifier } from '../services/document-classifier';
import { SemanticSearchService } from '../services/semantic-search';
import { SetupAssistant } from '../services/setup-assistant';
import { DatabaseService } from '../services/database';
import { createError } from '../utils/errors';

const aiRoutes: FastifyPluginAsync = async function (fastify) {
  // Initialize AI services
  const db = new DatabaseService();
  const documentClassifier = new DocumentClassifier(db);
  const semanticSearch = new SemanticSearchService(db);
  const setupAssistant = new SetupAssistant(db);
  fastify.post(
    '/summarize',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Summarize a document',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['document_id'],
          properties: {
            document_id: { type: 'string' },
            type: { type: 'string', enum: ['executive', 'detailed', 'bullets'] },
            max_length: { type: 'number' },
            language: { type: 'string' },
            focus_areas: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              key_points: { type: 'array', items: { type: 'string' } },
              tokens_used: { type: 'number' },
              model: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { document_id, ...options } = request.body as { document_id: string };
      const result = await aiService.summarize(document_id, options);
      
      // Log usage
      await UsageLogger.logAISummary(
        request.user!.id,
        document_id,
        (options as any).type || 'executive',
        result.tokens_used,
        result.model
      );
      
      return result;
    }
  );

  fastify.post(
    '/query',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Query a document',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['document_id', 'question'],
          properties: {
            document_id: { type: 'string' },
            question: { type: 'string' },
            max_sources: { type: 'number' },
            min_confidence: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    snippet: { type: 'string' },
                    confidence: { type: 'number' },
                  },
                },
              },
              tokens_used: { type: 'number' },
              processing_time_ms: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const { document_id, question, ...options } = request.body as {
        document_id: string;
        question: string;
      };
      const result = await aiService.query(document_id, question, options);
      
      // Log usage
      await UsageLogger.logAIQuery(
        request.user!.id,
        document_id,
        question,
        result.tokens_used,
        result.processing_time_ms,
        'ai-model' // Will be updated when we get model info from result
      );
      
      return result;
    }
  );

  fastify.post(
    '/classify',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Classify a document',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['document_id', 'taxonomy'],
          properties: {
            document_id: { type: 'string' },
            taxonomy: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              classification: { type: 'string' },
              confidence: { type: 'number' },
              sub_type: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { document_id, taxonomy } = request.body as {
        document_id: string;
        taxonomy: string[];
      };
      const result = await aiService.classify(document_id, taxonomy);
      
      // Log usage
      await UsageLogger.logAIClassification(
        request.user!.id,
        document_id,
        result.classification,
        result.confidence,
        0, // Classification doesn't use tokens in our mock, will be updated
        'classification-model'
      );
      
      return result;
    }
  );

  // Enhanced document classification with AI features
  fastify.post(
    '/classify-enhanced',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Enhanced AI-powered document classification',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['document_id'],
          properties: {
            document_id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              classification: {
                type: 'object',
                properties: {
                  primaryType: { type: 'string' },
                  confidence: { type: 'number' },
                  suggestedTemplate: { type: 'string' },
                  extractedEntities: { type: 'array' }
                }
              },
              features: { type: 'object' },
              processingTime: { type: 'number' },
              suggestedActions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    async (request) => {
      const { document_id } = request.body as { document_id: string };
      const tenantId = request.user?.tenantId || 'default-tenant';
      
      // Get document from database
      const docResult = await db.query(
        'SELECT original_name, mime_type FROM documents WHERE id = $1',
        [document_id]
      );
      
      if (docResult.rows.length === 0) {
        throw createError.notFound('Document not found');
      }

      // Mock document buffer for classification
      const mockBuffer = Buffer.from('Mock document content for enhanced classification');
      const mimeType = docResult.rows[0].mime_type;

      const result = await documentClassifier.classifyDocument(
        mockBuffer,
        mimeType,
        tenantId
      );

      // Log usage for enhanced classification
      await UsageLogger.logAIClassification(
        request.user!.id,
        document_id,
        result.classification.primaryType,
        result.classification.confidence,
        0, // Mock tokens used
        'enhanced-classifier'
      );

      return result;
    }
  );

  // Semantic search endpoint
  fastify.post(
    '/search',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Semantic search across documents',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', minLength: 1 },
            limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
            offset: { type: 'number', minimum: 0, default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              results: { type: 'array' },
              total: { type: 'number' },
              query: { type: 'string' },
              processingTime: { type: 'number' }
            }
          }
        }
      }
    },
    async (request) => {
      const { query, limit = 10, offset = 0 } = request.body as { 
        query: string; limit?: number; offset?: number; 
      };
      const tenantId = request.user?.tenantId || 'default-tenant';
      
      const startTime = Date.now();
      
      const results = await semanticSearch.search(tenantId, query, {
        limit,
        offset
      });

      const processingTime = Date.now() - startTime;

      return {
        results,
        total: results.length,
        query,
        processingTime
      };
    }
  );

  // Setup assistant endpoint
  fastify.post(
    '/setup-assistant',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get personalized setup recommendations',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['industry', 'useCase'],
          properties: {
            industry: { 
              type: 'string',
              enum: ['legal', 'healthcare', 'finance', 'education', 'general']
            },
            useCase: { type: 'string' },
            companySize: { 
              type: 'string',
              enum: ['small', 'medium', 'large'],
              default: 'medium'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              recommendedTemplates: { type: 'array' },
              workflowSteps: { type: 'array' },
              integrations: { type: 'array' },
              complianceRequirements: { type: 'array' },
              estimatedSetupTime: { type: 'string' },
              expectedROI: { type: 'object' }
            }
          }
        }
      }
    },
    async (request) => {
      const { industry, useCase, companySize = 'medium' } = request.body as {
        industry: string;
        useCase: string;
        companySize?: 'small' | 'medium' | 'large';
      };
      const tenantId = request.user?.tenantId || 'default-tenant';

      const suggestions = await setupAssistant.suggestWorkflow(
        tenantId,
        industry,
        useCase,
        companySize
      );

      return suggestions;
    }
  );

  // Document similarity endpoint
  fastify.get(
    '/similar/:document_id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Find similar documents',
        tags: ['AI'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            document_id: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 20, default: 5 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              similarDocuments: { type: 'array' },
              sourceDocument: { type: 'string' }
            }
          }
        }
      }
    },
    async (request) => {
      const { document_id } = request.params as { document_id: string };
      const { limit = 5 } = request.query as { limit?: number };
      const tenantId = request.user?.tenantId || 'default-tenant';

      const similarDocuments = await semanticSearch.searchSimilarDocuments(
        document_id,
        tenantId,
        limit
      );

      return {
        similarDocuments: similarDocuments.filter(doc => doc.documentId !== document_id),
        sourceDocument: document_id
      };
    }
  );
};

export default aiRoutes;
