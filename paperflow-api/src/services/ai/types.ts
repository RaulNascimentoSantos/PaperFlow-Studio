export interface AIProvider {
  generateEmbedding(text: string): Promise<number[]>;
  summarize(text: string, options: SummarizeOptions): Promise<SummaryResult>;
  query(context: string, question: string, options: QueryOptions): Promise<QueryResult>;
  classify(text: string, taxonomy: string[]): Promise<ClassificationResult>;
}

export interface SummarizeOptions {
  type?: 'executive' | 'detailed' | 'bullets';
  maxLength?: number;
  language?: string;
  focusAreas?: string[];
}

export interface SummaryResult {
  summary: string;
  key_points: string[];
  tokens_used: number;
  model: string;
}

export interface QueryOptions {
  maxSources?: number;
  minConfidence?: number;
}

export interface QueryResult {
  answer: string;
  sources: QuerySource[];
  tokens_used: number;
  processing_time_ms: number;
}

export interface QuerySource {
  page: number;
  snippet: string;
  confidence: number;
}

export interface ClassificationResult {
  classification: string;
  confidence: number;
  sub_type?: string;
}