export interface User {
  id: string;
  email: string;
  company: string;
  api_key_hash: string;
  api_secret_hash: string;
  plan: string;
  credits_remaining: number;
  created_at: Date;
  updated_at: Date;
  last_active: Date;
  metadata: any;
}

export interface Document {
  id: string;
  user_id: string;
  original_name: string;
  s3_key: string;
  size_bytes: number;
  pages: number;
  status: string;
  mime_type: string;
  checksum: string;
  metadata: any;
  extracted_text: string;
  processing_time_ms: number;
  error_message: string;
  created_at: Date;
  processed_at: Date;
  expires_at: Date;
}

export interface Chunk {
  id: string;
  document_id: string;
  page_number: number;
  chunk_index: number;
  text: string;
  embedding: number[];
  token_count: number;
  metadata: any;
  created_at: Date;
}

export interface Query {
  id: string;
  user_id: string;
  document_id: string;
  question: string;
  answer: string;
  sources: any;
  tokens_used: number;
  model: string;
  processing_time_ms: number;
  feedback_score: number;
  created_at: Date;
}

export interface UsageLog {
  id: string;
  user_id: string;
  action: string;
  resource_id: string;
  quantity: number;
  credits_used: number;
  metadata: any;
  created_at: Date;
}

export interface BillingEvent {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  credits: number;
  description: string;
  metadata: any;
  created_at: Date;
}
