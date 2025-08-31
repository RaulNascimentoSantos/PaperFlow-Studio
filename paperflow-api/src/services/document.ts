import { db } from '@/config/database';
import { storage } from '@/config/storage';
import { LocalStorageAdapter } from './storage/local-storage';
import { Document } from '@/types';
import { env } from '@/config/env';
import crypto from 'crypto';
import { documentQueue } from '@/queues/document';

export class DocumentService {
  static async createDocument(userId: string, file: any): Promise<Document> {
    const checksum = crypto.createHash('sha256').update(file.data).digest('hex');
    const storageKey = LocalStorageAdapter.generateKey(file.filename, userId);

    // Upload to storage
    await storage.upload(file.data, storageKey, {
      originalName: file.filename,
      mimeType: file.mimetype,
      userId: userId,
      checksum: checksum,
      uploadedAt: new Date().toISOString(),
    });

    const result = await db.query(
      `INSERT INTO documents (user_id, original_name, s3_key, size_bytes, mime_type, checksum, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        file.filename,
        storageKey,
        file.data.length,
        file.mimetype,
        checksum,
        'pending',
      ]
    );

    const document = result.rows[0] as Document;

    await documentQueue.add('process-document', { documentId: document.id });

    return document;
  }

  static async getDocument(documentId: string): Promise<Document | null> {
    const result = await db.query('SELECT * FROM documents WHERE id = $1', [
      documentId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Document;
  }

  static async getUserDocuments(userId: string): Promise<Document[]> {
    const result = await db.query(
      'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows as Document[];
  }

  static async updateDocumentStatus(
    documentId: string, 
    status: string, 
    extractedText?: string, 
    metadata?: any
  ): Promise<void> {
    const updateFields = ['status = $2'];
    const params = [documentId, status];
    let paramIndex = 3;

    if (extractedText) {
      updateFields.push(`extracted_text = $${paramIndex}`);
      params.push(extractedText);
      paramIndex++;
    }

    if (metadata) {
      updateFields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }

    updateFields.push(`processed_at = NOW()`);

    const query = `UPDATE documents SET ${updateFields.join(', ')} WHERE id = $1`;
    await db.query(query, params);
  }
}
