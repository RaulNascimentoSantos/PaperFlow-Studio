-- Core Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    company VARCHAR(255),
    api_key_hash VARCHAR(255) UNIQUE NOT NULL,
    api_secret_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    credits_remaining INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(500),
    s3_key VARCHAR(500) UNIQUE NOT NULL,
    size_bytes BIGINT,
    pages INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    extracted_text TEXT,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at)
);

CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER,
    chunk_index INTEGER,
    text TEXT NOT NULL,
    embedding vector(384),
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_document_page (document_id, page_number),
    INDEX idx_embedding USING hnsw (embedding vector_cosine_ops)
);

CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    document_id UUID REFERENCES documents(id),
    question TEXT NOT NULL,
    answer TEXT,
    sources JSONB,
    tokens_used INTEGER,
    model VARCHAR(100),
    processing_time_ms INTEGER,
    feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_document (document_id)
);

CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_id UUID,
    quantity INTEGER DEFAULT 1,
    credits_used INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_user_action_time (user_id, action, created_at DESC)
);

-- Billing & Analytics
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),
    amount_cents INTEGER,
    credits INTEGER,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_user_created (user_id, created_at DESC)
);

-- Optimizations
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_chunks_tokens ON chunks(token_count);
CREATE INDEX idx_usage_month ON usage_logs(user_id, date_trunc('month', created_at));
