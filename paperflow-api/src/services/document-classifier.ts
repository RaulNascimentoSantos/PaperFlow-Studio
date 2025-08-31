import { 
  DocumentClassification, 
  EntityExtraction, 
  DocumentFeatures, 
  ClassificationResult,
  DocumentStructure 
} from '../types/classification';
import { DatabaseService } from './database';

export class DocumentClassifier {
  constructor(private db: DatabaseService) {}

  async classifyDocument(
    buffer: Buffer, 
    mimeType: string, 
    tenantId: string
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Extract text and metadata
      const text = await this.extractText(buffer, mimeType);
      const metadata = await this.extractMetadata(buffer, mimeType);
      
      // 2. Extract document features
      const features = await this.extractFeatures(text, buffer);
      
      // 3. Classify document type
      const classification = await this.performClassification(text, features, metadata);
      
      // 4. Extract entities
      classification.extractedEntities = await this.extractEntities(text);
      
      // 5. Suggest template if available
      classification.suggestedTemplate = await this.suggestTemplate(
        classification.primaryType, 
        features, 
        tenantId
      );
      
      // 6. Generate suggested actions
      const suggestedActions = this.generateSuggestedActions(classification, features);
      
      const processingTime = Date.now() - startTime;
      
      return {
        classification,
        features,
        processingTime,
        suggestedActions
      };
      
    } catch (error) {
      console.error('Error in document classification:', error);
      
      // Return basic classification on error
      const processingTime = Date.now() - startTime;
      return {
        classification: {
          primaryType: 'unknown',
          confidence: 0,
          metadata: {},
          extractedEntities: []
        },
        features: {
          wordCount: 0,
          pageCount: 1,
          hasSignature: false,
          hasTable: false,
          hasLogo: false,
          language: 'pt',
          documentStructure: {
            hasHeader: false,
            hasFooter: false,
            paragraphCount: 0,
            sectionCount: 0,
            listCount: 0,
            tableCount: 0
          }
        },
        processingTime,
        suggestedActions: []
      };
    }
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    // Mock text extraction for development
    // In production, this would use libraries like pdf2pic, mammoth, etc.
    
    if (mimeType === 'application/pdf') {
      return this.mockPdfTextExtraction(buffer);
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return this.mockDocxTextExtraction(buffer);
    } else if (mimeType.includes('text')) {
      return buffer.toString('utf-8');
    } else {
      // Try OCR for images or fallback
      return this.mockOcrExtraction(buffer);
    }
  }

  private mockPdfTextExtraction(buffer: Buffer): string {
    // Mock PDF text extraction
    const samples = [
      'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nContratante: João Silva\nCPF: 123.456.789-00\nContratado: Empresa ABC LTDA\nCNPJ: 12.345.678/0001-90\n\nO presente contrato tem por objeto a prestação de serviços de consultoria...',
      'NOTA FISCAL ELETRÔNICA\nNF-e: 000123456\nEmpresa: Fornecedor XYZ\nCNPJ: 98.765.432/0001-10\nCliente: Comprador ABC\nData: 31/08/2024\nValor Total: R$ 1.500,00',
      'RECIBO DE PAGAMENTO\nPagador: Maria Santos\nBeneficiário: Prestador de Serviços\nValor: R$ 800,00\nData: 30/08/2024\nDescrição: Serviços de consultoria jurídica',
      'CERTIDÃO DE NASCIMENTO\nCartório: 1º Ofício de Registro Civil\nNome: Ana Paula Silva\nNascimento: 15/03/1990\nNaturalidade: São Paulo/SP\nPai: Carlos Silva\nMãe: Rita Silva'
    ];
    
    return samples[Math.floor(Math.random() * samples.length)];
  }

  private mockDocxTextExtraction(buffer: Buffer): string {
    return 'DOCUMENTO WORD\n\nEste é um documento de exemplo extraído de um arquivo Word. Contém informações sobre processos administrativos e dados pessoais que precisam ser classificados adequadamente.';
  }

  private mockOcrExtraction(buffer: Buffer): string {
    return 'TEXTO EXTRAÍDO VIA OCR\n\nDocumento digitalizado contendo informações que foram processadas através de reconhecimento óptico de caracteres.';
  }

  private async extractMetadata(buffer: Buffer, mimeType: string): Promise<Record<string, any>> {
    return {
      mimeType,
      size: buffer.length,
      extractedAt: new Date().toISOString(),
      processingMethod: this.getProcessingMethod(mimeType)
    };
  }

  private getProcessingMethod(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf_parser';
    if (mimeType.includes('word')) return 'docx_parser';
    if (mimeType.includes('text')) return 'text_parser';
    return 'ocr';
  }

  private async extractFeatures(text: string, buffer: Buffer): Promise<DocumentFeatures> {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Mock page count estimation based on text length
    const estimatedPageCount = Math.max(1, Math.ceil(text.length / 2500));
    
    return {
      wordCount: words.length,
      pageCount: estimatedPageCount,
      hasSignature: this.detectSignature(text),
      hasTable: this.detectTable(text),
      hasLogo: this.detectLogo(text),
      language: this.detectLanguage(text),
      documentStructure: this.analyzeStructure(text, paragraphs)
    };
  }

  private detectSignature(text: string): boolean {
    const signaturePatterns = [
      /assinatura/i,
      /assinar/i,
      /assinado\s+por/i,
      /____+/,
      /\.{10,}/,
      /signed\s+by/i
    ];
    
    return signaturePatterns.some(pattern => pattern.test(text));
  }

  private detectTable(text: string): boolean {
    const tablePatterns = [
      /\|.*\|.*\|/,
      /\t.*\t.*\t/,
      /\+[-+\s]*\+/,
      /total\s*[:=]\s*r?\$?\s*\d/i,
      /quantidade\s+[\s\w]*valor/i
    ];
    
    return tablePatterns.some(pattern => pattern.test(text));
  }

  private detectLogo(text: string): boolean {
    // Mock logo detection - in production would analyze buffer for images
    const logoIndicators = [
      /logo/i,
      /marca/i,
      /cabeçalho/i,
      /empresa/i
    ];
    
    return logoIndicators.some(pattern => pattern.test(text));
  }

  private detectLanguage(text: string): string {
    const portugueseWords = ['de', 'da', 'do', 'e', 'o', 'a', 'para', 'com', 'em', 'por', 'que', 'não'];
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    
    const words = text.toLowerCase().split(/\s+/);
    const ptCount = words.filter(w => portugueseWords.includes(w)).length;
    const enCount = words.filter(w => englishWords.includes(w)).length;
    
    return ptCount > enCount ? 'pt' : 'en';
  }

  private analyzeStructure(text: string, paragraphs: string[]): DocumentStructure {
    const lines = text.split('\n');
    
    return {
      hasHeader: this.detectHeader(lines),
      hasFooter: this.detectFooter(lines),
      paragraphCount: paragraphs.length,
      sectionCount: this.countSections(text),
      listCount: this.countLists(text),
      tableCount: this.countTables(text)
    };
  }

  private detectHeader(lines: string[]): boolean {
    if (lines.length < 3) return false;
    const firstLines = lines.slice(0, 3).join('\n');
    return /empresa|companhia|ltda|s\.a\.|cnpj/i.test(firstLines);
  }

  private detectFooter(lines: string[]): boolean {
    if (lines.length < 3) return false;
    const lastLines = lines.slice(-3).join('\n');
    return /página|telefone|email|endereço|www\./i.test(lastLines);
  }

  private countSections(text: string): number {
    const sectionPatterns = [
      /^\s*\d+[\.\)]\s+/gm,
      /^[A-Z\s]{5,}$/gm,
      /^\s*[IVX]+[\.\)]\s+/gm
    ];
    
    let count = 0;
    sectionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });
    
    return count;
  }

  private countLists(text: string): number {
    const listPatterns = [
      /^\s*[-*•]\s+/gm,
      /^\s*\d+[\.\)]\s+/gm,
      /^\s*[a-z]\)\s+/gm
    ];
    
    let count = 0;
    listPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });
    
    return Math.ceil(count / 3); // Estimate number of lists
  }

  private countTables(text: string): number {
    const tableMatches = text.match(/\|.*\|.*\|/g);
    return tableMatches ? Math.ceil(tableMatches.length / 5) : 0; // Estimate tables
  }

  private async performClassification(
    text: string, 
    features: DocumentFeatures, 
    metadata: Record<string, any>
  ): Promise<DocumentClassification> {
    
    // Define document type patterns
    const patterns = {
      invoice: {
        patterns: [
          /nota\s+fiscal/i,
          /nf-?e/i,
          /danfe/i,
          /fatura/i,
          /cobrança/i
        ],
        weight: 1.0
      },
      contract: {
        patterns: [
          /contrato/i,
          /acordo/i,
          /termo/i,
          /aditivo/i,
          /instrumento/i
        ],
        weight: 1.0
      },
      receipt: {
        patterns: [
          /recibo/i,
          /comprovante/i,
          /pagamento/i,
          /quitação/i
        ],
        weight: 0.9
      },
      identity: {
        patterns: [
          /\brg\b/i,
          /cpf/i,
          /cnh/i,
          /carteira/i,
          /identidade/i,
          /certidão/i
        ],
        weight: 1.0
      },
      medical: {
        patterns: [
          /aso/i,
          /atestado/i,
          /exame/i,
          /laudo/i,
          /médico/i,
          /clínica/i
        ],
        weight: 1.0
      },
      academic: {
        patterns: [
          /diploma/i,
          /certificado/i,
          /histórico/i,
          /boletim/i,
          /universidade/i,
          /faculdade/i
        ],
        weight: 1.0
      },
      legal: {
        patterns: [
          /procuração/i,
          /petição/i,
          /sentença/i,
          /acórdão/i,
          /tribunal/i,
          /processo/i
        ],
        weight: 1.0
      },
      financial: {
        patterns: [
          /extrato/i,
          /balancete/i,
          /demonstrativo/i,
          /financeiro/i,
          /balanço/i
        ],
        weight: 0.9
      }
    };

    // Calculate scores for each document type
    const scores: Record<string, number> = {};
    
    for (const [type, config] of Object.entries(patterns)) {
      let score = 0;
      
      for (const pattern of config.patterns) {
        const matches = text.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          score += matches.length * config.weight;
        }
      }
      
      scores[type] = score;
    }

    // Find the highest scoring type
    const sortedTypes = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score > 0);

    if (sortedTypes.length === 0) {
      return {
        primaryType: 'unknown',
        confidence: 0,
        metadata,
        extractedEntities: []
      };
    }

    const [primaryType, score] = sortedTypes[0];
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
    const confidence = Math.min(1, score / Math.max(1, totalScore));

    return {
      primaryType,
      confidence: Math.round(confidence * 100) / 100,
      metadata: {
        ...metadata,
        allScores: scores,
        topCandidates: sortedTypes.slice(0, 3).map(([type, score]) => ({ type, score }))
      },
      extractedEntities: []
    };
  }

  private async extractEntities(text: string): Promise<EntityExtraction[]> {
    const entities: EntityExtraction[] = [];

    // CPF pattern
    const cpfPattern = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
    let match;
    while ((match = cpfPattern.exec(text)) !== null) {
      entities.push({
        type: 'cpf',
        value: match[0],
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    // CNPJ pattern
    const cnpjPattern = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
    while ((match = cnpjPattern.exec(text)) !== null) {
      entities.push({
        type: 'cnpj',
        value: match[0],
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    // Phone pattern (Brazilian)
    const phonePattern = /\(?(?:\+55\s?)?(?:\(?\d{2}\)?)\s?\d{4,5}-?\d{4}\b/g;
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({
        type: 'phone',
        value: match[0],
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    // Currency pattern (Brazilian Real)
    const currencyPattern = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
    while ((match = currencyPattern.exec(text)) !== null) {
      entities.push({
        type: 'currency',
        value: match[0],
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    // Date pattern (Brazilian format)
    const datePattern = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
    while ((match = datePattern.exec(text)) !== null) {
      entities.push({
        type: 'date',
        value: match[0],
        confidence: 0.7,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    return entities;
  }

  private async suggestTemplate(
    documentType: string, 
    features: DocumentFeatures, 
    tenantId: string
  ): Promise<string | undefined> {
    try {
      // Query for templates that match the document type
      const result = await this.db.query(`
        SELECT id, name 
        FROM document_templates 
        WHERE tenant_id = $1 
          AND category = $2 
          AND active = true 
        ORDER BY usage_count DESC 
        LIMIT 1
      `, [tenantId, documentType]);

      return result.rows[0]?.name;
    } catch (error) {
      console.error('Error suggesting template:', error);
      return undefined;
    }
  }

  private generateSuggestedActions(
    classification: DocumentClassification, 
    features: DocumentFeatures
  ): string[] {
    const actions: string[] = [];

    // Based on document type
    switch (classification.primaryType) {
      case 'invoice':
        actions.push('Extrair dados da nota fiscal');
        actions.push('Validar informações fiscais');
        actions.push('Arquivar em pasta de documentos fiscais');
        break;
      
      case 'contract':
        actions.push('Revisar cláusulas contratuais');
        actions.push('Configurar lembretes de vencimento');
        actions.push('Solicitar aprovação jurídica');
        break;
      
      case 'identity':
        actions.push('Validar dados pessoais');
        actions.push('Armazenar com segurança adicional');
        actions.push('Aplicar política de retenção');
        break;
      
      case 'medical':
        actions.push('Aplicar classificação de sigilo médico');
        actions.push('Configurar acesso restrito');
        actions.push('Definir período de retenção');
        break;
    }

    // Based on document features
    if (classification.extractedEntities.some(e => e.type === 'cpf' || e.type === 'cnpj')) {
      actions.push('Aplicar proteção de dados pessoais (LGPD)');
    }

    if (features.hasSignature) {
      actions.push('Verificar autenticidade da assinatura');
    }

    if (features.hasTable) {
      actions.push('Extrair dados tabulares');
    }

    return actions;
  }
}