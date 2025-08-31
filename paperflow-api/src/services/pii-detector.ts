import { db } from '@/config/database';
import { CustodyChainService } from './custody-chain';

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export class PIIDetectorService {
  private static patterns = {
    cpf: {
      regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
      type: 'CPF',
      confidence: 0.95,
      validator: (value: string) => {
        // Validação básica de CPF
        const cpf = value.replace(/\D/g, '');
        if (cpf.length !== 11) return false;
        
        // Verifica sequências iguais
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        // Validação dos dígitos verificadores
        let sum = 0;
        for (let i = 0; i < 9; i++) {
          sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(cpf.charAt(9))) return false;
        
        sum = 0;
        for (let i = 0; i < 10; i++) {
          sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        return digit === parseInt(cpf.charAt(10));
      }
    },
    cnpj: {
      regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
      type: 'CNPJ',
      confidence: 0.95,
      validator: (value: string) => {
        const cnpj = value.replace(/\D/g, '');
        if (cnpj.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(cnpj)) return false;
        
        // Validação CNPJ
        const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(cnpj.charAt(i)) * weights1[i];
        }
        let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (digit !== parseInt(cnpj.charAt(12))) return false;
        
        sum = 0;
        for (let i = 0; i < 13; i++) {
          sum += parseInt(cnpj.charAt(i)) * weights2[i];
        }
        digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return digit === parseInt(cnpj.charAt(13));
      }
    },
    oab: {
      regex: /OAB[\/\s-]?[A-Z]{2}[\/\s-]?\d{4,6}/gi,
      type: 'OAB',
      confidence: 0.90,
    },
    processo_cnj: {
      regex: /\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g,
      type: 'Processo CNJ',
      confidence: 0.95,
    },
    rg: {
      regex: /RG[\s:]*\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]/gi,
      type: 'RG',
      confidence: 0.85,
    },
    telefone: {
      regex: /(\(?\d{2}\)?[\s-]?)?\d{4,5}[-\s]?\d{4}/g,
      type: 'Telefone',
      confidence: 0.80,
      validator: (value: string) => {
        const phone = value.replace(/\D/g, '');
        return phone.length >= 8 && phone.length <= 11;
      }
    },
    email: {
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      type: 'Email',
      confidence: 0.95,
    },
    cep: {
      regex: /\d{5}-?\d{3}/g,
      type: 'CEP',
      confidence: 0.85,
    },
    placa_veiculo: {
      regex: /[A-Z]{3}[-\s]?\d{4}|[A-Z]{3}[-\s]?\d{1}[A-Z]{1}\d{2}/g,
      type: 'Placa',
      confidence: 0.90,
    },
    conta_bancaria: {
      regex: /(?:conta|c\/c|ag[eê]ncia)[\s:]*\d{3,6}[-\s]?\d{1,2}?/gi,
      type: 'Conta Bancária',
      confidence: 0.75,
    },
    pix: {
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
      type: 'PIX',
      confidence: 0.70,
    }
  };
  
  /**
   * Detecta PII em um texto
   */
  static detectPII(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    
    for (const [key, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern.regex);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // Validação adicional se disponível
        let isValid = true;
        if (pattern.validator) {
          isValid = pattern.validator(match[0]);
        }
        
        if (isValid) {
          matches.push({
            type: pattern.type,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: pattern.confidence,
          });
        }
      }
    }
    
    // Ordenar por posição e remover sobreposições
    const sortedMatches = matches.sort((a, b) => a.start - b.start);
    const filteredMatches: PIIMatch[] = [];
    
    for (const match of sortedMatches) {
      const lastMatch = filteredMatches[filteredMatches.length - 1];
      if (!lastMatch || match.start >= lastMatch.end) {
        filteredMatches.push(match);
      } else if (match.confidence > lastMatch.confidence) {
        // Substituir por match com maior confiança
        filteredMatches[filteredMatches.length - 1] = match;
      }
    }
    
    return filteredMatches;
  }
  
  /**
   * Redige PII em um texto
   */
  static redactText(text: string, matches: PIIMatch[]): string {
    let redactedText = text;
    
    // Aplicar redações de trás para frente para manter índices
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
    
    for (const match of sortedMatches) {
      const redaction = `[${match.type}: REDACTED]`;
      redactedText = 
        redactedText.substring(0, match.start) + 
        redaction + 
        redactedText.substring(match.end);
    }
    
    return redactedText;
  }
  
  /**
   * Analisa documento completo para PII
   */
  static async analyzeDocument(documentId: string): Promise<{
    totalMatches: number;
    byType: Record<string, number>;
    byPage: Array<{
      pageNumber: number;
      matches: PIIMatch[];
    }>;
  }> {
    const pages = await db.query(
      'SELECT page_number, text FROM document_pages WHERE document_id = $1 ORDER BY page_number',
      [documentId]
    );
    
    const result = {
      totalMatches: 0,
      byType: {} as Record<string, number>,
      byPage: [] as Array<{ pageNumber: number; matches: PIIMatch[] }>,
    };
    
    for (const page of pages.rows) {
      const matches = this.detectPII(page.text || '');
      
      result.byPage.push({
        pageNumber: page.page_number,
        matches,
      });
      
      result.totalMatches += matches.length;
      
      for (const match of matches) {
        result.byType[match.type] = (result.byType[match.type] || 0) + 1;
      }
    }
    
    // Salvar resultados nos metadados
    await db.query(
      `UPDATE documents 
       SET metadata = jsonb_set(metadata, '{detectedPii}', $1::jsonb) 
       WHERE id = $2`,
      [JSON.stringify(Object.keys(result.byType)), documentId]
    );
    
    // Registrar no audit log
    await CustodyChainService.logAction({
      documentId,
      action: 'pii_analysis_completed',
      actor: 'system',
      payload: {
        totalMatches: result.totalMatches,
        types: Object.keys(result.byType),
      },
    });
    
    return result;
  }
  
  /**
   * Aplica redações em todas as páginas de um documento
   */
  static async redactDocument(
    documentId: string, 
    selectedTypes: string[] = []
  ): Promise<{
    success: boolean;
    redactedPages: number;
    totalRedactions: number;
  }> {
    const analysis = await this.analyzeDocument(documentId);
    let totalRedactions = 0;
    let redactedPages = 0;
    
    for (const pageData of analysis.byPage) {
      // Filtrar matches por tipos selecionados
      const matchesToRedact = selectedTypes.length > 0 
        ? pageData.matches.filter(m => selectedTypes.includes(m.type))
        : pageData.matches;
      
      if (matchesToRedact.length > 0) {
        // Buscar texto original da página
        const pageResult = await db.query(
          'SELECT text FROM document_pages WHERE document_id = $1 AND page_number = $2',
          [documentId, pageData.pageNumber]
        );
        
        if (pageResult.rows.length > 0) {
          const originalText = pageResult.rows[0].text;
          const redactedText = this.redactText(originalText, matchesToRedact);
          
          // Salvar redações na página
          await db.query(
            'UPDATE document_pages SET redactions = $1 WHERE document_id = $2 AND page_number = $3',
            [JSON.stringify(matchesToRedact), documentId, pageData.pageNumber]
          );
          
          totalRedactions += matchesToRedact.length;
          redactedPages++;
        }
      }
    }
    
    // Registrar no audit log
    await CustodyChainService.logAction({
      documentId,
      action: 'pii_redaction_applied',
      actor: 'system',
      payload: {
        selectedTypes,
        redactedPages,
        totalRedactions,
      },
    });
    
    return {
      success: true,
      redactedPages,
      totalRedactions,
    };
  }
}