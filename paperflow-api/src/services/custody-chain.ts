import crypto from 'crypto';
import { db } from '@/config/database';
import { storage } from '@/config/storage';

export class CustodyChainService {
  /**
   * Calcula hash SHA-256 de um buffer
   */
  static calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  
  /**
   * Gera manifest de evidência com árvore de hashes
   */
  static async generateManifest(documentId: string): Promise<{
    version: string;
    timestamp: string;
    document: {
      id: string;
      hash: string;
      size: number;
      pages: Array<{
        number: number;
        textHash: string;
        checksum: string;
      }>;
      chunks: Array<{
        id: string;
        pageNumber: number;
        index: number;
        textHash: string;
      }>;
    };
    chain: Array<{
      timestamp: string;
      action: string;
      actor: string;
      hash: string;
    }>;
  }> {
    // Buscar documento
    const doc = await db.query(
      'SELECT * FROM documents WHERE id = $1',
      [documentId]
    );
    
    if (!doc.rows.length) {
      throw new Error('Document not found');
    }
    
    // Buscar páginas
    const pages = await db.query(
      'SELECT * FROM document_pages WHERE document_id = $1 ORDER BY page_number',
      [documentId]
    );
    
    // Buscar chunks
    const chunks = await db.query(
      'SELECT id, page_number, chunk_index, text FROM chunks WHERE document_id = $1',
      [documentId]
    );
    
    // Buscar audit log
    const auditLog = await db.query(
      'SELECT * FROM audit_log WHERE document_id = $1 ORDER BY created_at',
      [documentId]
    );
    
    // Construir manifest
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      document: {
        id: documentId,
        hash: doc.rows[0].sha256_hash,
        size: doc.rows[0].size_bytes,
        pages: pages.rows.map(p => ({
          number: p.page_number,
          textHash: this.calculateHash(Buffer.from(p.text || '')),
          checksum: p.checksum,
        })),
        chunks: chunks.rows.map(c => ({
          id: c.id,
          pageNumber: c.page_number,
          index: c.chunk_index,
          textHash: this.calculateHash(Buffer.from(c.text)),
        })),
      },
      chain: auditLog.rows.map(log => ({
        timestamp: log.created_at,
        action: log.action,
        actor: log.actor,
        hash: this.calculateHash(Buffer.from(JSON.stringify(log.payload))),
      })),
    };
    
    // Salvar manifest
    await db.query(
      'INSERT INTO evidence_packages (document_id, manifest, package_hash, files) VALUES ($1, $2, $3, $4)',
      [documentId, JSON.stringify(manifest), this.calculateHash(Buffer.from(JSON.stringify(manifest))), []]
    );
    
    return manifest;
  }
  
  /**
   * Registra ação no audit log
   */
  static async logAction(params: {
    documentId?: string;
    userId?: string;
    action: string;
    actor: string;
    payload?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO audit_log 
       (document_id, user_id, action, actor, payload, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [params.documentId, params.userId, params.action, params.actor, 
       JSON.stringify(params.payload || {}), params.ipAddress, params.userAgent]
    );
  }
  
  /**
   * Verifica integridade de uma cadeia de custódia
   */
  static async verifyChain(documentId: string): Promise<{
    isValid: boolean;
    errors: string[];
    verifiedAt: string;
  }> {
    const errors: string[] = [];
    
    try {
      // Buscar manifest mais recente
      const packageResult = await db.query(
        'SELECT * FROM evidence_packages WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1',
        [documentId]
      );
      
      if (!packageResult.rows.length) {
        errors.push('No evidence package found');
        return { isValid: false, errors, verifiedAt: new Date().toISOString() };
      }
      
      const manifest = JSON.parse(packageResult.rows[0].manifest);
      
      // Verificar hash do manifest
      const currentManifestHash = this.calculateHash(Buffer.from(JSON.stringify(manifest)));
      if (currentManifestHash !== packageResult.rows[0].package_hash) {
        errors.push('Manifest hash mismatch');
      }
      
      // Verificar hashes das páginas
      const pages = await db.query(
        'SELECT * FROM document_pages WHERE document_id = $1 ORDER BY page_number',
        [documentId]
      );
      
      for (const manifestPage of manifest.document.pages) {
        const dbPage = pages.rows.find(p => p.page_number === manifestPage.number);
        if (!dbPage) {
          errors.push(`Page ${manifestPage.number} missing from database`);
          continue;
        }
        
        const currentTextHash = this.calculateHash(Buffer.from(dbPage.text || ''));
        if (currentTextHash !== manifestPage.textHash) {
          errors.push(`Text hash mismatch for page ${manifestPage.number}`);
        }
      }
      
      // Verificar chunks
      const chunks = await db.query(
        'SELECT * FROM chunks WHERE document_id = $1',
        [documentId]
      );
      
      for (const manifestChunk of manifest.document.chunks) {
        const dbChunk = chunks.rows.find(c => c.id === manifestChunk.id);
        if (!dbChunk) {
          errors.push(`Chunk ${manifestChunk.id} missing from database`);
          continue;
        }
        
        const currentTextHash = this.calculateHash(Buffer.from(dbChunk.text));
        if (currentTextHash !== manifestChunk.textHash) {
          errors.push(`Text hash mismatch for chunk ${manifestChunk.id}`);
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        verifiedAt: new Date().toISOString()
      };
      
    } catch (error) {
      errors.push(`Verification error: ${error.message}`);
      return { isValid: false, errors, verifiedAt: new Date().toISOString() };
    }
  }
}