import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { DocumentService } from '@/services/document';
import { BatesNumberingService } from '@/services/bates';
import { PIIDetectorService } from '@/services/pii-detector';
import { WebhookService } from '@/services/webhook';
import { CustodyChainService } from '@/services/custody-chain';
import { createError } from '@/utils/errors';

const documentRoutes: FastifyPluginAsync = async function (fastify) {
  fastify.post(
    '/upload',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Upload a PDF document for processing',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              document_id: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const data = await request.file();

      if (!data) {
        throw createError.badRequest('No file uploaded');
      }

      // Convert stream to buffer
      const buffer = await data.toBuffer();
      const fileData = {
        filename: data.filename,
        mimetype: data.mimetype,
        data: buffer,
      };

      const document = await DocumentService.createDocument(request.user!.id, fileData);

      return {
        document_id: document.id,
        status: document.status,
      };
    }
  );

  // List user documents
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List user documents',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              documents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    original_name: { type: 'string' },
                    status: { type: 'string' },
                    size_bytes: { type: 'number' },
                    pages: { type: 'number' },
                    created_at: { type: 'string' },
                    processed_at: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const documents = await DocumentService.getUserDocuments(request.user!.id);
      return {
        documents: documents,
        total: documents.length,
      };
    }
  );

  fastify.get(
    '/:id/extract',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get extracted data from a document',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              document_id: { type: 'string' },
              pages: { type: 'number' },
              text: { type: 'string' },
              tables: { type: 'array' },
              metadata: { type: 'object' },
              processing_time_ms: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const document = await DocumentService.getDocument(id);

      if (!document) {
        throw createError.notFound('Document');
      }

      // Return extracted content including tables from metadata
      const tables = document.metadata?.tables || [];
      
      return {
        document_id: document.id,
        pages: document.pages || 0,
        text: document.extracted_text || '',
        tables: tables,
        metadata: {
          title: document.metadata?.title,
          author: document.metadata?.author,
          creator: document.metadata?.creator,
          pdf_version: document.metadata?.pdf_version,
          creation_date: document.metadata?.creation_date,
          word_count: document.metadata?.word_count,
          char_count: document.metadata?.char_count,
          tables_count: document.metadata?.tables_count,
          processing_info: document.metadata?.processing_info,
        },
        processing_time_ms: document.processing_time_ms || 0,
      };
    }
  );

  // SSE endpoint for real-time document processing updates
  fastify.get(
    '/:id/events',
    {
      schema: {
        description: 'Subscribe to document processing events via Server-Sent Events',
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'Server-Sent Events stream'
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { apiKey } = request.query as { apiKey?: string };
      const headerKey = request.headers['x-api-key'] as string | undefined;
      const key = headerKey ?? apiKey;
      
      if (!key) {
        throw createError.unauthorized('Missing API key');
      }
      
      // Validate API key manually since we bypass authenticate middleware for SSE
      const { AuthService } = await import('@/services/auth');
      const user = await AuthService.validateApiKey(key);
      if (!user) {
        throw createError.unauthorized('Invalid API key');
      }

      // Set SSE headers
      reply.type('text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Headers', 'Cache-Control');

      // Support for Last-Event-ID for reconnection
      let eventId = Number(request.headers['last-event-id'] ?? 0) || 0;

      // Send retry directive
      reply.raw.write('retry: 3000\n\n');

      // Send initial connection event
      eventId++;
      reply.raw.write(`id: ${eventId}\n`);
      reply.raw.write(`event: connected\n`);
      reply.raw.write(`data: ${JSON.stringify({
        type: 'connected',
        documentId: id,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (!reply.raw.destroyed) {
          reply.raw.write(`:heartbeat ${Date.now()}\n\n`);
        }
      }, 15000);

      // Mock processing stages for demonstration
      const stages = [
        { stage: 'queued', progress: 0, message: 'Document queued for processing' },
        { stage: 'parsing', progress: 20, message: 'Parsing PDF structure' },
        { stage: 'extracting', progress: 40, message: 'Extracting text content' },
        { stage: 'tables', progress: 60, message: 'Extracting tables' },
        { stage: 'ocr', progress: 75, message: 'Performing OCR (if needed)' },
        { stage: 'embeddings', progress: 90, message: 'Generating embeddings' },
        { stage: 'completed', progress: 100, message: 'Processing completed' }
      ];

      // Start from the event after Last-Event-ID if reconnecting
      let currentStage = Math.max(0, eventId - 1);
      
      // Simulate processing stages
      const interval = setInterval(() => {
        if (currentStage < stages.length && !reply.raw.destroyed) {
          eventId++;
          const stageData = {
            type: 'progress',
            documentId: id,
            stage: stages[currentStage].stage,
            progress: stages[currentStage].progress,
            message: stages[currentStage].message,
            timestamp: new Date().toISOString()
          };

          reply.raw.write(`id: ${eventId}\n`);
          reply.raw.write(`event: progress\n`);
          reply.raw.write(`data: ${JSON.stringify(stageData)}\n\n`);
          currentStage++;

          if (currentStage >= stages.length) {
            // Send final completion event
            eventId++;
            reply.raw.write(`id: ${eventId}\n`);
            reply.raw.write(`event: completed\n`);
            reply.raw.write(`data: ${JSON.stringify({
              type: 'completed',
              documentId: id,
              stage: 'completed',
              progress: 100,
              message: 'Document processing completed successfully',
              timestamp: new Date().toISOString()
            })}\n\n`);

            clearInterval(interval);
            clearInterval(heartbeat);
          }
        }
      }, 1000); // Send update every second

      // Clean up on connection close
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(heartbeat);
      };
      
      request.raw.on('close', cleanup);
      request.raw.on('end', cleanup);
      request.raw.on('error', cleanup);
    }
  );

  // Aplicar numeração Bates
  fastify.post(
    '/:id/bates',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Apply Bates numbering to document',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({
          prefix: z.string().min(1).max(20),
          startNumber: z.number().min(1).max(999999),
          position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
          fontSize: z.number().min(6).max(72).optional(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const options = request.body as any;
      
      const result = await BatesNumberingService.applyBatesNumbers(id, options);
      
      // Trigger webhook
      await WebhookService.trigger(request.user!.id, 'bates.completed', {
        documentId: id,
        ...result,
      });
      
      return result;
    }
  );

  // Detectar PII no documento
  fastify.get(
    '/:id/redact/preview',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Preview PII detection results',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const analysis = await PIIDetectorService.analyzeDocument(id);
      return analysis;
    }
  );

  // Aplicar redação de PII
  fastify.post(
    '/:id/redact',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Apply PII redaction to document',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({
          applyAll: z.boolean().optional(),
          selectedTypes: z.array(z.string()).optional(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { selectedTypes = [] } = request.body as any;
      
      const result = await PIIDetectorService.redactDocument(id, selectedTypes);
      
      // Trigger webhook
      await WebhookService.trigger(request.user!.id, 'redaction.completed', {
        documentId: id,
        ...result,
      });
      
      return result;
    }
  );

  // Gerar manifest de cadeia de custódia
  fastify.get(
    '/:id/manifest',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate custody chain manifest',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const manifest = await CustodyChainService.generateManifest(id);
      return manifest;
    }
  );

  // Verificar integridade da cadeia de custódia
  fastify.get(
    '/:id/verify',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Verify custody chain integrity',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const verification = await CustodyChainService.verifyChain(id);
      return verification;
    }
  );

  // Exportar dossiê de evidências
  fastify.post(
    '/:id/evidence/export',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Export evidence package',
        tags: ['Documents'],
        security: [{ ApiKeyAuth: [] }],
        params: z.object({ id: z.string() }),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      
      // Gerar manifest
      const manifest = await CustodyChainService.generateManifest(id);
      
      // Simular criação do pacote de evidências
      const packageId = `pkg_${Date.now()}`;
      const downloadUrl = `/v1/evidence/${packageId}/download`;
      
      // Trigger webhook
      await WebhookService.trigger(request.user!.id, 'evidence.exported', {
        documentId: id,
        packageId,
        manifest,
      });
      
      return {
        packageId,
        sha256: manifest.document.hash,
        downloadUrl,
        files: [
          'original.pdf',
          'bates.pdf',
          'manifest.json',
          'audit_log.json'
        ],
      };
    }
  );
};

export default documentRoutes;
