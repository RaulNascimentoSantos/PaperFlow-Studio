# 🚀 PaperFlow Studio

> **Complete Document Intelligence Platform** - Transform documents into actionable data with AI

PaperFlow Studio is a comprehensive solution for document processing, featuring AI-powered analysis, RAG (Retrieval-Augmented Generation), OCR, table extraction, and real-time analytics.

## ✨ Features Implemented

### 🔧 Backend API (COMPLETED ✅)
- **Complete REST API** with 25+ endpoints
- **OpenAI Integration** for AI processing (GPT-4, Embeddings)
- **RAG System** with vector search and similarity matching
- **PDF Processing** with text extraction and table parsing
- **OCR Integration** with Tesseract for scanned documents
- **Real-time SSE** for processing progress
- **Authentication** with secure API key system
- **Usage Analytics** with detailed metrics
- **Mock Services** for development (Database, Redis, Storage)

### 📦 TypeScript SDK (COMPLETED ✅)
- **Auto-generated** from OpenAPI specification
- **Type-safe** client with full API coverage
- **SSE Support** for real-time events
- **Upload utilities** with progress tracking
- **Error handling** and retry logic

### 🌐 React Frontend (IN PROGRESS 🔄)
- **Vite + React 18** with TypeScript
- **TanStack Router** for routing
- **TanStack Query** for data management
- **Shadcn/ui + Tailwind** for beautiful UI
- **PDF.js Integration** for document viewing
- **Real-time updates** via SSE
- **Dark theme** by default

## 🏗️ Architecture

```
PaperFlow Studio/
├── paperflow-api/          # Backend API (Node.js + Fastify)
├── packages/
│   └── sdk/                # TypeScript SDK
├── apps/
│   └── web/                # React Frontend
└── infra/                  # Docker Compose setup
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker (optional, for services)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Servers
```bash
# Start API server (port 3002)
pnpm dev:api

# Start web app (port 5173) - when ready
pnpm dev:web

# Or start both
pnpm dev
```

### 3. Test the API
```bash
# Health check
curl http://localhost:3002/v1/health

# Get OpenAPI spec
curl http://localhost:3002/openapi.json

# Register user
curl http://localhost:3002/v1/auth/register \\
  -X POST -H "Content-Type: application/json" \\
  -d '{"email":"demo@test.com","company":"Demo Corp","plan":"pro"}'
```

## 📡 API Endpoints

### Core Endpoints
- `GET /` - API information
- `GET /v1/health` - Health check
- `GET /openapi.json` - OpenAPI specification
- `GET /docs` - Interactive API documentation

### Authentication
- `POST /v1/auth/register` - Register user and get API key

### Document Processing  
- `POST /v1/documents/upload` - Upload PDF for processing
- `GET /v1/documents/:id/extract` - Get processed document data
- `GET /v1/documents/:id/events` - SSE for real-time progress

### AI Services
- `POST /v1/ai/summarize` - AI document summarization
- `POST /v1/ai/query` - RAG-powered Q&A
- `POST /v1/ai/classify` - Document classification

### Analytics
- `GET /v1/usage/` - Usage analytics and metrics
- `GET /v1/users/me` - User profile

## 🔑 API Usage Example

```typescript
import { setConfig, subscribeToDocumentEvents } from '@paperflow/sdk';

// Configure SDK
setConfig({
  apiKey: 'pf_live_your_api_key_here',
  baseUrl: 'http://localhost:3002'
});

// Upload document with real-time progress
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('/v1/documents/upload', {
  method: 'POST',
  headers: { 'x-api-key': 'your_api_key' },
  body: formData
});

const { document_id } = await response.json();

// Subscribe to processing events
subscribeToDocumentEvents(document_id, {
  onEvent: (event) => {
    console.log(`Processing: ${event.stage} (${event.progress}%)`);
  },
  onComplete: () => {
    console.log('Document processing completed!');
  }
});
```

## 🎨 Frontend Features (Planned)

### Pages
- **Home** (`/`) - API key configuration and introduction
- **Upload** (`/upload`) - Drag & drop with progress tracking
- **Documents** (`/documents`) - Grid view with real-time status
- **Viewer** (`/documents/:id`) - PDF viewer with highlights
- **Q&A Chat** (`/qa/:documentId`) - RAG chat interface
- **Analytics** (`/analytics`) - Usage metrics dashboard
- **Settings** (`/settings`) - Configuration panel

### Components
- **PDF Viewer** with highlight support for citations
- **Real-time Progress** bars with SSE integration
- **Table Editor** for extracted data
- **Chat Interface** with streaming responses
- **Charts** for analytics (Recharts)
- **Toast Notifications** for user feedback

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 20 + TypeScript 5.3
- **Framework**: Fastify 4.x (high performance)
- **Database**: PostgreSQL 16 + pgvector (embeddings)
- **Cache**: Redis 7 (auth cache, rate limiting)
- **AI**: OpenAI GPT-4 + text-embedding-ada-002
- **Queue**: BullMQ for document processing
- **OCR**: Tesseract.js for scanned documents
- **Storage**: S3-compatible + local fallback

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5 (fast development)
- **Routing**: TanStack Router (type-safe)
- **State**: TanStack Query + Zustand
- **UI**: Shadcn/ui + Radix UI + Tailwind CSS
- **PDF**: PDF.js for document rendering
- **Charts**: Recharts for analytics
- **Forms**: React Hook Form + Zod validation

### DevOps
- **Package Manager**: pnpm workspaces
- **Linting**: ESLint + Prettier
- **Testing**: Vitest + Playwright (E2E)
- **Docker**: Multi-service composition
- **CI/CD**: GitHub Actions ready

## 🧪 Testing

### API Tests
```bash
# Unit tests
pnpm test:api

# Integration tests
pnpm test:api:integration
```

### Frontend Tests
```bash
# Component tests
pnpm test:web

# E2E tests
pnpm test:e2e
```

## 📚 Documentation

- **API Docs**: Available at `http://localhost:3002/docs` (Swagger UI)
- **Technical Docs**: See `DOCUMENTACAO_TECNICA.txt`
- **SDK Docs**: Auto-generated from OpenAPI specification

## 🐳 Docker Development

```bash
# Start all services
docker-compose -f infra/docker-compose.local.yml up -d

# Check logs
docker-compose -f infra/docker-compose.local.yml logs -f

# Stop services
docker-compose -f infra/docker-compose.local.yml down
```

Services included:
- PostgreSQL 16 with pgvector
- Redis 7 for caching
- MinIO for S3-compatible storage
- API server
- Web frontend

## 🔧 Configuration

### Environment Variables

#### API (.env)
```bash
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/paperflow
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4
MAX_FILE_SIZE_MB=50
```

#### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:3002
VITE_APP_NAME=PaperFlow Studio
```

## 🚀 Deployment

### Production Build
```bash
# Build all packages
pnpm build

# Build individual packages
pnpm build:api    # API server
pnpm build:web    # Frontend app
pnpm build:sdk    # TypeScript SDK
```

### Production Environment
- Set `NODE_ENV=production`
- Configure real PostgreSQL + Redis
- Set up S3 bucket for storage
- Configure HTTPS reverse proxy
- Set up monitoring and logging

## 📊 Current Status

### ✅ Completed
- [x] Complete Backend API with 25+ endpoints
- [x] Real AI integration (OpenAI GPT-4)
- [x] Complete RAG system with vector search
- [x] PDF processing with table extraction
- [x] OCR integration with Tesseract
- [x] Real-time SSE for progress tracking
- [x] Secure authentication system
- [x] Usage analytics system  
- [x] TypeScript SDK with auto-generation
- [x] OpenAPI specification endpoint
- [x] Mock services for development
- [x] Docker configuration
- [x] Comprehensive documentation

### 🔄 In Progress
- [ ] React frontend application
- [ ] PDF viewer with highlights
- [ ] Real-time chat interface
- [ ] Analytics dashboard

### 📋 Next Steps
- [ ] Complete frontend pages
- [ ] E2E testing suite
- [ ] Production deployment guides
- [ ] Performance optimizations
- [ ] Advanced monitoring setup

## 🤝 Contributing

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Start development: `pnpm dev`
4. Make changes and test
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

---

## 🎯 MVP Acceptance Criteria ✅

✅ **API Server**: Complete backend with all specified endpoints  
✅ **OpenAPI Spec**: Available at `/openapi.json`  
✅ **SSE Support**: Real-time document processing events  
✅ **AI Integration**: GPT-4 + RAG system working  
✅ **SDK**: Auto-generated TypeScript client  
✅ **Documentation**: Comprehensive technical docs  
✅ **Development Ready**: Local setup with mock services  

🔄 **Frontend**: React app structure created, implementation in progress  
📋 **Docker**: Configuration ready, needs final testing  

**Ready to test**: Start the API server (`pnpm dev:api`) and explore the endpoints!

---

*Built with ❤️ by the PaperFlow team*