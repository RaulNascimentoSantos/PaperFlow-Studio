import pdfParse from 'pdf-parse';

export interface TableCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TableRow {
  cells: TableCell[];
  y: number;
  height: number;
}

export interface ExtractedTable {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rows: TableRow[];
  confidence: number;
  format: 'csv' | 'json';
  data: string; // CSV format or JSON string
}

export class TableExtractor {
  async extractTablesFromPDF(buffer: Buffer): Promise<ExtractedTable[]> {
    try {
      const pdfData = await pdfParse(buffer);
      const tables: ExtractedTable[] = [];

      // Simple table detection based on text patterns
      // This is a basic implementation - in production, you might want to use
      // specialized libraries like tabula-js or camelot-equivalent
      
      for (let pageNum = 1; pageNum <= (pdfData as any).numpages; pageNum++) {
        const pageTables = await this.extractTablesFromPage(pdfData.text, pageNum);
        tables.push(...pageTables);
      }

      return tables;
    } catch (error) {
      console.error('Table extraction error:', error);
      return [];
    }
  }

  private async extractTablesFromPage(pageText: string, pageNum: number): Promise<ExtractedTable[]> {
    const tables: ExtractedTable[] = [];
    
    // Split text into lines
    const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentTable: string[][] = [];
    let isInTable = false;
    let tableStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect table patterns
      if (this.looksLikeTableRow(line)) {
        if (!isInTable) {
          isInTable = true;
          tableStartIndex = i;
          currentTable = [];
        }
        
        const cells = this.parseTableRow(line);
        currentTable.push(cells);
      } else if (isInTable && currentTable.length >= 2) {
        // End of table detected, process it
        const table = await this.processTable(currentTable, pageNum, tableStartIndex);
        if (table) {
          tables.push(table);
        }
        
        currentTable = [];
        isInTable = false;
      } else if (isInTable) {
        // Reset if we're in a table but current line doesn't match pattern
        currentTable = [];
        isInTable = false;
      }
    }
    
    // Handle table at end of page
    if (isInTable && currentTable.length >= 2) {
      const table = await this.processTable(currentTable, pageNum, tableStartIndex);
      if (table) {
        tables.push(table);
      }
    }
    
    return tables;
  }

  private looksLikeTableRow(line: string): boolean {
    // Check for common table patterns
    const patterns = [
      /\s+\|\s+/g,                    // Pipe-separated
      /\t+/g,                         // Tab-separated
      /\s{3,}/g,                      // Multiple spaces (common in PDFs)
      /\s+\d+\.\d+\s+/g,             // Numbers with decimals
      /\s+\d+\s+\d+\s+/g,            // Multiple numbers
      /^\s*\w+\s+\w+\s+\w+/g,        // At least 3 words
    ];
    
    // Must match at least one pattern and have minimum content
    return patterns.some(pattern => pattern.test(line)) && 
           line.length > 15 && 
           (line.match(/\s+/g) || []).length >= 2;
  }

  private parseTableRow(line: string): string[] {
    // Try different separators
    let cells: string[] = [];
    
    // Try pipe separator first
    if (line.includes('|')) {
      cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
    }
    // Try tab separator
    else if (line.includes('\t')) {
      cells = line.split('\t').map(cell => cell.trim()).filter(cell => cell.length > 0);
    }
    // Try multiple spaces (most common in PDFs)
    else {
      cells = line.split(/\s{2,}/).map(cell => cell.trim()).filter(cell => cell.length > 0);
    }
    
    return cells.length >= 2 ? cells : [line];
  }

  private async processTable(tableData: string[][], pageNum: number, startIndex: number): Promise<ExtractedTable | null> {
    if (tableData.length < 2) return null;
    
    // Normalize table - ensure all rows have same number of columns
    const maxColumns = Math.max(...tableData.map(row => row.length));
    const normalizedTable = tableData.map(row => {
      const normalizedRow = [...row];
      while (normalizedRow.length < maxColumns) {
        normalizedRow.push('');
      }
      return normalizedRow;
    });

    // Convert to CSV
    const csvData = normalizedTable
      .map(row => row.map(cell => this.escapeCsvCell(cell)).join(','))
      .join('\n');

    // Calculate basic metrics (mock coordinates)
    const estimatedY = startIndex * 20; // Rough estimate
    const estimatedHeight = tableData.length * 15;
    const estimatedWidth = Math.max(...tableData.map(row => row.join('').length)) * 8;

    // Build table rows structure
    const rows: TableRow[] = normalizedTable.map((rowData, rowIndex) => ({
      cells: rowData.map((cellText, colIndex) => ({
        text: cellText,
        x: colIndex * 100, // Mock coordinates
        y: estimatedY + (rowIndex * 15),
        width: cellText.length * 8,
        height: 15,
      })),
      y: estimatedY + (rowIndex * 15),
      height: 15,
    }));

    // Calculate confidence based on table quality
    const confidence = this.calculateTableConfidence(normalizedTable);

    return {
      page: pageNum,
      x: 50, // Mock coordinate
      y: estimatedY,
      width: estimatedWidth,
      height: estimatedHeight,
      rows,
      confidence,
      format: 'csv',
      data: csvData,
    };
  }

  private escapeCsvCell(cell: string): string {
    // Escape CSV special characters
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  private calculateTableConfidence(tableData: string[][]): number {
    let score = 0.5; // Base score
    
    // Bonus for consistent column count
    const columnCounts = tableData.map(row => row.length);
    const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
    const columnConsistency = 1 - (Math.abs(Math.max(...columnCounts) - Math.min(...columnCounts)) / avgColumns);
    score += columnConsistency * 0.3;
    
    // Bonus for having numeric data
    const numericCells = tableData.flat().filter(cell => /^\d+(\.\d+)?$/.test(cell.trim()));
    const numericRatio = numericCells.length / tableData.flat().length;
    score += Math.min(numericRatio * 0.3, 0.2);
    
    // Bonus for having headers (first row with text)
    const firstRowHasText = tableData[0]?.every(cell => /[a-zA-Z]/.test(cell));
    if (firstRowHasText) score += 0.1;
    
    // Penalty for too few rows or columns
    if (tableData.length < 3) score -= 0.1;
    if (avgColumns < 2) score -= 0.2;
    
    return Math.max(0.1, Math.min(1.0, score));
  }

  // Advanced table extraction using layout analysis
  async extractTablesAdvanced(buffer: Buffer): Promise<ExtractedTable[]> {
    // This would integrate with a more sophisticated table detection library
    // For now, fall back to basic extraction
    return this.extractTablesFromPDF(buffer);
  }

  // Extract tables by detecting visual patterns (requires additional libraries)
  async extractTablesVisual(buffer: Buffer): Promise<ExtractedTable[]> {
    // This would use libraries like pdf2pic + image processing
    // to detect table borders and structure
    console.log('Visual table extraction not implemented yet');
    return [];
  }

  // Method to extract tables with different strategies and return the best results
  async extractTablesComprehensive(buffer: Buffer): Promise<ExtractedTable[]> {
    const results: ExtractedTable[] = [];
    
    try {
      // Strategy 1: Text-based extraction
      const textTables = await this.extractTablesFromPDF(buffer);
      results.push(...textTables);
      
      // Strategy 2: Advanced extraction (if available)
      // const advancedTables = await this.extractTablesAdvanced(buffer);
      // results.push(...advancedTables);
      
      // Deduplicate and return best results
      return this.deduplicateTables(results);
      
    } catch (error) {
      console.error('Comprehensive table extraction failed:', error);
      return [];
    }
  }

  private deduplicateTables(tables: ExtractedTable[]): ExtractedTable[] {
    // Simple deduplication based on page and position
    const uniqueTables: ExtractedTable[] = [];
    
    for (const table of tables) {
      const isDuplicate = uniqueTables.some(existing => 
        existing.page === table.page &&
        Math.abs(existing.x - table.x) < 50 &&
        Math.abs(existing.y - table.y) < 50
      );
      
      if (!isDuplicate) {
        uniqueTables.push(table);
      }
    }
    
    return uniqueTables.sort((a, b) => a.page - b.page || a.y - b.y);
  }
}