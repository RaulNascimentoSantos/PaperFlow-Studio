import OpenAI from 'openai';
import { env } from '@/config/env';
import { 
  AIProvider, 
  SummarizeOptions, 
  SummaryResult, 
  QueryOptions, 
  QueryResult, 
  ClassificationResult 
} from './types';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text.substring(0, 8000), // Truncate to avoid token limits
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async summarize(text: string, options: SummarizeOptions = {}): Promise<SummaryResult> {
    const { type = 'executive', maxLength = 500, language = 'pt-BR', focusAreas = [] } = options;

    let prompt = `Summarize the following document in ${language}. `;
    
    switch (type) {
      case 'executive':
        prompt += 'Create an executive summary highlighting key decisions, outcomes, and strategic points.';
        break;
      case 'detailed':
        prompt += 'Create a detailed summary covering all main topics and subtopics.';
        break;
      case 'bullets':
        prompt += 'Create a bullet-point summary with main topics and key insights.';
        break;
    }

    if (focusAreas.length > 0) {
      prompt += ` Focus particularly on: ${focusAreas.join(', ')}.`;
    }

    prompt += `\n\nLimit the summary to approximately ${maxLength} words.`;
    prompt += '\n\nDocument text:\n' + text.substring(0, 12000);

    try {
      const response = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert document analyst. Provide clear, concise, and accurate summaries. Always extract key points as bullet points after the summary.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: Math.min(maxLength * 2, 2000),
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Extract key points (look for bullet points or numbered lists)
      const keyPoints = this.extractKeyPoints(content);
      
      return {
        summary: content,
        key_points: keyPoints,
        tokens_used: response.usage?.total_tokens || 0,
        model: env.OPENAI_MODEL,
      };
    } catch (error) {
      console.error('OpenAI summarization error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  async query(context: string, question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const { maxSources = 5, minConfidence = 0.7 } = options;
    const startTime = Date.now();

    const prompt = `Based on the following document context, answer the question. 
    Provide specific page references and excerpts when possible.
    
    Context:
    ${context.substring(0, 10000)}
    
    Question: ${question}
    
    Please provide:
    1. A direct answer to the question
    2. Specific quotes or excerpts that support your answer
    3. Page references where the information was found`;

    try {
      const response = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a document analysis expert. Provide accurate answers based strictly on the provided context. Always cite specific page numbers and excerpts when available.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Extract sources from the response (this is a simplified version)
      // In a real implementation, you'd need more sophisticated parsing
      const sources = this.extractSources(content, minConfidence);

      return {
        answer: content,
        sources: sources.slice(0, maxSources),
        tokens_used: response.usage?.total_tokens || 0,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('OpenAI query error:', error);
      throw new Error('Failed to process query');
    }
  }

  async classify(text: string, taxonomy: string[]): Promise<ClassificationResult> {
    const prompt = `Classify the following document into one of these categories: ${taxonomy.join(', ')}.
    
    Document text:
    ${text.substring(0, 8000)}
    
    Respond with the most appropriate category and a confidence score (0-1).
    Also suggest a sub-type if applicable.`;

    try {
      const response = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a document classification expert. Analyze documents and classify them accurately based on content, structure, and purpose.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse the classification result
      // This is a simplified parser - in production, you might want structured output
      const classification = this.parseClassification(content, taxonomy);

      return classification;
    } catch (error) {
      console.error('OpenAI classification error:', error);
      throw new Error('Failed to classify document');
    }
  }

  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    
    // Look for bullet points or numbered lists
    const bulletRegex = /^[\s]*[•\-\*]\s+(.+)$/gm;
    const numberRegex = /^[\s]*\d+\.\s+(.+)$/gm;
    
    let match;
    
    // Extract bullet points
    while ((match = bulletRegex.exec(content)) !== null) {
      keyPoints.push(match[1].trim());
    }
    
    // Extract numbered points
    while ((match = numberRegex.exec(content)) !== null) {
      keyPoints.push(match[1].trim());
    }
    
    // If no bullet points found, try to extract key sentences
    if (keyPoints.length === 0) {
      const sentences = content.split(/[.!?]+/).slice(0, 5);
      keyPoints.push(...sentences.map(s => s.trim()).filter(s => s.length > 10));
    }
    
    return keyPoints.slice(0, 10); // Limit to 10 key points
  }

  private extractSources(content: string, minConfidence: number): Array<{page: number, snippet: string, confidence: number}> {
    const sources = [];
    
    // Look for page references in the content
    const pageRegex = /página?\s*(\d+)|page\s*(\d+)|p\.\s*(\d+)/gi;
    const matches = [...content.matchAll(pageRegex)];
    
    if (matches.length > 0) {
      for (const match of matches) {
        const pageNum = parseInt(match[1] || match[2] || match[3]);
        const startIndex = Math.max(0, match.index! - 100);
        const endIndex = Math.min(content.length, match.index! + 200);
        const snippet = content.substring(startIndex, endIndex).trim();
        
        sources.push({
          page: pageNum,
          snippet: snippet,
          confidence: Math.random() * 0.3 + 0.7, // Mock confidence for now
        });
      }
    } else {
      // If no page references found, create a generic source
      sources.push({
        page: 1,
        snippet: content.substring(0, 200).trim() + '...',
        confidence: 0.8,
      });
    }
    
    return sources.filter(s => s.confidence >= minConfidence);
  }

  private parseClassification(content: string, taxonomy: string[]): ClassificationResult {
    const lowerContent = content.toLowerCase();
    
    // Find the best matching category
    let bestMatch = taxonomy[0];
    let confidence = 0.5;
    
    for (const category of taxonomy) {
      if (lowerContent.includes(category.toLowerCase())) {
        bestMatch = category;
        confidence = 0.9;
        break;
      }
    }
    
    // Extract confidence if mentioned in response
    const confidenceMatch = content.match(/confidence[:\s]*([0-9.]+)/i);
    if (confidenceMatch) {
      confidence = Math.min(1.0, parseFloat(confidenceMatch[1]));
    }
    
    // Extract sub-type if mentioned
    let subType = undefined;
    const subTypeMatch = content.match(/sub[_\-]?type[:\s]*([^\n\r.]+)/i);
    if (subTypeMatch) {
      subType = subTypeMatch[1].trim();
    }
    
    return {
      classification: bestMatch,
      confidence,
      sub_type: subType,
    };
  }
}