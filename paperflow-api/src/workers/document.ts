import { env } from '@/config/env';
import { db } from '@/config/database';
import pdf from 'pdf-parse';
import { storage } from '@/config/storage';
import { ragService } from '@/services/rag-service';
import { createRedisClient } from '@/config/mock-redis';

const redis = createRedisClient(env.REDIS_URL);

// Mock worker for development
class MockWorker {
  private name: string;
  private processor: (job: any) => Promise<void>;
  
  constructor(name: string, processor: (job: any) => Promise<void>, options?: any) {
    this.name = name;
    this.processor = processor;
    console.log(`👷 Mock Worker created: ${name}`);
  }
  
  on(event: string, handler: (job?: any, err?: Error) => void): void {
    console.log(`📡 Mock Worker event listener added: ${event}`);
  }
}

const WorkerClass = env.NODE_ENV === 'development' ? MockWorker : require('bullmq').Worker;

const worker = new WorkerClass(
  'document-processing',
  async (job) => {
    const { documentId } = job.data;
    const startTime = Date.now();

    try {
      console.log(`📄 Processing document ${documentId}`);

      const docResult = await db.query('SELECT * FROM documents WHERE id = $1', [
        documentId,
      ]);
      const document = docResult.rows[0];

      if (!document) {
        throw new Error(`Document with id ${documentId} not found`);
      }

      // Update status to processing
      await db.query(
        'UPDATE documents SET status = $1 WHERE id = $2',
        ['processing', documentId]
      );

      // Download and extract PDF text
      console.log(`📥 Downloading document from storage: ${document.s3_key}`);
      const pdfBuffer = await storage.download(document.s3_key);
      
      // Use enhanced PDF processing with table extraction
      const { PdfService } = await import('@/services/pdf');
      const pdfResult = await PdfService.processPdfAdvanced(pdfBuffer, {
        extractTables: true,
        extractImages: false, // Disable for MVP
        ocrIfNeeded: true,
        language: 'pt-BR'
      });

      // Prepare comprehensive metadata
      const metadata = {
        pdf_version: pdfResult.metadata.version || 'unknown',
        producer: pdfResult.metadata.producer || 'unknown',
        creator: pdfResult.metadata.creator || 'unknown',
        title: pdfResult.metadata.title || document.original_name,
        author: pdfResult.metadata.author || 'unknown',
        creation_date: pdfResult.metadata.creationDate || null,
        modification_date: pdfResult.metadata.modificationDate || null,
        word_count: pdfResult.wordCount,
        char_count: pdfResult.charCount,
        tables_count: pdfResult.tables.length,
        tables: pdfResult.tables.map(table => ({
          page: table.page,
          confidence: table.confidence,
          rows: table.rows.length,
          columns: table.rows[0]?.cells.length || 0,
          format: table.format,
          data: table.data
        })),
        processing_info: {
          extracted_tables: pdfResult.tables.length,
          ocr_used: pdfResult.charCount > (pdfResult.text?.length || 0) * 1.2,
        }
      };

      // Update document with extracted text and metadata
      await db.query(
        `UPDATE documents SET 
         extracted_text = $1, 
         pages = $2, 
         status = $3, 
         metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
         processing_time_ms = $5,
         processed_at = NOW() 
         WHERE id = $6`,
        [
          pdfResult.text, 
          pdfResult.pages, 
          'extracted', 
          JSON.stringify(metadata),
          Date.now() - startTime,
          documentId
        ]
      );

      console.log(`✅ Text extracted from document ${documentId}: ${pdfResult.pages} pages, ${pdfResult.tables.length} tables`);

      // Process document for RAG (chunking + embeddings)
      await ragService.processDocument(documentId);

      console.log(`🧠 RAG processing completed for document ${documentId}`);

    } catch (error) {
      console.error(`❌ Document processing failed for ${documentId}:`, error);
      
      // Update document status to error
      await db.query(
        'UPDATE documents SET status = $1, error_message = $2, processing_time_ms = $3, processed_at = NOW() WHERE id = $4',
        ['error', error instanceof Error ? error.message : 'Unknown error', Date.now() - startTime, documentId]
      );
      
      throw error;
    }
  },
  { 
    connection: redis as any,
    concurrency: env.MAX_CONCURRENT_JOBS || 3,
  }
);

worker.on('completed', (job) => {
  if (job) {
    console.log(`${job.id} has completed!`);
  }
});

worker.on('failed', (job, err) => {
  if (job) {
    console.log(`${job.id} has failed with ${err.message}`);
  }
});