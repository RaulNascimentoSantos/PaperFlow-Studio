# 🚀 PaperFlow API

> **Transform Documents into Data Intelligence**

A production-ready REST API that transforms PDFs into structured data and insights via AI, featuring intelligent text extraction, semantic analysis, and RAG-powered Q&A capabilities.

## ✨ Features

- **📄 Smart PDF Processing**: Extract text, metadata, tables, and images
- **🧠 AI Analysis**: Summarization, classification, entity extraction, sentiment analysis  
- **🔍 RAG Query System**: Ask questions and get answers with precise citations
- **⚡ High Performance**: p95 < 5s processing, 100 req/s sustained throughput
- **🔐 Enterprise Security**: API key authentication, rate limiting, data encryption
- **📊 Usage Analytics**: Track processing quotas and API usage
- **🐳 Docker Ready**: Complete containerized development and deployment

## 🏗️ Architecture

```mermaid
graph TB
    A[Client] --> B[Fastify API]
    B --> C[Authentication]
    B --> D[Rate Limiting]
    B --> E[PDF Service]
    B --> F[AI Service]
    B --> G[RAG Service]
    
    E --> H[(PostgreSQL + pgvector)]
    F --> I[OpenAI API]
    G --> H
    
    E --> J[Redis + BullMQ]
    F --> J
    
    E --> K[S3 Storage]
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- Docker & Docker Compose
- OpenAI API Key
- AWS S3 credentials (or use local MinIO)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd paperflow-api
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Development Environment

```bash
# Start all services (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### 3. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/docs
```

## 📚 API Usage

### Authentication

All API requests require authentication via API key:

```bash
curl -H "Authorization: Bearer pf_your_api_key_here" \
     http://localhost:3000/v1/documents
```

### Upload and Process Document

```bash
curl -X POST http://localhost:3000/v1/documents \
  -H "Authorization: Bearer pf_your_api_key_here" \
  -F "file=@document.pdf"
```

### Query Documents (RAG)

```bash
curl -X POST http://localhost:3000/v1/queries \
  -H "Authorization: Bearer pf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main findings in this document?",
    "max_results": 5,
    "similarity_threshold": 0.7
  }'
```

### Get Analysis Results

```bash
curl http://localhost:3000/v1/documents/{document_id}/analysis \
  -H "Authorization: Bearer pf_your_api_key_here"
```

## 🛠️ Development

### Project Structure

```
src/
├── config/         # Environment & service configuration
├── middleware/     # Authentication, rate limiting, security
├── routes/         # API endpoint handlers  
├── services/       # Business logic (PDF, AI, RAG, Auth)
├── utils/          # Validation, errors, helpers
├── types/          # TypeScript interfaces
└── app.ts          # Fastify application setup

migrations/         # Database schema migrations
scripts/           # Utility scripts (migrate, seed)
tests/             # Test suites
```

### Available Scripts

```bash
npm run dev         # Start development server with hot reload
npm run build       # Build TypeScript to JavaScript
npm run start       # Start production server
npm run test        # Run test suite
npm run lint        # ESLint code checking
npm run typecheck   # TypeScript type checking
npm run db:migrate  # Run database migrations
```

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Core
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/paperflow
REDIS_URL=redis://localhost:6379

# AI & Processing  
OPENAI_API_KEY=sk-your-openai-key
MAX_FILE_SIZE_MB=10
MAX_PAGES_PER_PDF=100

# Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret  
S3_BUCKET_NAME=paperflow-documents

# Security
JWT_SECRET=your-jwt-secret
API_KEY_SECRET=your-api-key-secret
```

## 🐳 Deployment

### Docker Production Build

```bash
# Build production image
docker build -t paperflow-api .

# Run with production configuration
docker run -p 3000:3000 \
  --env-file .env.production \
  paperflow-api
```

### Docker Compose (Full Stack)

```bash
# Production deployment with all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📊 Monitoring

### Health Checks

- **Basic**: `GET /health`
- **Detailed**: `GET /v1/health?include_details=true`
- **Readiness**: `GET /v1/health/ready`
- **Liveness**: `GET /v1/health/live`

### API Documentation

Interactive API documentation available at `/docs` when server is running.

## 🔒 Security

- **Authentication**: API key-based with bcrypt hashing
- **Rate Limiting**: IP and user-based limits
- **Input Validation**: Zod schema validation  
- **File Security**: Size limits, type validation, virus scanning
- **Data Encryption**: TLS in transit, S3 encryption at rest

## 📈 Performance

### Benchmarks (MVP Targets)

- **API Latency**: p95 < 200ms (excluding uploads)
- **PDF Processing**: p95 < 5s for 10MB files
- **RAG Queries**: p95 < 2s response time
- **Throughput**: 100 requests/second sustained
- **Concurrent Users**: 500+ connections

### Scalability

- **Vertical**: Optimize single instance performance
- **Horizontal**: Add workers for background jobs
- **Database**: Read replicas for query scaling
- **Caching**: Redis for user data and responses

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage  

# Run specific test suites
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=pdf
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📞 Support

- **Documentation**: Check `/docs` endpoint
- **Issues**: GitHub Issues  
- **Email**: support@paperflow.app

---

**Built with ❤️ for document intelligence and AI-powered insights**