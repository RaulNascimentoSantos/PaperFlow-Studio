import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '@/middleware/auth';
import { DocumentService } from '@/services/document';
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
      preHandler: [authenticate],
      schema: {
        description: 'Subscribe to document processing events via Server-Sent Events',
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
            type: 'string',
            description: 'Server-Sent Events stream'
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      
      // Set SSE headers
      reply.type('text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Headers', 'Cache-Control');

      // Send initial connection event
      reply.raw.write(`data: ${JSON.stringify({
        type: 'connected',
        documentId: id,
        timestamp: new Date().toISOString()
      })}\n\n`);

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

      // Simulate processing stages
      let currentStage = 0;
      const interval = setInterval(() => {
        if (currentStage < stages.length) {
          const stageData = {
            type: 'progress',
            documentId: id,
            stage: stages[currentStage].stage,
            progress: stages[currentStage].progress,
            message: stages[currentStage].message,
            timestamp: new Date().toISOString()
          };

          reply.raw.write(`data: ${JSON.stringify(stageData)}\n\n`);
          currentStage++;

          if (currentStage >= stages.length) {
            // Send final completion event
            reply.raw.write(`data: ${JSON.stringify({
              type: 'completed',
              documentId: id,
              stage: 'completed',
              progress: 100,
              message: 'Document processing completed successfully',
              timestamp: new Date().toISOString()
            })}\n\n`);

            clearInterval(interval);
            reply.raw.end();
          }
        }
      }, 1000); // Send update every second

      // Clean up on connection close
      request.raw.on('close', () => {
        clearInterval(interval);
      });

      request.raw.on('end', () => {
        clearInterval(interval);
      });
    }
  );
};

export default documentRoutes;
