import { DatabaseService } from './database';
import { SearchOptions, SearchResult } from '../types/classification';

interface DocumentChunk {
  text: string;
  index: number;
  metadata: Record<string, any>;
}

interface ChunkingOptions {
  maxTokens: number;
  overlap: number;
  preserveParagraphs: boolean;
}

export class SemanticSearchService {
  constructor(private db: DatabaseService) {}

  async indexDocument(
    documentId: string, 
    tenantId: string,
    text: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Smart chunking of the document
      const chunks = this.smartChunking(text, {
        maxTokens: 512,
        overlap: 50,
        preserveParagraphs: true
      });

      // Delete existing chunks for this document
      await this.db.query(`
        DELETE FROM document_embeddings 
        WHERE document_id = $1 AND tenant_id = $2
      `, [documentId, tenantId]);

      // Generate embeddings and store chunks
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text);
        
        await this.db.query(`
          INSERT INTO document_embeddings 
          (id, document_id, tenant_id, chunk_text, embedding, chunk_index, metadata, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
        `, [
          documentId, 
          tenantId, 
          chunk.text, 
          JSON.stringify(embedding), // Store as JSON for mock DB
          chunk.index, 
          JSON.stringify(chunk.metadata)
        ]);
      }

      console.log(`📊 Indexed ${chunks.length} chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error indexing document:', error);
      throw error;
    }
  }

  async search(
    tenantId: string, 
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const limit = options.limit || 10;
      const offset = options.offset || 0;
      const minSimilarity = options.filters?.minSimilarity || 0.1;

      // For mock implementation, we'll do a keyword-based search
      // In production, this would use vector similarity with pgvector
      const results = await this.performMockSemanticSearch(
        tenantId, 
        query, 
        queryEmbedding, 
        limit, 
        offset,
        minSimilarity
      );

      return results;
    } catch (error) {
      console.error('Error performing semantic search:', error);
      return [];
    }
  }

  async searchSimilarDocuments(
    documentId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      // Get document content for similarity comparison
      const docResult = await this.db.query(`
        SELECT extracted_text, original_name 
        FROM documents 
        WHERE id = $1 AND tenant_id = $2
      `, [documentId, tenantId]);

      if (!docResult.rows.length) {
        return [];
      }

      const documentText = docResult.rows[0].extracted_text;
      if (!documentText) {
        return [];
      }

      // Use the document text as query for similarity search
      const shortQuery = this.extractKeyTerms(documentText);
      
      return await this.search(tenantId, shortQuery, { 
        limit: limit + 1, // +1 to exclude the original document
        filters: { minSimilarity: 0.3 }
      });
    } catch (error) {
      console.error('Error finding similar documents:', error);
      return [];
    }
  }

  private smartChunking(text: string, options: ChunkingOptions): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    if (options.preserveParagraphs) {
      // Split by paragraphs first
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      let currentChunk = '';
      let chunkIndex = 0;

      for (const paragraph of paragraphs) {
        const proposedChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
        
        // Estimate tokens (roughly 1 token = 4 characters for Portuguese)
        const estimatedTokens = proposedChunk.length / 4;
        
        if (estimatedTokens <= options.maxTokens) {
          currentChunk = proposedChunk;
        } else {
          // Save current chunk if it has content
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              index: chunkIndex++,
              metadata: {
                paragraphCount: currentChunk.split('\n\n').length,
                characterCount: currentChunk.length
              }
            });
          }
          
          // Start new chunk with current paragraph
          currentChunk = paragraph;
          
          // If single paragraph is too large, split it by sentences
          if (paragraph.length / 4 > options.maxTokens) {
            const sentences = this.splitBySentences(paragraph);
            currentChunk = '';
            
            for (const sentence of sentences) {
              const proposedSentenceChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
              
              if (proposedSentenceChunk.length / 4 <= options.maxTokens) {
                currentChunk = proposedSentenceChunk;
              } else {
                if (currentChunk.trim()) {
                  chunks.push({
                    text: currentChunk.trim(),
                    index: chunkIndex++,
                    metadata: {
                      sentenceCount: currentChunk.split(/[.!?]+/).length,
                      characterCount: currentChunk.length
                    }
                  });
                }
                currentChunk = sentence;
              }
            }
          }
        }
      }

      // Add final chunk
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          metadata: {
            characterCount: currentChunk.length,
            isLastChunk: true
          }
        });
      }
    } else {
      // Simple character-based chunking
      const maxChars = options.maxTokens * 4;
      const overlapChars = options.overlap * 4;
      
      for (let i = 0; i < text.length; i += maxChars - overlapChars) {
        const chunk = text.substring(i, i + maxChars);
        chunks.push({
          text: chunk,
          index: Math.floor(i / (maxChars - overlapChars)),
          metadata: {
            startPosition: i,
            characterCount: chunk.length
          }
        });
      }
    }

    return chunks;
  }

  private splitBySentences(text: string): string[] {
    // Split by sentence endings, considering Brazilian Portuguese patterns
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Mock embedding generation
    // In production, this would call OpenAI API, Sentence Transformers, or local model
    
    // Simple hash-based mock embedding (300 dimensions)
    const embedding = new Array(300).fill(0);
    
    // Generate pseudo-embedding based on text characteristics
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
    
    // Simple features to simulate embedding
    for (let i = 0; i < 300; i++) {
      const seed = text.charCodeAt(i % text.length) + i;
      embedding[i] = (Math.sin(seed) + Math.cos(seed * avgWordLength) + Math.sin(wordCount * i)) / 3;
    }
    
    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private async performMockSemanticSearch(
    tenantId: string,
    query: string,
    queryEmbedding: number[],
    limit: number,
    offset: number,
    minSimilarity: number
  ): Promise<SearchResult[]> {
    try {
      // Mock semantic search using keyword matching for development
      // In production, this would use vector similarity queries
      
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      
      if (searchTerms.length === 0) {
        return [];
      }

      // Build search query
      const searchPattern = searchTerms.map(term => `%${term}%`).join('|');
      
      const results = await this.db.query(`
        SELECT 
          d.id as document_id,
          d.original_name as title,
          COALESCE(d.extracted_text, '') as content,
          d.created_at,
          d.metadata,
          (
            ${searchTerms.map((_, i) => `
              CASE WHEN LOWER(d.extracted_text) LIKE $${i + 3} THEN 1 ELSE 0 END
            `).join(' + ')}
          ) as keyword_score
        FROM documents d
        WHERE d.tenant_id = $1
          AND d.deleted_at IS NULL
          AND (
            ${searchTerms.map((_, i) => `
              LOWER(d.extracted_text) LIKE $${i + 3} OR 
              LOWER(d.original_name) LIKE $${i + 3}
            `).join(' OR ')}
          )
        ORDER BY keyword_score DESC, d.created_at DESC
        LIMIT $2 OFFSET ${offset}
      `, [tenantId, limit, ...searchTerms.map(term => `%${term}%`)]);

      // Calculate mock similarity scores
      return results.rows.map(row => {
        const similarity = this.calculateMockSimilarity(query, row.content);
        const keywordScore = row.keyword_score / searchTerms.length;
        const combinedScore = similarity * 0.7 + keywordScore * 0.3;

        return {
          documentId: row.document_id,
          title: row.title,
          content: this.truncateContent(row.content, 300),
          similarity,
          keywordScore,
          combinedScore,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
          createdAt: new Date(row.created_at)
        };
      }).filter(result => result.combinedScore >= minSimilarity);
      
    } catch (error) {
      console.error('Error in mock semantic search:', error);
      return [];
    }
  }

  private calculateMockSimilarity(query: string, content: string): number {
    // Simple Jaccard similarity for mock implementation
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    const contentTerms = new Set(content.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...queryTerms].filter(x => contentTerms.has(x)));
    const union = new Set([...queryTerms, ...contentTerms]);
    
    return intersection.size / union.size;
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength).trim() + '...';
  }

  private extractKeyTerms(text: string, maxTerms: number = 10): string {
    // Extract key terms for similarity search
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Simple term frequency
    const termFreq: Record<string, number> = {};
    words.forEach(word => {
      termFreq[word] = (termFreq[word] || 0) + 1;
    });

    // Get top terms
    const topTerms = Object.entries(termFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTerms)
      .map(([term]) => term);

    return topTerms.join(' ');
  }

  async getDocumentSummary(documentId: string, tenantId: string): Promise<string> {
    try {
      const result = await this.db.query(`
        SELECT extracted_text 
        FROM documents 
        WHERE id = $1 AND tenant_id = $2
      `, [documentId, tenantId]);

      if (!result.rows.length || !result.rows[0].extracted_text) {
        return 'Documento não disponível para resumo.';
      }

      const text = result.rows[0].extracted_text;
      
      // Simple extractive summarization (first few sentences)
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const summaryLength = Math.min(3, sentences.length);
      
      return sentences.slice(0, summaryLength).join('. ') + '.';
      
    } catch (error) {
      console.error('Error generating document summary:', error);
      return 'Erro ao gerar resumo do documento.';
    }
  }
}