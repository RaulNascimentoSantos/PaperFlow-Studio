import { 
  AIProvider, 
  SummarizeOptions, 
  SummaryResult, 
  QueryOptions, 
  QueryResult, 
  ClassificationResult 
} from './types';

export class MockProvider implements AIProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    // Generate a mock embedding vector of 384 dimensions (all-MiniLM-L6-v2 size)
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  async summarize(text: string, options: SummarizeOptions = {}): Promise<SummaryResult> {
    const { type = 'executive', maxLength = 500, language = 'pt-BR' } = options;
    
    await this.delay(500); // Simulate processing time

    return {
      summary: `Esta é uma sumarização ${type} mock do documento. O texto contém aproximadamente ${text.length} caracteres e foi processado com parâmetros específicos para ${language}.`,
      key_points: [
        'Primeiro ponto-chave identificado no documento',
        'Segundo aspecto importante destacado',
        'Terceira conclusão relevante extraída',
        'Quarta observação crítica do conteúdo'
      ],
      tokens_used: Math.floor(text.length / 4),
      model: 'mock-ai-model',
    };
  }

  async query(context: string, question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const startTime = Date.now();
    await this.delay(300);

    return {
      answer: `Com base no contexto fornecido, posso responder que "${question}" se relaciona com os aspectos principais do documento. Esta é uma resposta mock que simula análise do conteúdo.`,
      sources: [
        {
          page: Math.floor(Math.random() * 10) + 1,
          snippet: context.substring(0, 150) + '...',
          confidence: 0.85 + Math.random() * 0.15,
        },
        {
          page: Math.floor(Math.random() * 10) + 1,
          snippet: 'Trecho relevante do documento que suporta a resposta...',
          confidence: 0.75 + Math.random() * 0.15,
        },
      ],
      tokens_used: Math.floor((context.length + question.length) / 3),
      processing_time_ms: Date.now() - startTime,
    };
  }

  async classify(text: string, taxonomy: string[]): Promise<ClassificationResult> {
    await this.delay(200);

    const classification = taxonomy[Math.floor(Math.random() * taxonomy.length)];
    const confidence = 0.7 + Math.random() * 0.3;

    const subTypes: Record<string, string[]> = {
      contract: ['service_agreement', 'purchase_agreement', 'employment_contract'],
      invoice: ['service_invoice', 'product_invoice', 'recurring_invoice'],
      report: ['financial_report', 'technical_report', 'status_report'],
      other: ['miscellaneous', 'unknown_type'],
    };

    const subTypeOptions = subTypes[classification] || subTypes.other;
    const subType = subTypeOptions[Math.floor(Math.random() * subTypeOptions.length)];

    return {
      classification,
      confidence,
      sub_type: subType,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}