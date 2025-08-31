import { env } from '@/config/env';
import { OpenAIProvider } from './openai-provider';
import { MockProvider } from './mock-provider';
import { AIProvider, SummarizeOptions, QueryOptions } from './types';

class AIService {
  private provider: AIProvider;

  constructor() {
    // Use mock provider in development/test, real provider in production
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      this.provider = new MockProvider();
    } else {
      this.provider = new OpenAIProvider();
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  async summarize(documentId: string, options: SummarizeOptions = {}) {
    // TODO: Fetch document text from database
    const documentText = await this.getDocumentText(documentId);
    return this.provider.summarize(documentText, options);
  }

  async query(documentId: string, question: string, options: QueryOptions = {}) {
    // TODO: Get context from RAG system (chunks + embeddings)
    const context = await this.getDocumentContext(documentId, question);
    return this.provider.query(context, question, options);
  }

  async classify(documentId: string, taxonomy: string[]) {
    const documentText = await this.getDocumentText(documentId);
    return this.provider.classify(documentText, taxonomy);
  }

  private async getDocumentText(documentId: string): Promise<string> {
    const { db } = await import('@/config/database');
    const result = await db.query('SELECT extracted_text FROM documents WHERE id = $1', [documentId]);
    return result.rows[0]?.extracted_text || `No text found for document ${documentId}`;
  }

  private async getDocumentContext(documentId: string, question: string): Promise<string> {
    const { EmbeddingService } = await import('../embedding.js');
    const embeddingService = new EmbeddingService();
    
    try {
      // Generate embedding for the question
      const questionEmbedding = await this.generateEmbedding(question);
      
      // Search for similar chunks using pgvector
      const similarChunks = await embeddingService.searchSimilarChunks(
        documentId, 
        questionEmbedding, 
        5, // max chunks
        0.7 // min similarity
      );
      
      if (similarChunks.length === 0) {
        return await this.getDocumentText(documentId);
      }
      
      // Build context from similar chunks
      return similarChunks
        .map((chunk: any, index: number) => `[Página ${chunk.pageNumber}, Contexto ${index + 1}]\n${chunk.text}`)
        .join('\n\n---\n\n');
        
    } catch (error) {
      console.error('Error getting document context:', error);
      // Fallback to full document text
      return await this.getDocumentText(documentId);
    }
  }

  // Test method to verify AI service is working
  async testConnection(): Promise<boolean> {
    try {
      const testResult = await this.provider.summarize('Test text for connection verification', {
        type: 'executive',
        maxLength: 50,
      });
      return !!testResult.summary;
    } catch (error) {
      console.error('AI service test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export type { AIProvider, SummarizeOptions, QueryOptions } from './types';