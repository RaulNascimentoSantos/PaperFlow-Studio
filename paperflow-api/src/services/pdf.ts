import pdfParse from 'pdf-parse';
import { TableExtractor, ExtractedTable } from './table-extractor';
import { env } from '@/config/env';

export interface PDFProcessingResult {
  text: string;
  pages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    version?: string;
  };
  tables: ExtractedTable[];
  images?: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    format: string;
  }>;
  wordCount: number;
  charCount: number;
}

export class PdfService {
  private static tableExtractor = new TableExtractor();

  static async processPdf(buffer: Buffer): Promise<any> {
    const data = await pdfParse(buffer);
    return data;
  }

  static async processPdfAdvanced(
    buffer: Buffer, 
    options: {
      extractTables?: boolean;
      extractImages?: boolean;
      ocrIfNeeded?: boolean;
      language?: string;
    } = {}
  ): Promise<PDFProcessingResult> {
    const {
      extractTables = env.ENABLE_IMAGE_EXTRACTION || true,
      extractImages = env.ENABLE_IMAGE_EXTRACTION || false,
      ocrIfNeeded = env.ENABLE_OCR || false,
      language = 'pt-BR'
    } = options;

    try {
      // Basic PDF parsing
      const pdfData = await pdfParse(buffer);
      
      // Extract metadata
      const metadata = {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        creator: pdfData.info?.Creator,
        producer: pdfData.info?.Producer,
        creationDate: pdfData.info?.CreationDate,
        modificationDate: pdfData.info?.ModDate,
        version: pdfData.version,
      };

      // Text metrics
      const wordCount = pdfData.text.split(/\s+/).filter(word => word.length > 0).length;
      const charCount = pdfData.text.length;

      // Initialize result
      const result: PDFProcessingResult = {
        text: pdfData.text,
        pages: pdfData.numpages,
        metadata,
        tables: [],
        wordCount,
        charCount,
      };

      // Extract tables if requested
      if (extractTables) {
        try {
          console.log(`📊 Extracting tables from PDF...`);
          result.tables = await this.tableExtractor.extractTablesComprehensive(buffer);
          console.log(`✅ Extracted ${result.tables.length} tables`);
        } catch (error) {
          console.error('Table extraction failed:', error);
          result.tables = [];
        }
      }

      // Extract images if requested
      if (extractImages) {
        try {
          console.log(`🖼️ Extracting images from PDF...`);
          result.images = await this.extractImages(buffer);
          console.log(`✅ Extracted ${result.images?.length || 0} images`);
        } catch (error) {
          console.error('Image extraction failed:', error);
          result.images = [];
        }
      }

      // OCR if text is sparse and OCR is enabled
      if (ocrIfNeeded && this.needsOCR(result.text, result.pages)) {
        try {
          console.log(`🔍 Performing OCR on PDF...`);
          const ocrText = await this.performOCR(buffer, language);
          if (ocrText && ocrText.length > result.text.length * 1.5) {
            result.text = ocrText;
            result.wordCount = ocrText.split(/\s+/).filter(word => word.length > 0).length;
            result.charCount = ocrText.length;
            console.log(`✅ OCR enhanced text from ${result.charCount} to ${ocrText.length} characters`);
          }
        } catch (error) {
          console.error('OCR failed:', error);
        }
      }

      return result;

    } catch (error) {
      console.error('Advanced PDF processing failed:', error);
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static needsOCR(text: string, pages: number): boolean {
    const avgCharsPerPage = text.length / pages;
    const avgWordsPerPage = text.split(/\s+/).length / pages;
    
    // Trigger OCR if:
    // - Less than 100 characters per page (likely scanned)
    // - Less than 20 words per page
    // - Text has many repeated characters (OCR artifacts)
    const repeatedCharsRatio = this.calculateRepeatedCharsRatio(text);
    
    return avgCharsPerPage < 100 || avgWordsPerPage < 20 || repeatedCharsRatio > 0.3;
  }

  private static calculateRepeatedCharsRatio(text: string): number {
    const charCount: Record<string, number> = {};
    for (const char of text) {
      charCount[char] = (charCount[char] || 0) + 1;
    }
    
    const sortedCounts = Object.values(charCount).sort((a, b) => b - a);
    const topCharCount = sortedCounts.slice(0, 3).reduce((sum, count) => sum + count, 0);
    
    return topCharCount / text.length;
  }

  private static async performOCR(buffer: Buffer, language: string): Promise<string> {
    try {
      const { OCRService } = await import('./ocr.js');
      const results = await OCRService.processPDF(buffer, language, {
        quality: 85,
        density: 150,
        psm: '3', // Fully automatic page segmentation
      });
      
      const ocrText = results
        .map(result => result.text)
        .join('\n\n--- Page Break ---\n\n');
        
      return ocrText;
    } catch (error) {
      console.error('OCR processing failed:', error);
      return '';
    }
  }

  private static async extractImages(buffer: Buffer): Promise<Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    format: string;
  }>> {
    // This would extract images from PDF
    // Requires additional libraries like pdf2pic or similar
    console.log('Image extraction not fully implemented yet');
    return [];
  }

  // Utility method to validate PDF
  static async validatePDF(buffer: Buffer): Promise<{
    isValid: boolean;
    error?: string;
    info?: {
      pages: number;
      size: number;
      encrypted: boolean;
      version?: string;
    };
  }> {
    try {
      const data = await pdfParse(buffer);
      
      return {
        isValid: true,
        info: {
          pages: data.numpages,
          size: buffer.length,
          encrypted: false, // pdf-parse would fail if encrypted
          version: data.version,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid PDF',
      };
    }
  }

  // Get PDF metadata without processing full text
  static async getMetadata(buffer: Buffer): Promise<{
    title?: string;
    author?: string;
    creator?: string;
    pages?: number;
    version?: string;
    creationDate?: string;
    size: number;
  }> {
    try {
      const data = await pdfParse(buffer, { max: 1 }); // Only process first page
      
      return {
        title: data.info?.Title,
        author: data.info?.Author,
        creator: data.info?.Creator,
        pages: data.numpages,
        version: data.version,
        creationDate: data.info?.CreationDate,
        size: buffer.length,
      };
    } catch (error) {
      return {
        size: buffer.length,
      };
    }
  }
}
