import { db } from '@/config/database';
import { aiService } from './ai/index.js';
import { DocumentChunk } from './chunking';

export interface EmbeddingResult {
  id: string;
  documentId: string;
  chunkId: string;
  embedding: number[];
  text: string;
  pageNumber: number;
  metadata?: Record<string, any>;
}

export class EmbeddingService {
  async generateAndStoreEmbeddings(chunks: DocumentChunk[]): Promise<void> {
    const batchSize = 10; // Process in batches to avoid overwhelming API
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await this.processBatch(batch);
      
      // Small delay to be respectful to API limits
      if (i + batchSize < chunks.length) {
        await this.delay(100);
      }
    }
  }

  private async processBatch(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      try {
        const embedding = await aiService.generateEmbedding(chunk.text);
        await this.storeEmbedding(chunk, embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
        // Continue processing other chunks
      }
    }
  }

  private async storeEmbedding(chunk: DocumentChunk, embedding: number[]): Promise<void> {
    const query = `
      INSERT INTO chunks (
        id, document_id, page_number, chunk_index, text, 
        embedding, token_count, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) 
      DO UPDATE SET 
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `;
    
    await db.query(query, [
      chunk.id,
      chunk.documentId,
      chunk.pageNumber,
      chunk.chunkIndex,
      chunk.text,
      JSON.stringify(embedding), // pgvector expects string representation
      chunk.tokenCount,
      JSON.stringify(chunk.metadata || {}),
    ]);
  }

  async searchSimilarChunks(
    documentId: string,
    queryEmbedding: number[],
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<Array<{
    id: string;
    text: string;
    pageNumber: number;
    similarity: number;
    metadata?: Record<string, any>;
  }>> {
    const query = `
      SELECT 
        id,
        text,
        page_number,
        metadata,
        1 - (embedding <=> $2::vector) as similarity
      FROM chunks
      WHERE document_id = $1
        AND 1 - (embedding <=> $2::vector) >= $3
      ORDER BY embedding <=> $2::vector
      LIMIT $4
    `;

    const result = await db.query(query, [
      documentId,
      JSON.stringify(queryEmbedding),
      minSimilarity,
      limit,
    ]);

    return result.rows.map((row: any) => ({
      id: row.id,
      text: row.text,
      pageNumber: row.page_number,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async searchAllDocuments(
    queryEmbedding: number[],
    limit: number = 10,
    minSimilarity: number = 0.7
  ): Promise<Array<{
    id: string;
    documentId: string;
    text: string;
    pageNumber: number;
    similarity: number;
    metadata?: Record<string, any>;
  }>> {
    const query = `
      SELECT 
        c.id,
        c.document_id,
        c.text,
        c.page_number,
        c.metadata,
        1 - (c.embedding <=> $1::vector) as similarity,
        d.original_name
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE 1 - (c.embedding <=> $1::vector) >= $2
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `;

    const result = await db.query(query, [
      JSON.stringify(queryEmbedding),
      minSimilarity,
      limit,
    ]);

    return result.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      text: row.text,
      pageNumber: row.page_number,
      similarity: parseFloat(row.similarity),
      metadata: {
        ...row.metadata ? JSON.parse(row.metadata) : {},
        originalName: row.original_name,
      },
    }));
  }

  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    await db.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
  }

  async getEmbeddingStats(documentId?: string): Promise<{
    totalChunks: number;
    averageTokens: number;
    documentCount: number;
  }> {
    let query: string;
    let params: any[];

    if (documentId) {
      query = `
        SELECT 
          COUNT(*) as total_chunks,
          AVG(token_count) as avg_tokens,
          COUNT(DISTINCT document_id) as doc_count
        FROM chunks 
        WHERE document_id = $1
      `;
      params = [documentId];
    } else {
      query = `
        SELECT 
          COUNT(*) as total_chunks,
          AVG(token_count) as avg_tokens,
          COUNT(DISTINCT document_id) as doc_count
        FROM chunks
      `;
      params = [];
    }

    const result = await db.query(query, params);
    const row = result.rows[0];

    return {
      totalChunks: parseInt(row.total_chunks),
      averageTokens: parseFloat(row.avg_tokens) || 0,
      documentCount: parseInt(row.doc_count),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}