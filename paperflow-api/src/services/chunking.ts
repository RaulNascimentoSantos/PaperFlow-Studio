export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  metadata?: Record<string, any>;
}

export class ChunkingService {
  private readonly CHUNK_SIZE = 1000; // tokens
  private readonly CHUNK_OVERLAP = 200; // tokens

  async chunkDocument(documentId: string, text: string, pageNumber?: number): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let currentTokenCount = 0;
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const sentenceTokenCount = this.estimateTokenCount(sentence);
      
      // If adding this sentence would exceed chunk size, save current chunk
      if (currentTokenCount + sentenceTokenCount > this.CHUNK_SIZE && currentChunk) {
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          pageNumber: pageNumber || 1,
          chunkIndex,
          text: currentChunk.trim(),
          tokenCount: currentTokenCount,
          metadata: {
            startSentence: currentChunk.substring(0, 100) + '...',
            endSentence: '...' + currentChunk.substring(currentChunk.length - 100),
          }
        });
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, this.CHUNK_OVERLAP);
        currentChunk = overlapText + ' ' + sentence;
        currentTokenCount = this.estimateTokenCount(currentChunk);
        chunkIndex++;
      } else {
        currentChunk += ' ' + sentence;
        currentTokenCount += sentenceTokenCount;
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        pageNumber: pageNumber || 1,
        chunkIndex,
        text: currentChunk.trim(),
        tokenCount: currentTokenCount,
        metadata: {
          startSentence: currentChunk.substring(0, 100) + '...',
          endSentence: '...' + currentChunk.substring(currentChunk.length - 100),
        }
      });
    }
    
    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with NLP libraries
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private getOverlapText(text: string, targetTokens: number): string {
    const targetChars = targetTokens * 4; // Rough estimate
    const startIndex = Math.max(0, text.length - targetChars);
    
    // Try to start at a sentence boundary
    const lastSentenceEnd = text.lastIndexOf('.', text.length - 50);
    if (lastSentenceEnd > startIndex) {
      return text.substring(lastSentenceEnd + 1).trim();
    }
    
    return text.substring(startIndex).trim();
  }

  async chunkByPages(documentId: string, pageTexts: Array<{page: number, text: string}>): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];
    
    for (const pageData of pageTexts) {
      const pageChunks = await this.chunkDocument(documentId, pageData.text, pageData.page);
      allChunks.push(...pageChunks);
    }
    
    return allChunks;
  }
}