import Tesseract from 'tesseract.js';
// Canvas import removed - not needed for current OCR implementation
import pdf2pic from 'pdf2pic';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export interface PageOCRResult extends OCRResult {
  page: number;
  processingTimeMs: number;
}

export class OCRService {
  private static readonly DEFAULT_OPTIONS = {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  };

  static async processImage(
    imageBuffer: Buffer, 
    language: string = 'por+eng',
    options: {
      psm?: string;
      oem?: string;
    } = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      const worker = await Tesseract.createWorker({
        ...this.DEFAULT_OPTIONS,
        ...options,
      });

      await worker.loadLanguage(language);
      await worker.initialize(language);

      if (options.psm) {
        await worker.setParameters({
          tessedit_pageseg_mode: options.psm,
        });
      }

      if (options.oem) {
        await worker.setParameters({
          tessedit_ocr_engine_mode: options.oem,
        });
      }

      const { data } = await worker.recognize(imageBuffer);

      await worker.terminate();

      return {
        text: data.text,
        confidence: data.confidence,
        words: data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
        blocks: data.blocks.map(block => ({
          text: block.text,
          confidence: block.confidence,
          bbox: block.bbox,
        })),
      };

    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async processPDF(
    pdfBuffer: Buffer,
    language: string = 'por+eng',
    options: {
      pages?: number[]; // Specific pages to process, if not provided, process all
      quality?: number; // Image quality for conversion (1-100)
      density?: number; // DPI for conversion
      format?: 'png' | 'jpeg';
      psm?: string; // Page segmentation mode
      oem?: string; // OCR engine mode
    } = {}
  ): Promise<PageOCRResult[]> {
    const {
      quality = 100,
      density = 200,
      format = 'png',
      pages,
      psm = '1', // Automatic page segmentation with OSD
      oem = '1', // Neural nets LSTM engine only
    } = options;

    try {
      console.log(`🔍 Starting OCR processing for PDF with ${language} language`);

      // Convert PDF to images
      const convert = pdf2pic.fromBuffer(pdfBuffer, {
        density,
        saveFilename: 'page',
        savePath: '/tmp',
        format,
        width: 2480,
        height: 3508,
      });

      const images = await convert.bulk(-1); // Convert all pages
      console.log(`📄 Converted PDF to ${images.length} images`);

      const results: PageOCRResult[] = [];
      const pagesToProcess = pages || Array.from({ length: images.length }, (_, i) => i + 1);

      // Process images in parallel with limited concurrency
      const batchSize = 3; // Process 3 pages at a time to avoid memory issues
      
      for (let i = 0; i < pagesToProcess.length; i += batchSize) {
        const batch = pagesToProcess.slice(i, i + batchSize);
        const batchPromises = batch.map(async (pageNum) => {
          const imageIndex = pageNum - 1;
          if (imageIndex >= images.length) return null;

          const startTime = Date.now();
          const imagePath = images[imageIndex].path;

          try {
            // Load image buffer
            const imageBuffer = require('fs').readFileSync(imagePath);
            
            // Perform OCR
            const ocrResult = await this.processImage(imageBuffer, language, { psm, oem });
            
            // Clean up temporary file
            require('fs').unlinkSync(imagePath);

            const result: PageOCRResult = {
              ...ocrResult,
              page: pageNum,
              processingTimeMs: Date.now() - startTime,
            };

            console.log(`✅ OCR completed for page ${pageNum}: ${ocrResult.confidence.toFixed(2)}% confidence`);
            return result;

          } catch (error) {
            console.error(`❌ OCR failed for page ${pageNum}:`, error);
            
            // Clean up temporary file on error
            try {
              require('fs').unlinkSync(imagePath);
            } catch (cleanupError) {
              console.error('Failed to cleanup temp file:', cleanupError);
            }

            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null) as PageOCRResult[]);

        // Small delay between batches
        if (i + batchSize < pagesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results.sort((a, b) => a.page - b.page);

    } catch (error) {
      console.error('PDF OCR processing failed:', error);
      throw new Error(`PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async processImageUrl(
    imageUrl: string,
    language: string = 'por+eng'
  ): Promise<OCRResult> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      return await this.processImage(imageBuffer, language);

    } catch (error) {
      console.error('URL OCR processing failed:', error);
      throw new Error(`URL OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method to check if OCR is likely needed
  static shouldUseOCR(text: string, pages: number): boolean {
    const avgCharsPerPage = text.length / pages;
    const avgWordsPerPage = text.split(/\s+/).filter(w => w.length > 0).length / pages;
    
    // OCR likely needed if:
    // - Very few characters per page (< 100)
    // - Very few words per page (< 20)
    // - Text has many single characters (OCR artifacts from poor extraction)
    const singleCharWords = text.split(/\s+/).filter(w => w.length === 1).length;
    const singleCharRatio = singleCharWords / text.split(/\s+/).length;

    return avgCharsPerPage < 100 || avgWordsPerPage < 20 || singleCharRatio > 0.1;
  }

  // Method to enhance existing text with OCR
  static async enhanceTextWithOCR(
    pdfBuffer: Buffer,
    existingText: string,
    language: string = 'por+eng'
  ): Promise<{
    enhancedText: string;
    improvement: number; // Ratio of improvement
    ocrResults: PageOCRResult[];
  }> {
    try {
      const ocrResults = await this.processPDF(pdfBuffer, language, {
        quality: 85,
        density: 150, // Lower density for faster processing
        psm: '3', // Fully automatic page segmentation
      });

      const ocrText = ocrResults
        .map(result => result.text)
        .join('\n\n--- Page Break ---\n\n');

      // Calculate improvement
      const originalLength = existingText.length;
      const ocrLength = ocrText.length;
      const improvement = originalLength > 0 ? ocrLength / originalLength : ocrLength > 0 ? 1 : 0;

      // Decide whether to use OCR text
      let enhancedText = existingText;
      
      if (improvement > 1.5 || (originalLength < 500 && ocrLength > 1000)) {
        // OCR text is significantly better
        enhancedText = ocrText;
      } else if (improvement > 1.1 && originalLength < 1000) {
        // OCR text is somewhat better and original is short
        enhancedText = ocrText;
      }

      return {
        enhancedText,
        improvement,
        ocrResults,
      };

    } catch (error) {
      console.error('Text enhancement with OCR failed:', error);
      return {
        enhancedText: existingText,
        improvement: 0,
        ocrResults: [],
      };
    }
  }

  // Check available languages
  static async getAvailableLanguages(): Promise<string[]> {
    try {
      // Common languages available in Tesseract
      return [
        'eng', // English
        'por', // Portuguese  
        'spa', // Spanish
        'fra', // French
        'deu', // German
        'ita', // Italian
        'rus', // Russian
        'chi_sim', // Chinese Simplified
        'chi_tra', // Chinese Traditional
        'jpn', // Japanese
        'kor', // Korean
        'ara', // Arabic
      ];
    } catch (error) {
      console.error('Failed to get available languages:', error);
      return ['eng', 'por'];
    }
  }
}