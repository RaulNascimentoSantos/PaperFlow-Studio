import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '@/middleware/auth';
import { aiService } from '@/services/ai';
import { UsageLogger } from '@/services/usage-logger';

const aiRoutes: FastifyPluginAsync = async function (fastify) {
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
};

export default aiRoutes;
