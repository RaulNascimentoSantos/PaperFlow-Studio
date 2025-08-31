import {
  Signer,
  SignatureRequest,
  ESignatureProvider,
  DocumentUploadResponse,
  SignatureWebhookEvent,
  IntegrationAuditLog,
  IntegrationConfig
} from '../types/integrations';
import { DatabaseService } from './database';
import { createError } from '../utils/errors';

export class ESignatureService {
  constructor(private db: DatabaseService) {}

  async sendForSignature(
    tenantId: string,
    documentId: string,
    signers: Signer[],
    options: {
      deadlineDays?: number;
      autoClose?: boolean;
      sequenceEnabled?: boolean;
      message?: string;
    } = {}
  ): Promise<SignatureRequest> {
    try {
      // Get tenant's e-signature configuration
      const integrationConfig = await this.getIntegrationConfig(tenantId);
      
      if (!integrationConfig?.esignature?.enabled) {
        throw createError.badRequest('E-signature integration not enabled for this tenant');
      }

      // Get document details
      const document = await this.getDocument(documentId, tenantId);
      if (!document) {
        throw createError.notFound('Document not found');
      }

      // Upload document to e-signature provider
      const uploadResponse = await this.uploadDocumentToProvider(
        document, 
        integrationConfig.esignature.provider,
        options
      );

      // Add signers to the document
      for (const signer of signers) {
        await this.addSignerToDocument(
          uploadResponse.document.key,
          signer,
          integrationConfig.esignature.provider
        );
      }

      // Create webhook for status updates
      await this.createWebhook(
        uploadResponse.document.key,
        integrationConfig.esignature.provider,
        tenantId
      );

      // Create signature request record
      const signatureRequest: SignatureRequest = {
        requestId: uploadResponse.document.key,
        documentId,
        tenantId,
        signers: signers.map(s => ({ ...s, status: 'pending' })),
        documentUrl: uploadResponse.document.uploads.original,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(uploadResponse.document.deadline_at),
        metadata: {
          provider: integrationConfig.esignature.provider.name,
          originalFilename: document.originalName,
          ...options
        }
      };

      // Save to database
      await this.saveSignatureRequest(signatureRequest);

      // Log the signature request
      await this.logIntegrationEvent({
        tenantId,
        type: 'signature_request',
        action: 'document_sent_for_signature',
        resourceId: documentId,
        status: 'success',
        details: {
          requestId: signatureRequest.requestId,
          signersCount: signers.length,
          provider: integrationConfig.esignature.provider.name
        }
      });

      return signatureRequest;

    } catch (error) {
      // Log failed signature request
      await this.logIntegrationEvent({
        tenantId,
        type: 'signature_request',
        action: 'signature_request_failed',
        resourceId: documentId,
        status: 'failed',
        details: { signersCount: signers.length },
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getSignatureStatus(requestId: string, tenantId: string): Promise<SignatureRequest | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM signature_requests
        WHERE request_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `, [requestId, tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        requestId: row.request_id,
        documentId: row.document_id,
        tenantId: row.tenant_id,
        signers: typeof row.signers === 'string' ? JSON.parse(row.signers) : row.signers,
        documentUrl: row.document_url,
        signedDocumentUrl: row.signed_document_url,
        status: row.status,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      };
    } catch (error) {
      console.error('Error getting signature status:', error);
      return null;
    }
  }

  async handleWebhook(payload: SignatureWebhookEvent, tenantId: string): Promise<void> {
    try {
      console.log('✍️ E-signature webhook received:', JSON.stringify(payload, null, 2));

      const { event, document } = payload;
      const requestId = document.key;

      // Get existing signature request
      const existingRequest = await this.getSignatureStatus(requestId, tenantId);
      if (!existingRequest) {
        console.warn(`Signature request not found: ${requestId}`);
        return;
      }

      // Update signature request based on event
      switch (event.name) {
        case 'document.signed':
          await this.handleDocumentSigned(existingRequest, document);
          break;
        case 'document.refused':
          await this.handleDocumentRefused(existingRequest, document);
          break;
        case 'document.canceled':
          await this.handleDocumentCanceled(existingRequest, document);
          break;
        case 'document.deadline':
          await this.handleDocumentExpired(existingRequest, document);
          break;
      }

      // Log webhook processing
      await this.logIntegrationEvent({
        tenantId,
        type: 'signature_completed',
        action: `webhook_${event.name.replace('.', '_')}`,
        resourceId: existingRequest.documentId,
        status: 'success',
        details: {
          requestId,
          event: event.name,
          documentStatus: document.status
        }
      });

    } catch (error) {
      console.error('Error handling e-signature webhook:', error);
      
      await this.logIntegrationEvent({
        tenantId,
        type: 'signature_completed',
        action: 'webhook_processing_failed',
        status: 'failed',
        details: payload,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  private async uploadDocumentToProvider(
    document: any,
    provider: ESignatureProvider,
    options: any
  ): Promise<DocumentUploadResponse> {
    // Mock document upload for development
    // In production, this would call the actual provider API (Clicksign, D4Sign, etc.)

    console.log(`✍️ Uploading document to ${provider.name}:`, {
      filename: document.originalName,
      provider: provider.name
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock response
    const mockResponse: DocumentUploadResponse = {
      document: {
        key: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: document.originalName,
        uploads: {
          original: `https://mock-provider.com/documents/${document.id}/original`
        },
        downloads: {
          signed_file_url: `https://mock-provider.com/documents/${document.id}/signed`,
          original_file_url: `https://mock-provider.com/documents/${document.id}/original`
        },
        status: 'open',
        deadline_at: this.calculateDeadline(options.deadlineDays).toISOString()
      }
    };

    console.log(`✍️ Document uploaded successfully:`, mockResponse.document.key);
    return mockResponse;
  }

  private async addSignerToDocument(
    documentKey: string,
    signer: Signer,
    provider: ESignatureProvider
  ): Promise<void> {
    console.log(`✍️ Adding signer to document ${documentKey}:`, {
      name: signer.name,
      email: signer.email,
      role: signer.role
    });

    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async createWebhook(
    documentKey: string,
    provider: ESignatureProvider,
    tenantId: string
  ): Promise<void> {
    const webhookUrl = `${process.env.API_URL || 'http://localhost:3002'}/v1/webhooks/signature-callback/${tenantId}`;
    
    console.log(`✍️ Creating webhook for document ${documentKey}:`, webhookUrl);

    // Mock webhook creation
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private calculateDeadline(deadlineDays: number = 7): Date {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    return deadline;
  }

  private async handleDocumentSigned(
    request: SignatureRequest,
    document: any
  ): Promise<void> {
    // Update signers status
    const updatedSigners = request.signers.map(signer => {
      const signedSigner = document.signers?.find((s: any) => s.email === signer.email);
      if (signedSigner && signedSigner.status === 'signed') {
        return {
          ...signer,
          status: 'signed' as const,
          signedAt: signedSigner.signed_at ? new Date(signedSigner.signed_at) : new Date()
        };
      }
      return signer;
    });

    // Check if all signers have signed
    const allSigned = updatedSigners.every(s => s.status === 'signed');

    await this.db.query(`
      UPDATE signature_requests
      SET 
        status = $1,
        signers = $2,
        signed_document_url = $3,
        completed_at = $4,
        updated_at = NOW()
      WHERE request_id = $5
    `, [
      allSigned ? 'signed' : 'pending',
      JSON.stringify(updatedSigners),
      document.downloads?.signed_file_url,
      allSigned ? new Date() : null,
      request.requestId
    ]);

    console.log(`✍️ Document signature updated: ${request.requestId} - ${allSigned ? 'All signed' : 'Partially signed'}`);
  }

  private async handleDocumentRefused(
    request: SignatureRequest,
    document: any
  ): Promise<void> {
    await this.db.query(`
      UPDATE signature_requests
      SET 
        status = 'refused',
        updated_at = NOW()
      WHERE request_id = $1
    `, [request.requestId]);

    console.log(`✍️ Document refused: ${request.requestId}`);
  }

  private async handleDocumentCanceled(
    request: SignatureRequest,
    document: any
  ): Promise<void> {
    await this.db.query(`
      UPDATE signature_requests
      SET 
        status = 'canceled',
        updated_at = NOW()
      WHERE request_id = $1
    `, [request.requestId]);

    console.log(`✍️ Document canceled: ${request.requestId}`);
  }

  private async handleDocumentExpired(
    request: SignatureRequest,
    document: any
  ): Promise<void> {
    await this.db.query(`
      UPDATE signature_requests
      SET 
        status = 'expired',
        updated_at = NOW()
      WHERE request_id = $1
    `, [request.requestId]);

    console.log(`✍️ Document expired: ${request.requestId}`);
  }

  async getSignatureRequests(
    tenantId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    requests: SignatureRequest[];
    total: number;
  }> {
    try {
      let whereClause = 'WHERE tenant_id = $1 AND deleted_at IS NULL';
      const params: any[] = [tenantId];

      if (options.status) {
        whereClause += ' AND status = $' + (params.length + 1);
        params.push(options.status);
      }

      const countResult = await this.db.query(`
        SELECT COUNT(*) as total FROM signature_requests ${whereClause}
      `, params);

      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const result = await this.db.query(`
        SELECT * FROM signature_requests 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      return {
        requests: result.rows.map(this.mapRowToSignatureRequest),
        total: parseInt(countResult.rows[0]?.total || '0')
      };
    } catch (error) {
      console.error('Error getting signature requests:', error);
      return { requests: [], total: 0 };
    }
  }

  private mapRowToSignatureRequest(row: any): SignatureRequest {
    return {
      requestId: row.request_id,
      documentId: row.document_id,
      tenantId: row.tenant_id,
      signers: typeof row.signers === 'string' ? JSON.parse(row.signers) : row.signers,
      documentUrl: row.document_url,
      signedDocumentUrl: row.signed_document_url,
      status: row.status,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }

  private async saveSignatureRequest(request: SignatureRequest): Promise<void> {
    await this.db.query(`
      INSERT INTO signature_requests (
        request_id, document_id, tenant_id, signers, document_url, status, 
        created_at, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      request.requestId,
      request.documentId,
      request.tenantId,
      JSON.stringify(request.signers),
      request.documentUrl,
      request.status,
      request.createdAt,
      request.expiresAt,
      JSON.stringify(request.metadata)
    ]);
  }

  private async getDocument(documentId: string, tenantId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT id, original_name, s3_key, mime_type, size_bytes
      FROM documents
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `, [documentId, tenantId]);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      originalName: result.rows[0].original_name,
      s3Key: result.rows[0].s3_key,
      mimeType: result.rows[0].mime_type,
      sizeBytes: result.rows[0].size_bytes
    };
  }

  private async getIntegrationConfig(tenantId: string): Promise<IntegrationConfig | null> {
    try {
      const result = await this.db.query(`
        SELECT integration_config 
        FROM tenants 
        WHERE id = $1 AND deleted_at IS NULL
      `, [tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0].integration_config;
      return typeof config === 'string' ? JSON.parse(config) : config;
    } catch (error) {
      console.error('Error getting integration config:', error);
      return null;
    }
  }

  private async logIntegrationEvent(
    event: Omit<IntegrationAuditLog, 'id' | 'createdAt' | 'processedAt'>
  ): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO integration_audit_log (
          id, tenant_id, type, action, resource_id, user_id, recipient, template, 
          status, details, error, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
        )
      `, [
        event.tenantId,
        event.type,
        event.action,
        event.resourceId,
        event.userId,
        event.recipient,
        event.template,
        event.status,
        JSON.stringify(event.details),
        event.error
      ]);
    } catch (error) {
      console.error('Error logging integration event:', error);
    }
  }
}