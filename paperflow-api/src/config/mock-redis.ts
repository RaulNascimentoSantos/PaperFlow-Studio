import { env } from './env';

// Mock Redis client for development
class MockRedisClient {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      console.log('🔌 Mock Redis client connected');
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      console.log('🔌 Mock Redis client disconnected');
      this.connected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    this.cleanExpired();
    
    const value = this.data.get(key);
    console.log(`📥 Mock Redis GET ${key}:`, value ? 'found' : 'not found');
    return value || null;
  }

  async set(key: string, value: string): Promise<string> {
    await this.connect();
    this.data.set(key, value);
    console.log(`📤 Mock Redis SET ${key}`);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    await this.connect();
    this.data.set(key, value);
    this.expirations.set(key, Date.now() + (seconds * 1000));
    console.log(`📤 Mock Redis SETEX ${key} (expires in ${seconds}s)`);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    await this.connect();
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    console.log(`🗑️ Mock Redis DEL ${key}:`, existed ? 'deleted' : 'not found');
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    await this.connect();
    this.cleanExpired();
    const exists = this.data.has(key);
    return exists ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    await this.connect();
    const current = parseInt(this.data.get(key) || '0');
    const newValue = current + 1;
    this.data.set(key, newValue.toString());
    console.log(`📈 Mock Redis INCR ${key}: ${newValue}`);
    return newValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    await this.connect();
    if (this.data.has(key)) {
      this.expirations.set(key, Date.now() + (seconds * 1000));
      console.log(`⏰ Mock Redis EXPIRE ${key} in ${seconds}s`);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    await this.connect();
    const expiration = this.expirations.get(key);
    if (!expiration) return -1; // No expiration set
    
    const remaining = Math.max(0, Math.ceil((expiration - Date.now()) / 1000));
    return remaining > 0 ? remaining : -2; // -2 means expired
  }

  async ping(): Promise<string> {
    await this.connect();
    console.log('🏓 Mock Redis PING');
    return 'PONG';
  }

  async quit(): Promise<string> {
    await this.disconnect();
    console.log('👋 Mock Redis QUIT');
    return 'OK';
  }

  async flushall(): Promise<string> {
    await this.connect();
    this.data.clear();
    this.expirations.clear();
    console.log('🧹 Mock Redis FLUSHALL');
    return 'OK';
  }

  // Clean up expired keys
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, expiration] of this.expirations.entries()) {
      if (expiration <= now) {
        this.data.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  // Periodically clean expired keys
  private startCleanupTimer(): void {
    setInterval(() => this.cleanExpired(), 60000); // Every minute
  }
}

// Mock BullMQ Queue
class MockQueue {
  private name: string;
  private jobs: Array<{ id: string; name: string; data: any; timestamp: number }> = [];

  constructor(name: string, connection?: any) {
    this.name = name;
    console.log(`📋 Mock Queue created: ${name}`);
  }

  async add(name: string, data: any): Promise<{ id: string }> {
    const job = {
      id: Math.random().toString(36).substring(7),
      name,
      data,
      timestamp: Date.now(),
    };
    
    this.jobs.push(job);
    console.log(`➕ Mock Job added to ${this.name}:`, name, data);
    
    // Simulate processing (immediate for development)
    setTimeout(() => this.processJob(job), 100);
    
    return { id: job.id };
  }

  private async processJob(job: any): Promise<void> {
    console.log(`⚡ Mock Job processing: ${job.name}`);
    
    // Simulate real document processing
    if (job.name === 'process-document' && job.data.documentId) {
      setTimeout(async () => {
        await this.simulateDocumentProcessing(job.data.documentId);
      }, 2000); // Simulate 2 second processing delay
    }
  }

  private async simulateDocumentProcessing(documentId: string): Promise<void> {
    console.log(`📄 Simulating processing for document: ${documentId}`);
    
    // Mock extracted text from our test PDF
    const mockExtractedText = `
RELATORIO FINANCEIRO TRIMESTRAL - Q3 2024

RESUMO EXECUTIVO
Este relatorio apresenta os resultados da Empresa XYZ Ltda.
Principais destaques do trimestre:
- Crescimento de receita de 15 porcento
- Margem operacional de 22 porcento  
- EBITDA de R$ 632.500
- Expansao da base de clientes em 25 porcento

DESEMPENHO FINANCEIRO
Receita Q2 2024: R$ 2.500.000
Receita Q3 2024: R$ 2.875.000
Crescimento: +15 porcento
Custos Operacionais: R$ 2.242.500
EBITDA: R$ 632.500 (margem de 22%)
Lucro Liquido: R$ 450.000

PRINCIPAIS PRODUTOS
1. Software PaperFlow: R$ 1.200.000
   Representa 42% da receita total
   Processamento de documentos com IA
   Sistema RAG para consultas inteligentes
2. Consultoria em IA: R$ 850.000
   Representa 30% da receita total
   Machine Learning e automacao
3. Treinamentos: R$ 500.000
   Representa 17% da receita total
   Cursos empresariais de IA
4. Licenciamento: R$ 325.000
   Representa 11% da receita total
   APIs e algoritmos proprietarios

ANALISE DE MERCADO
O mercado de IA cresceu 35% no ultimo ano.
Nossa participacao: 8% do mercado nacional.
Oportunidades de crescimento significativo.

PROJECOES Q4 2024
Receita projetada: R$ 3.200.000 (+11%)
150 novos clientes empresariais
3 novos produtos em desenvolvimento
Expansao geografica para SP e RS
Contratacao de 25 funcionarios

CONCLUSOES
Desempenho solido no Q3 2024.
Crescimento consistente e margens saudaveis.
Perspectivas otimistas para Q4.
`.trim();

    const mockMetadata = {
      title: "Relatório Financeiro Trimestral - Q3 2024",
      word_count: 285,
      char_count: mockExtractedText.length,
      tables_count: 1,
      processing_info: {
        method: "mock",
        ocr_confidence: 0.95,
        language: "pt"
      },
      tables: [
        {
          name: "Desempenho Financeiro",
          rows: [
            ["Métrica", "Q2 2024", "Q3 2024", "Variação"],
            ["Receita", "R$ 2.500.000", "R$ 2.875.000", "+15%"],
            ["Custos", "R$ 1.950.000", "R$ 2.242.500", "+15%"],
            ["EBITDA", "R$ 550.000", "R$ 632.500", "+15%"]
          ]
        }
      ]
    };

    try {
      // Import DocumentService dynamically to avoid circular imports
      const { DocumentService } = await import('../services/document.js');
      await DocumentService.updateDocumentStatus(
        documentId,
        'completed',
        mockExtractedText,
        mockMetadata
      );
      console.log(`✅ Document ${documentId} processing completed!`);
    } catch (error) {
      console.error(`❌ Error processing document ${documentId}:`, error);
    }
  }

  async getJobs(): Promise<any[]> {
    return this.jobs;
  }

  async close(): Promise<void> {
    console.log(`📋 Mock Queue closed: ${this.name}`);
  }
}

// Create singleton instances
export const mockRedis = new MockRedisClient();

// Export factory function for creating Redis clients
export function createRedisClient(url: string) {
  if (env.NODE_ENV === 'development') {
    console.log('🧪 Using mock Redis client for development');
    return mockRedis;
  }
  
  // In production, create real Redis client
  const { createClient } = require('redis');
  return createClient({ url });
}

// Export factory function for creating BullMQ queues
export function createQueue(name: string, connection?: any) {
  if (env.NODE_ENV === 'development') {
    return new MockQueue(name, connection);
  }
  
  // In production, create real BullMQ queue
  const { Queue } = require('bullmq');
  return new Queue(name, connection);
}