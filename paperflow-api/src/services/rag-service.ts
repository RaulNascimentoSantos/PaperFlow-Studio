import { db } from '@/config/database';
import { aiService } from './ai';
import { EmbeddingService } from './embedding';
import { ChunkingService, DocumentChunk } from './chunking';

export interface RAGQuery {
  documentId?: string; // If not provided, search across all documents
  question: string;
  maxSources?: number;
  minConfidence?: number;
  includeMetadata?: boolean;
}

export interface RAGResult {
  answer: string;
  sources: Array<{
    documentId: string;
    documentName?: string;
    page: number;
    snippet: string;
    confidence: number;
  }>;
  tokens_used: number;
  processing_time_ms: number;
}

export class RAGService {
  private embeddingService: EmbeddingService;
  private chunkingService: ChunkingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.chunkingService = new ChunkingService();
  }

  async processDocument(documentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Get document text from database
      const documentText = await this.getDocumentText(documentId);
      if (!documentText) {
        throw new Error(`Document ${documentId} not found or has no text`);
      }

      // Get page-wise text if available, otherwise treat as single page
      const pageTexts = await this.getDocumentPageTexts(documentId);
      
      let chunks: DocumentChunk[];
      if (pageTexts.length > 0) {
        chunks = await this.chunkingService.chunkByPages(documentId, pageTexts);
      } else {
        chunks = await this.chunkingService.chunkDocument(documentId, documentText);
      }

      // Generate and store embeddings
      await this.embeddingService.generateAndStoreEmbeddings(chunks);

      // Update document status
      await this.updateDocumentProcessingStatus(
        documentId, 
        'processed', 
        Date.now() - startTime,
        chunks.length
      );

      console.log(`✅ Processed document ${documentId}: ${chunks.length} chunks`);
    } catch (error) {
      console.error(`❌ Failed to process document ${documentId}:`, error);
      await this.updateDocumentProcessingStatus(
        documentId, 
        'error', 
        Date.now() - startTime,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  async query(request: RAGQuery): Promise<RAGResult> {
    const startTime = Date.now();
    const { documentId, question, maxSources = 5, minConfidence = 0.7 } = request;

    try {
      // Generate embedding for the question
      const questionEmbedding = await aiService.generateEmbedding(question);

      // Search for similar chunks
      let similarChunks;
      if (documentId) {
        similarChunks = await this.embeddingService.searchSimilarChunks(
          documentId,
          questionEmbedding,
          maxSources * 2, // Get more chunks to improve context
          minConfidence * 0.8 // Use slightly lower threshold for chunk retrieval
        );
      } else {
        similarChunks = await this.embeddingService.searchAllDocuments(
          questionEmbedding,
          maxSources * 2,
          minConfidence * 0.8
        );
      }

      if (similarChunks.length === 0) {
        return {
          answer: 'Não foi possível encontrar informações relevantes para responder à pergunta.',
          sources: [],
          tokens_used: 0,
          processing_time_ms: Date.now() - startTime,
        };
      }

      // Build context from similar chunks
      const context = this.buildContext(similarChunks);

      // Generate answer using AI service
      const aiResult = await aiService.query('context', question, {
        maxSources,
        minConfidence,
      });

      // Map similar chunks to sources
      const sources = similarChunks.slice(0, maxSources).map(chunk => ({
        documentId: 'documentId' in chunk ? chunk.documentId : documentId!,
        documentName: chunk.metadata?.originalName,
        page: chunk.pageNumber,
        snippet: this.createSnippet(chunk.text, question),
        confidence: chunk.similarity,
      }));

      // Log query for analytics
      await this.logQuery(documentId, question, aiResult.tokens_used);

      return {
        answer: aiResult.answer,
        sources,
        tokens_used: aiResult.tokens_used,
        processing_time_ms: Date.now() - startTime,
      };

    } catch (error) {
      console.error('RAG query error:', error);
      throw new Error('Failed to process query');
    }
  }

  private async getDocumentText(documentId: string): Promise<string | null> {
    const result = await db.query(
      'SELECT extracted_text FROM documents WHERE id = $1',
      [documentId]
    );
    return result.rows[0]?.extracted_text || null;
  }

  private async getDocumentPageTexts(documentId: string): Promise<Array<{page: number, text: string}>> {
    // This would be enhanced to get actual page-wise text
    // For now, return empty array to use single-page chunking
    return [];
  }

  private buildContext(chunks: Array<{text: string, pageNumber: number}>): string {
    return chunks
      .map((chunk, index) => `[Página ${chunk.pageNumber}, Contexto ${index + 1}]\n${chunk.text}`)
      .join('\n\n---\n\n');
  }

  private createSnippet(text: string, question: string, maxLength: number = 200): string {
    const words = question.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    // Find the best position based on question keywords
    let bestPosition = 0;
    let maxMatches = 0;

    for (let i = 0; i < text.length - maxLength; i += 50) {
      const snippet = text.substring(i, i + maxLength).toLowerCase();
      const matches = words.filter(word => snippet.includes(word)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestPosition = i;
      }
    }

    let snippet = text.substring(bestPosition, bestPosition + maxLength);
    
    // Try to start and end at word boundaries
    const firstSpace = snippet.indexOf(' ');
    const lastSpace = snippet.lastIndexOf(' ');
    
    if (firstSpace > 0 && firstSpace < 50) {
      snippet = snippet.substring(firstSpace + 1);
    }
    
    if (lastSpace > snippet.length - 50 && lastSpace > snippet.length / 2) {
      snippet = snippet.substring(0, lastSpace);
    }

    return (bestPosition > 0 ? '...' : '') + snippet + (bestPosition + maxLength < text.length ? '...' : '');
  }

  private async updateDocumentProcessingStatus(
    documentId: string, 
    status: string, 
    processingTimeMs: number,
    chunksCount: number,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE documents 
      SET status = $1, 
          processing_time_ms = $2, 
          processed_at = NOW(),
          error_message = $3,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('chunks_count', $4)
      WHERE id = $5
    `;
    
    await db.query(query, [status, processingTimeMs, errorMessage, chunksCount, documentId]);
  }

  private async logQuery(documentId: string | undefined, question: string, tokensUsed: number): Promise<void> {
    if (!documentId) return; // Skip logging for cross-document queries for now

    const query = `
      INSERT INTO queries (document_id, question, tokens_used, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    await db.query(query, [documentId, question, tokensUsed]);
  }

  async getDocumentStats(documentId: string): Promise<{
    chunksCount: number;
    averageTokens: number;
    lastProcessed?: Date;
    status: string;
  }> {
    const [docResult, embeddingStats] = await Promise.all([
      db.query('SELECT status, processed_at, metadata FROM documents WHERE id = $1', [documentId]),
      this.embeddingService.getEmbeddingStats(documentId)
    ]);

    const doc = docResult.rows[0];
    
    return {
      chunksCount: embeddingStats.totalChunks,
      averageTokens: embeddingStats.averageTokens,
      lastProcessed: doc?.processed_at,
      status: doc?.status || 'unknown',
    };
  }

  async deleteDocumentFromRAG(documentId: string): Promise<void> {
    await this.embeddingService.deleteDocumentEmbeddings(documentId);
    console.log(`🗑️ Removed RAG data for document ${documentId}`);
  }
}

// Export singleton instance
export const ragService = new RAGService();