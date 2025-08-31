import { db } from '@/config/database';
import { storage } from '@/config/storage';
import { CustodyChainService } from './custody-chain';
import { env } from '@/config/env';

export interface BatesOptions {
  prefix: string;
  startNumber: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  fontSize?: number;
  opacity?: number;
  color?: { r: number; g: number; b: number };
}

export class BatesNumberingService {
  /**
   * Aplica numeração Bates usando mock para demonstração
   * Em produção, usaria PDF-lib para manipulação real do PDF
   */
  static async applyBatesNumbers(
    documentId: string,
    options: BatesOptions
  ): Promise<{
    success: boolean;
    totalPages: number;
    startNumber: number;
    endNumber: number;
    outputKey: string;
  }> {
    try {
      // Configurações padrão
      const config = {
        position: options.position || 'bottom-right',
        fontSize: options.fontSize || 10,
        opacity: options.opacity || 1.0,
        color: options.color || { r: 0, g: 0, b: 0 },
      };
      
      // Buscar documento
      const doc = await db.query(
        'SELECT * FROM documents WHERE id = $1',
        [documentId]
      );
      
      if (!doc.rows.length) {
        throw new Error('Document not found');
      }
      
      // Buscar páginas do documento
      const pages = await db.query(
        'SELECT * FROM document_pages WHERE document_id = $1 ORDER BY page_number',
        [documentId]
      );
      
      if (!pages.rows.length) {
        throw new Error('No pages found for document');
      }
      
      // Aplicar numeração Bates
      let currentNumber = options.startNumber;
      
      for (const page of pages.rows) {
        const batesNumber = `${options.prefix}${String(currentNumber).padStart(6, '0')}`;
        
        // Atualizar página no banco com o número Bates
        await db.query(
          'UPDATE document_pages SET bates_number = $1 WHERE document_id = $2 AND page_number = $3',
          [batesNumber, documentId, page.page_number]
        );
        
        currentNumber++;
      }
      
      // Simular criação do PDF com numeração Bates
      const outputKey = `documents/${documentId}/bates.pdf`;
      const mockPdfContent = `Mock PDF with Bates numbering applied: ${options.prefix}${String(options.startNumber).padStart(6, '0')} to ${options.prefix}${String(currentNumber - 1).padStart(6, '0')}`;
      
      // Em ambiente mock, não criamos arquivo real
      if (!env.USE_MOCKS) {
        // Aqui integraria com PDF-lib para criar PDF real
        // const pdfBytes = await this.generateBatesPdf(documentId, pages.rows, options);
        // await storage.putObject(outputKey, pdfBytes);
      }
      
      // Atualizar documento com informações de Bates
      const endNumber = currentNumber - 1;
      await db.query(
        'UPDATE documents SET bates_prefix = $1, bates_start = $2, bates_end = $3 WHERE id = $4',
        [options.prefix, options.startNumber, endNumber, documentId]
      );
      
      // Registrar no audit log
      await CustodyChainService.logAction({
        documentId,
        action: 'bates_applied',
        actor: 'system',
        payload: {
          prefix: options.prefix,
          startNumber: options.startNumber,
          endNumber,
          totalPages: pages.rows.length,
          position: config.position,
          fontSize: config.fontSize,
        },
      });
      
      return {
        success: true,
        totalPages: pages.rows.length,
        startNumber: options.startNumber,
        endNumber,
        outputKey,
      };
    } catch (error) {
      await CustodyChainService.logAction({
        documentId,
        action: 'bates_failed',
        actor: 'system',
        payload: { error: error.message },
      });
      throw error;
    }
  }
  
  /**
   * Remove numeração Bates de um documento
   */
  static async removeBatesNumbers(documentId: string): Promise<{
    success: boolean;
    pagesUpdated: number;
  }> {
    try {
      // Remover números Bates das páginas
      const result = await db.query(
        'UPDATE document_pages SET bates_number = NULL WHERE document_id = $1',
        [documentId]
      );
      
      // Limpar informações Bates do documento
      await db.query(
        'UPDATE documents SET bates_prefix = NULL, bates_start = NULL, bates_end = NULL WHERE id = $1',
        [documentId]
      );
      
      // Registrar no audit log
      await CustodyChainService.logAction({
        documentId,
        action: 'bates_removed',
        actor: 'system',
        payload: {
          pagesUpdated: result.rowCount,
        },
      });
      
      return {
        success: true,
        pagesUpdated: result.rowCount || 0,
      };
    } catch (error) {
      await CustodyChainService.logAction({
        documentId,
        action: 'bates_removal_failed',
        actor: 'system',
        payload: { error: error.message },
      });
      throw error;
    }
  }
  
  /**
   * Verifica se um documento já possui numeração Bates
   */
  static async hasBatesNumbers(documentId: string): Promise<{
    hasBates: boolean;
    prefix?: string;
    startNumber?: number;
    endNumber?: number;
    totalPages?: number;
  }> {
    const doc = await db.query(
      'SELECT bates_prefix, bates_start, bates_end FROM documents WHERE id = $1',
      [documentId]
    );
    
    if (!doc.rows.length) {
      throw new Error('Document not found');
    }
    
    const { bates_prefix, bates_start, bates_end } = doc.rows[0];
    const hasBates = Boolean(bates_prefix && bates_start && bates_end);
    
    if (hasBates) {
      return {
        hasBates: true,
        prefix: bates_prefix,
        startNumber: bates_start,
        endNumber: bates_end,
        totalPages: bates_end - bates_start + 1,
      };
    }
    
    return { hasBates: false };
  }
  
  /**
   * Lista todas as páginas com seus números Bates
   */
  static async getBatesNumbers(documentId: string): Promise<Array<{
    pageNumber: number;
    batesNumber: string | null;
  }>> {
    const pages = await db.query(
      'SELECT page_number, bates_number FROM document_pages WHERE document_id = $1 ORDER BY page_number',
      [documentId]
    );
    
    return pages.rows.map(page => ({
      pageNumber: page.page_number,
      batesNumber: page.bates_number,
    }));
  }
  
  /**
   * Valida opções de numeração Bates
   */
  static validateBatesOptions(options: BatesOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!options.prefix || options.prefix.trim().length === 0) {
      errors.push('Prefix is required');
    }
    
    if (options.prefix && options.prefix.length > 20) {
      errors.push('Prefix must be 20 characters or less');
    }
    
    if (options.startNumber < 1) {
      errors.push('Start number must be greater than 0');
    }
    
    if (options.startNumber > 999999) {
      errors.push('Start number must be less than 1,000,000');
    }
    
    if (options.fontSize && (options.fontSize < 6 || options.fontSize > 72)) {
      errors.push('Font size must be between 6 and 72');
    }
    
    if (options.opacity && (options.opacity < 0 || options.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }
    
    const validPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    if (options.position && !validPositions.includes(options.position)) {
      errors.push('Invalid position specified');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Gera próximo número Bates disponível para um prefixo
   */
  static async getNextBatesNumber(prefix: string): Promise<number> {
    const result = await db.query(
      'SELECT MAX(bates_end) as max_number FROM documents WHERE bates_prefix = $1',
      [prefix]
    );
    
    const maxNumber = result.rows[0]?.max_number || 0;
    return maxNumber + 1;
  }
}