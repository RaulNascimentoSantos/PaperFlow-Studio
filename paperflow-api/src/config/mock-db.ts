import { env } from './env';

// Simple in-memory database for development
class MockDatabase {
  private users: Map<string, any> = new Map();
  private documents: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private chunks: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private queries: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private usageLogs: Map<string, any> = new Map();
  private billingUsageRecords: Map<string, any> = new Map();
  private billingOverageCharges: Map<string, any> = new Map();
  private billingInvoices: Map<string, any> = new Map();
  private billingEventsLog: Map<string, any> = new Map();
  private billingPaymentMethods: Map<string, any> = new Map();
  private billingSubscriptions: Map<string, any> = new Map();
  private documentEmbeddings: Map<string, any> = new Map();
  private signatureRequests: Map<string, any> = new Map();
  private notificationTemplates: Map<string, any> = new Map();
  private integrationAuditLog: Map<string, any> = new Map();
  private productMetrics: Map<string, any> = new Map();
  private tenantHealthScores: Map<string, any> = new Map();
  private securityAuditLog: Map<string, any> = new Map();
  private securityAlerts: Map<string, any> = new Map();
  private templates: Map<string, any> = new Map();

  // Mock query method that simulates SQL queries
  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    console.log(`🗄️ Mock DB Query: ${sql}`, params);

    // Handle different query types
    if (sql.includes('SELECT') && sql.includes('users')) {
      return this.handleUserQueries(sql, params);
    }
    
    if (sql.includes('INSERT INTO users')) {
      return this.handleUserInsert(sql, params);
    }

    if (sql.includes('documents')) {
      return this.handleDocumentQueries(sql, params);
    }

    // Handle tenant-related queries
    if (sql.includes('tenants')) {
      return this.handleTenantQueries(sql, params);
    }

    // Handle template-related queries
    if (sql.includes('templates') && !sql.includes('notification_templates')) {
      return this.handleTemplateQueries(sql, params);
    }

    // Handle billing-related queries
    if (sql.includes('billing_')) {
      return this.handleBillingQueries(sql, params);
    }

    // Handle document embeddings queries
    if (sql.includes('document_embeddings')) {
      return this.handleDocumentEmbeddings(sql, params);
    }

    // Handle signature requests queries
    if (sql.includes('signature_requests')) {
      return this.handleSignatureRequests(sql, params);
    }

    // Handle notification templates queries
    if (sql.includes('notification_templates')) {
      return this.handleNotificationTemplates(sql, params);
    }

    // Handle integration audit log queries
    if (sql.includes('integration_audit_log')) {
      return this.handleIntegrationAuditLog(sql, params);
    }

    // Handle product metrics queries
    if (sql.includes('product_metrics')) {
      return this.handleProductMetrics(sql, params);
    }

    // Handle tenant health scores queries
    if (sql.includes('tenant_health_scores')) {
      return this.handleTenantHealthScores(sql, params);
    }

    // Handle security audit log queries
    if (sql.includes('security_audit_log')) {
      return this.handleSecurityAuditLog(sql, params);
    }

    // Handle security alerts queries
    if (sql.includes('security_alerts')) {
      return this.handleSecurityAlerts(sql, params);
    }

    // Handle general queries like BEGIN, COMMIT, ROLLBACK
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // Default response for unhandled queries
    return { rows: [], rowCount: 0 };
  }

  // Mock connect method for compatibility
  async connect(): Promise<MockDatabaseClient> {
    return new MockDatabaseClient(this);
  }

  private handleUserQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Handle authentication query for recent users
    if (sql.includes('last_active > NOW()') || sql.includes('ORDER BY last_active')) {
      const allUsers = Array.from(this.users.values());
      return { rows: allUsers, rowCount: allUsers.length };
    }

    if (sql.includes('SELECT * FROM users')) {
      const allUsers = Array.from(this.users.values());
      return { rows: allUsers, rowCount: allUsers.length };
    }

    if (params && params.length > 0) {
      const userId = params[0];
      const user = this.users.get(userId);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleUserInsert(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (params && params.length >= 5) {
      const [email, company, plan, apiKeyHash, apiSecretHash] = params;
      const user = {
        id: this.generateUUID(),
        email,
        company,
        plan,
        api_key_hash: apiKeyHash,
        api_secret_hash: apiSecretHash,
        credits_remaining: plan === 'free' ? 100 : plan === 'pro' ? 5000 : 25000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        metadata: {},
      };

      this.users.set(user.id, user);
      return { rows: [user], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleDocumentQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO documents')) {
      if (params && params.length >= 7) {
        const [userId, originalName, s3Key, sizeBytes, mimeType, checksum, status] = params;
        const document = {
          id: this.generateUUID(),
          user_id: userId,
          original_name: originalName,
          s3_key: s3Key,
          size_bytes: sizeBytes,
          mime_type: mimeType,
          checksum,
          status,
          pages: 0,
          extracted_text: null,
          processing_time_ms: null,
          error_message: null,
          created_at: new Date().toISOString(),
          processed_at: null,
          expires_at: null,
          metadata: {},
        };

        this.documents.set(document.id, document);
        return { rows: [document], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT * FROM documents WHERE user_id')) {
      if (params && params[0]) {
        const userId = params[0];
        const userDocs = Array.from(this.documents.values()).filter(doc => doc.user_id === userId);
        // Sort by created_at DESC
        userDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: userDocs, rowCount: userDocs.length };
      }
    }

    if (sql.includes('SELECT * FROM documents WHERE id')) {
      if (params && params[0]) {
        const doc = this.documents.get(params[0]);
        return { rows: doc ? [doc] : [], rowCount: doc ? 1 : 0 };
      }
    }

    if (sql.includes('UPDATE documents SET')) {
      if (params && params.length > 0) {
        const documentId = params[0]; // First param is always document ID
        const document = this.documents.get(documentId);
        
        if (document) {
          // Mock update - handle comprehensive update
          if (params.length >= 4) {
            // Full update with status, extracted_text, metadata
            document.status = params[1];
            document.extracted_text = params[2];
            document.pages = 1; // Mock page count
            document.processing_time_ms = 1500; // Mock processing time
            document.processed_at = new Date().toISOString();
            
            try {
              document.metadata = JSON.parse(params[3]);
            } catch {
              document.metadata = {};
            }
          } else if (params.length >= 2) {
            // Simple status update
            document.status = params[1];
            document.processed_at = new Date().toISOString();
          }

          this.documents.set(documentId, document);
          return { rows: [document], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Initialize with a test user and tenant
  async init(): Promise<void> {
    const testUser = {
      id: this.generateUUID(),
      email: 'test@paperflow.dev',
      company: 'PaperFlow Test',
      plan: 'pro',
      api_key_hash: '$2b$10$mock.hash.for.development.only',
      api_secret_hash: '$2b$10$mock.secret.hash.for.development.only',
      credits_remaining: 5000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      metadata: {},
    };

    // Initialize test tenant
    const testTenant = {
      id: 'test-tenant-complete-v3',
      slug: 'test-tenant-complete-v3',
      name: 'Test Tenant V3',
      plan: 'pro',
      custom_domain: null,
      settings: JSON.stringify({
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        currency: 'BRL',
        dateFormat: 'DD/MM/YYYY'
      }),
      quotas: JSON.stringify({
        maxDocuments: 5000,
        maxUsers: 20,
        maxTemplates: 100,
        maxWebhooks: 10,
        maxStorageGB: 50,
        currentUsage: {
          documents: 5,
          users: 2,
          templates: 1,
          webhooks: 1,
          storageGB: 0.8
        }
      }),
      billing: JSON.stringify({
        allowOverage: true,
        subscriptionId: 'sub_test_123',
        customerId: 'cus_test_123'
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      suspended_at: null,
      deleted_at: null
    };

    this.users.set(testUser.id, testUser);
    this.tenants.set(testTenant.id, testTenant);
    
    // Initialize sample templates
    const sampleTemplates = [
      {
        id: this.generateUUID(),
        tenant_id: testTenant.id,
        slug: 'admissao-colaborador',
        name: 'Admissão de Colaborador',
        description: 'Template completo para processo de admissão de novos colaboradores com documentação legal',
        category: 'hr',
        icon: '👥',
        tags: ['admissão', 'rh', 'colaborador'],
        visibility: 'tenant',
        workflow: JSON.stringify({
          steps: [
            { name: 'Upload de Documentos', type: 'upload', order: 1, required: true, config: { allowedFormats: ['pdf', 'jpg'] } },
            { name: 'Extração de Dados', type: 'extraction', order: 2, required: true, config: { strategy: 'ai' } },
            { name: 'Validação', type: 'validation', order: 3, required: true, config: { rules: ['required_fields'] } }
          ]
        }),
        fields: JSON.stringify([
          { name: 'full_name', label: 'Nome Completo', type: 'text', required: true },
          { name: 'cpf', label: 'CPF', type: 'text', required: true },
          { name: 'email', label: 'E-mail', type: 'email', required: true }
        ]),
        metrics: JSON.stringify({ usageCount: 25, rating: 4.5, reviews: 8 }),
        marketplace: JSON.stringify({ price: 0, currency: 'BRL', purchaseCount: 0 }),
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      },
      {
        id: this.generateUUID(),
        tenant_id: testTenant.id,
        slug: 'contrato-prestacao-servicos',
        name: 'Contrato de Prestação de Serviços',
        description: 'Template para geração automatizada de contratos de prestação de serviços',
        category: 'legal',
        icon: '📋',
        tags: ['contrato', 'legal', 'serviços'],
        visibility: 'public',
        workflow: JSON.stringify({
          steps: [
            { name: 'Dados das Partes', type: 'validation', order: 1, required: true, config: {} },
            { name: 'Geração do Contrato', type: 'ai_analysis', order: 2, required: true, config: {} },
            { name: 'Assinatura Digital', type: 'signature', order: 3, required: true, config: {} }
          ]
        }),
        fields: JSON.stringify([
          { name: 'contratante', label: 'Contratante', type: 'text', required: true },
          { name: 'contratado', label: 'Contratado', type: 'text', required: true },
          { name: 'valor', label: 'Valor', type: 'currency', required: true }
        ]),
        metrics: JSON.stringify({ usageCount: 150, rating: 4.8, reviews: 35 }),
        marketplace: JSON.stringify({ price: 29.90, currency: 'BRL', purchaseCount: 12 }),
        version: '2.1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      }
    ];

    sampleTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
    
    console.log('🧪 Mock database initialized with test user:', testUser.email);
    console.log('🏢 Mock database initialized with test tenant:', testTenant.name);
    console.log('📋 Mock database initialized with', sampleTemplates.length, 'sample templates');
  }

  private tenants: Map<string, any> = new Map();

  private handleBillingQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Handle billing_usage_records
    if (sql.includes('billing_usage_records')) {
      return this.handleBillingUsageRecords(sql, params);
    }

    // Handle billing_overage_charges
    if (sql.includes('billing_overage_charges')) {
      return this.handleBillingOverageCharges(sql, params);
    }

    // Handle billing_invoices
    if (sql.includes('billing_invoices')) {
      return this.handleBillingInvoices(sql, params);
    }

    // Handle billing_events_log
    if (sql.includes('billing_events_log')) {
      return this.handleBillingEventsLog(sql, params);
    }

    // Handle billing_payment_methods
    if (sql.includes('billing_payment_methods')) {
      return this.handleBillingPaymentMethods(sql, params);
    }

    // Handle billing_subscriptions
    if (sql.includes('billing_subscriptions')) {
      return this.handleBillingSubscriptions(sql, params);
    }

    return { rows: [], rowCount: 0 };
  }

  private handleBillingUsageRecords(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO billing_usage_records')) {
      if (params && params.length >= 8) {
        const [tenantId, resource, amount, cost, currency, periodStart, periodEnd] = params;
        const record = {
          id: this.generateUUID(),
          tenant_id: tenantId,
          resource,
          amount,
          cost,
          currency,
          period_start: periodStart,
          period_end: periodEnd,
          recorded_at: new Date().toISOString()
        };
        this.billingUsageRecords.set(record.id, record);
        return { rows: [record], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT * FROM billing_usage_records')) {
      if (params && params[0]) {
        const tenantId = params[0];
        const records = Array.from(this.billingUsageRecords.values())
          .filter(r => r.tenant_id === tenantId);
        
        // Apply date filtering if present
        if (params.length >= 3) {
          const periodStart = params[1];
          const periodEnd = params[2];
          records.filter(r => r.recorded_at >= periodStart && r.recorded_at <= periodEnd);
        }
        
        return { rows: records, rowCount: records.length };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleBillingOverageCharges(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO billing_overage_charges')) {
      if (params && params.length >= 6) {
        const [tenantId, resource, amount, unitCost, totalCost, currency, chargedAt] = params;
        const record = {
          id: this.generateUUID(),
          tenant_id: tenantId,
          resource,
          amount,
          unit_cost: unitCost,
          total_cost: totalCost,
          currency,
          charged_at: chargedAt || new Date().toISOString()
        };
        this.billingOverageCharges.set(record.id, record);
        return { rows: [record], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT * FROM billing_overage_charges')) {
      if (params && params[0]) {
        const tenantId = params[0];
        const charges = Array.from(this.billingOverageCharges.values())
          .filter(c => c.tenant_id === tenantId);
        return { rows: charges, rowCount: charges.length };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleBillingInvoices(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO billing_invoices')) {
      if (params && params.length >= 9) {
        const [id, tenantId, periodStart, periodEnd, subtotal, taxes, total, currency, dueDate] = params;
        const invoice = {
          id,
          tenant_id: tenantId,
          period_start: periodStart,
          period_end: periodEnd,
          subtotal,
          taxes,
          total,
          currency,
          status: 'pending',
          due_date: dueDate,
          created_at: new Date().toISOString(),
          paid_at: null
        };
        this.billingInvoices.set(invoice.id, invoice);
        return { rows: [invoice], rowCount: 1 };
      }
    }

    if (sql.includes('UPDATE billing_invoices SET status')) {
      if (params && params[0]) {
        const invoiceId = params[0];
        const invoice = this.billingInvoices.get(invoiceId);
        if (invoice) {
          invoice.status = 'paid';
          invoice.paid_at = new Date().toISOString();
          this.billingInvoices.set(invoiceId, invoice);
          return { rows: [invoice], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleBillingEventsLog(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO billing_events_log')) {
      if (params && params.length >= 4) {
        const [tenantId, eventType, eventData, metadata] = params;
        const event = {
          id: this.generateUUID(),
          tenant_id: tenantId,
          event_type: eventType,
          event_data: eventData,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
          processed_at: null
        };
        this.billingEventsLog.set(event.id, event);
        return { rows: [event], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('billing_events_log')) {
      if (params && params[0]) {
        const tenantId = params[0];
        let events = Array.from(this.billingEventsLog.values())
          .filter(e => e.tenant_id === tenantId);
        
        // Apply event type filter if present
        if (params.length > 1 && params[1]) {
          events = events.filter(e => e.event_type === params[1]);
        }
        
        // Sort by created_at DESC
        events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        return { rows: events, rowCount: events.length };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleBillingPaymentMethods(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Mock implementation for payment methods
    return { rows: [], rowCount: 0 };
  }

  private handleBillingSubscriptions(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Mock implementation for subscriptions
    return { rows: [], rowCount: 0 };
  }

  private handleDocumentEmbeddings(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('DELETE FROM document_embeddings')) {
      if (params && params.length >= 2) {
        const [documentId, tenantId] = params;
        const toDelete = Array.from(this.documentEmbeddings.keys()).filter(key => {
          const embedding = this.documentEmbeddings.get(key);
          return embedding.document_id === documentId && embedding.tenant_id === tenantId;
        });
        
        toDelete.forEach(key => this.documentEmbeddings.delete(key));
        return { rows: [], rowCount: toDelete.length };
      }
    }

    if (sql.includes('INSERT INTO document_embeddings')) {
      if (params && params.length >= 6) {
        const [id, documentId, tenantId, chunkText, embedding, chunkIndex, metadata] = params;
        const embeddingRecord = {
          id: id || this.generateUUID(),
          document_id: documentId,
          tenant_id: tenantId,
          chunk_text: chunkText,
          embedding,
          chunk_index: chunkIndex,
          metadata,
          created_at: new Date().toISOString()
        };
        
        this.documentEmbeddings.set(embeddingRecord.id, embeddingRecord);
        return { rows: [embeddingRecord], rowCount: 1 };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleSignatureRequests(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO signature_requests')) {
      if (params && params.length >= 8) {
        const [requestId, documentId, tenantId, signers, documentUrl, status, createdAt, expiresAt, metadata] = params;
        const record = {
          request_id: requestId,
          document_id: documentId,
          tenant_id: tenantId,
          signers,
          document_url: documentUrl,
          signed_document_url: null,
          status,
          created_at: createdAt,
          expires_at: expiresAt,
          completed_at: null,
          updated_at: new Date().toISOString(),
          metadata,
          deleted_at: null
        };
        this.signatureRequests.set(requestId, record);
        return { rows: [record], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('signature_requests')) {
      if (sql.includes('WHERE request_id = $1 AND tenant_id = $2')) {
        const [requestId, tenantId] = params || [];
        const record = this.signatureRequests.get(requestId);
        if (record && record.tenant_id === tenantId && !record.deleted_at) {
          return { rows: [record], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('WHERE tenant_id = $1')) {
        const [tenantId] = params || [];
        const records = Array.from(this.signatureRequests.values())
          .filter(r => r.tenant_id === tenantId && !r.deleted_at);
        return { rows: records, rowCount: records.length };
      }
    }

    if (sql.includes('UPDATE signature_requests')) {
      if (params && params.length > 0) {
        const requestId = params[params.length - 1]; // Last param is always request ID
        const record = this.signatureRequests.get(requestId);
        if (record) {
          // Update fields based on query
          if (sql.includes('status =')) record.status = params[0];
          if (sql.includes('signers =')) record.signers = params[1];
          if (sql.includes('signed_document_url =')) record.signed_document_url = params[2];
          if (sql.includes('completed_at =')) record.completed_at = params[3];
          record.updated_at = new Date().toISOString();
          
          this.signatureRequests.set(requestId, record);
          return { rows: [record], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleNotificationTemplates(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO notification_templates')) {
      if (params && params.length >= 8) {
        const [id, tenantId, name, type, template, variables, category, language] = params;
        const record = {
          id,
          tenant_id: tenantId,
          name,
          type,
          template,
          variables,
          category,
          language,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.notificationTemplates.set(id, record);
        return { rows: [{ id }], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('notification_templates')) {
      if (params && params[0]) {
        const tenantId = params[0];
        const templates = Array.from(this.notificationTemplates.values())
          .filter(t => t.tenant_id === tenantId && t.active);
        return { rows: templates, rowCount: templates.length };
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleIntegrationAuditLog(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO integration_audit_log')) {
      if (params && params.length >= 10) {
        const [id, tenantId, type, action, resourceId, userId, recipient, template, status, details, error] = params;
        const record = {
          id,
          tenant_id: tenantId,
          type,
          action,
          resource_id: resourceId,
          user_id: userId,
          recipient,
          template,
          status,
          details,
          error,
          created_at: new Date().toISOString(),
          processed_at: null
        };
        this.integrationAuditLog.set(id, record);
        return { rows: [record], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT COUNT(*)') && sql.includes('integration_audit_log')) {
      if (params && params[0]) {
        const tenantId = params[0];
        const count = Array.from(this.integrationAuditLog.values())
          .filter(l => l.tenant_id === tenantId).length;
        return { rows: [{ total: count.toString() }], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT *') && sql.includes('integration_audit_log')) {
      if (params && params[0]) {
        const tenantId = params[0];
        let logs = Array.from(this.integrationAuditLog.values())
          .filter(l => l.tenant_id === tenantId);
        
        // Apply type filter if present
        if (params.length > 1 && sql.includes('AND type =')) {
          logs = logs.filter(l => l.type === params[1]);
        }
        
        // Sort by created_at DESC
        logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        return { rows: logs, rowCount: logs.length };
      }
    }

    if (sql.includes('UPDATE integration_audit_log')) {
      if (params && params.length >= 3) {
        const messageId = params[2];
        const logs = Array.from(this.integrationAuditLog.values());
        const logToUpdate = logs.find(l => 
          l.details && 
          typeof l.details === 'string' && 
          l.details.includes(`"whatsapp_message_id":"${messageId}"`)
        );
        
        if (logToUpdate) {
          logToUpdate.status = params[0];
          const updatedDetails = JSON.parse(logToUpdate.details);
          updatedDetails.whatsapp_status = JSON.parse(params[1]);
          logToUpdate.details = JSON.stringify(updatedDetails);
          logToUpdate.processed_at = new Date().toISOString();
          return { rows: [logToUpdate], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleTenantQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Handle tenant count queries
    if (sql.includes('SELECT COUNT(*)') && sql.includes('tenants')) {
      const allTenants = Array.from(this.tenants.values())
        .filter(t => !t.deleted_at);
      return { rows: [{ total: allTenants.length.toString() }], rowCount: 1 };
    }

    // Handle tenant creation
    if (sql.includes('INSERT INTO tenants')) {
      if (params && params.length >= 8) {
        const [id, slug, name, plan, custom_domain, settings, quotas, billing] = params;
        const tenant = {
          id,
          slug,
          name,
          plan,
          custom_domain,
          settings: typeof settings === 'string' ? settings : JSON.stringify(settings),
          quotas: typeof quotas === 'string' ? quotas : JSON.stringify(quotas),
          billing: typeof billing === 'string' ? billing : JSON.stringify(billing),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          suspended_at: null,
          deleted_at: null
        };

        this.tenants.set(tenant.id, tenant);
        return { rows: [tenant], rowCount: 1 };
      }
    }

    // Handle tenant selection
    if (sql.includes('SELECT * FROM tenants WHERE')) {
      if (params && params[0]) {
        const identifier = params[0];
        // Find tenant by ID or slug
        const tenant = this.tenants.get(identifier) || 
          Array.from(this.tenants.values()).find(t => t.slug === identifier);
        return { rows: tenant ? [tenant] : [], rowCount: tenant ? 1 : 0 };
      }
    }

    // Handle tenant listing
    if (sql.includes('SELECT * FROM tenants') && sql.includes('ORDER BY created_at DESC')) {
      const allTenants = Array.from(this.tenants.values())
        .filter(t => !t.deleted_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Apply LIMIT if present
      if (sql.includes('LIMIT') && params && params.length >= 2) {
        // LIMIT and OFFSET are always the last two parameters
        const limit = params[params.length - 2] || 20;
        const offset = params[params.length - 1] || 0;
        return { rows: allTenants.slice(offset, offset + limit), rowCount: allTenants.length };
      }
      
      return { rows: allTenants, rowCount: allTenants.length };
    }
    
    // Handle tenant updates
    if (sql.includes('UPDATE tenants') && sql.includes('SET') && !sql.includes('deleted_at = NOW()')) {
      if (params && params.length > 0) {
        const tenantId = params[params.length - 1]; // Last param is always tenant ID
        
        const tenant = this.tenants.get(tenantId);
        
        if (tenant && !tenant.deleted_at) {
          // Parse SQL to understand field updates
          let paramIndex = 0;
          
          if (sql.includes('name =')) {
            tenant.name = params[paramIndex++];
          }
          if (sql.includes('plan =')) {
            tenant.plan = params[paramIndex++];
          }
          if (sql.includes('quotas = quotas ||')) {
            // Skip the quotas merge parameter for now (complex PostgreSQL syntax)
            paramIndex++;
          }
          if (sql.includes('custom_domain =')) {
            tenant.custom_domain = params[paramIndex++];
          }
          if (sql.includes('settings = settings ||')) {
            // Skip the settings merge parameter for now (complex PostgreSQL syntax)
            paramIndex++;
          }
          if (sql.includes('suspended_at = NOW()')) {
            tenant.suspended_at = new Date().toISOString();
          }
          if (sql.includes('suspended_at = NULL')) {
            tenant.suspended_at = null;
          }
          
          tenant.updated_at = new Date().toISOString();
          this.tenants.set(tenantId, tenant);
          return { rows: [tenant], rowCount: 1 };
        }
      }
    }
    
    // Handle tenant soft delete
    if (sql.includes('UPDATE tenants SET') && sql.includes('deleted_at = NOW()')) {
      if (params && params[0]) {
        const tenantId = params[0];
        const tenant = this.tenants.get(tenantId);
        
        if (tenant) {
          tenant.deleted_at = new Date().toISOString();
          tenant.updated_at = new Date().toISOString();
          this.tenants.set(tenantId, tenant);
          return { rows: [tenant], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private handleProductMetrics(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO product_metrics')) {
      if (params && params.length >= 7) {
        const [eventType, tenantId, userId, metadata, value, currency, recordedAt] = params;
        const metric = {
          id: this.generateUUID(),
          event_type: eventType,
          tenant_id: tenantId,
          user_id: userId,
          metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
          value,
          currency,
          recorded_at: recordedAt || new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        this.productMetrics.set(metric.id, metric);
        return { rows: [metric], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('product_metrics')) {
      const allMetrics = Array.from(this.productMetrics.values());
      
      // Mock data generation for AARRR calculations
      if (sql.includes('tenant_created') || sql.includes('user_signup')) {
        // Generate some mock acquisition data
        const mockData = [{
          new_tenants: 5,
          signups: 8,
          activations: 6
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      if (sql.includes('onboarding_completed') || sql.includes('first_document_processed')) {
        const mockData = [{
          onboarding_completed: 6,
          first_document: 4,
          avg_time_to_value: 24.5
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      if (sql.includes('daily_active') || sql.includes('retention_cohort')) {
        const mockData = [{
          daily_retention: 25,
          weekly_retention: 18,
          monthly_retention: 12,
          churned: 3
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      if (sql.includes('payment_received')) {
        const mockData = [{
          monthly_revenue: 2500.00,
          total_revenue: 15000.00,
          paying_customers: 8
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      if (sql.includes('referral_sent') || sql.includes('referral_converted')) {
        const mockData = [{
          referrals_sent: 12,
          referrals_converted: 4
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      // Mock usage data for health scores
      if (sql.includes('document_processed') || sql.includes('template_executed')) {
        const mockData = [{
          documents_processed: 45,
          templates_used: 8,
          api_calls: 1250,
          active_days: 22,
          active_users: 3,
          feature_usage: 85,
          integration_usage: 12,
          tickets: 1,
          resolved_tickets: 1,
          integrations_setup: 2,
          webhook_success: 95,
          webhook_failures: 5
        }];
        return { rows: mockData, rowCount: mockData.length };
      }

      // Return filtered metrics
      let filteredMetrics = allMetrics;
      if (params && params.length > 0) {
        const tenantId = params[0];
        filteredMetrics = allMetrics.filter(m => m.tenant_id === tenantId);
      }

      return { rows: filteredMetrics, rowCount: filteredMetrics.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleTenantHealthScores(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO tenant_health_scores')) {
      if (params && params.length >= 6) {
        const [tenantId, score, factors, risk, recommendations, calculatedAt] = params;
        const healthScore = {
          tenant_id: tenantId,
          score,
          factors: typeof factors === 'string' ? factors : JSON.stringify(factors),
          risk,
          recommendations: typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations),
          calculated_at: calculatedAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        this.tenantHealthScores.set(tenantId, healthScore);
        return { rows: [healthScore], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('tenant_health_scores')) {
      const allScores = Array.from(this.tenantHealthScores.values());
      
      // Handle admin queries with JOIN
      if (sql.includes('JOIN tenants')) {
        const mockScores = allScores.map(score => ({
          ...score,
          tenant_name: `Tenant ${score.tenant_id.slice(0, 8)}`,
          plan: 'pro'
        }));
        return { rows: mockScores, rowCount: mockScores.length };
      }

      // Handle summary queries
      if (sql.includes('AVG(score)') && sql.includes('COUNT(*)')) {
        const mockSummary = [{
          average_score: 72,
          low_risk: 3,
          medium_risk: 2,
          high_risk: 1,
          total: 6
        }];
        return { rows: mockSummary, rowCount: mockSummary.length };
      }

      return { rows: allScores, rowCount: allScores.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleSecurityAuditLog(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO security_audit_log')) {
      if (params && params.length >= 14) {
        const [eventType, tenantId, userId, resourceId, resourceType, action, outcome, severity, metadata, ipAddress, userAgent, sessionId, correlationId, loggedAt] = params;
        const auditLog = {
          id: this.generateUUID(),
          event_type: eventType,
          tenant_id: tenantId,
          user_id: userId,
          resource_id: resourceId,
          resource_type: resourceType,
          action,
          outcome,
          severity,
          metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
          ip_address: ipAddress,
          user_agent: userAgent,
          session_id: sessionId,
          correlation_id: correlationId,
          logged_at: loggedAt || new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        this.securityAuditLog.set(auditLog.id, auditLog);
        return { rows: [auditLog], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT') && sql.includes('security_audit_log')) {
      const allLogs = Array.from(this.securityAuditLog.values());
      
      // Mock data for security dashboard queries
      if (sql.includes('COUNT(*)') && sql.includes('outcome = \'failure\'')) {
        const mockStats = [{
          total_events: 150,
          failed_events: 12,
          unique_users: 8,
          unique_ips: 15
        }];
        return { rows: mockStats, rowCount: mockStats.length };
      }

      // Mock data for events trend
      if (sql.includes('DATE(logged_at)')) {
        const mockTrend = [
          { date: '2024-01-31', events: 45, failures: 3 },
          { date: '2024-01-30', events: 38, failures: 2 },
          { date: '2024-01-29', events: 52, failures: 4 },
          { date: '2024-01-28', events: 41, failures: 1 },
          { date: '2024-01-27', events: 35, failures: 2 }
        ];
        return { rows: mockTrend, rowCount: mockTrend.length };
      }

      // Filter logs based on tenant
      let filteredLogs = allLogs;
      if (params && params.length > 0) {
        const tenantId = params[0];
        filteredLogs = allLogs.filter(log => log.tenant_id === tenantId);
      }

      // Add some mock data
      if (filteredLogs.length === 0) {
        filteredLogs = [
          {
            id: this.generateUUID(),
            event_type: 'authentication',
            tenant_id: params?.[0] || 'test-tenant-123',
            user_id: 'user-123',
            action: 'login',
            outcome: 'success',
            severity: 'low',
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            logged_at: new Date().toISOString()
          },
          {
            id: this.generateUUID(),
            event_type: 'document_access',
            tenant_id: params?.[0] || 'test-tenant-123',
            user_id: 'user-123',
            resource_id: 'doc-456',
            resource_type: 'document',
            action: 'view',
            outcome: 'success',
            severity: 'low',
            ip_address: '192.168.1.100',
            logged_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
          }
        ];
      }

      return { rows: filteredLogs, rowCount: filteredLogs.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleSecurityAlerts(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO security_alerts')) {
      if (params && params.length >= 14) {
        const [id, type, severity, title, description, tenantId, userId, resourceId, detectedAt, evidence, status, assignedTo, resolvedAt, actionsTaken] = params;
        const alert = {
          id,
          type,
          severity,
          title,
          description,
          tenant_id: tenantId,
          user_id: userId,
          resource_id: resourceId,
          detected_at: detectedAt || new Date().toISOString(),
          evidence: typeof evidence === 'string' ? evidence : JSON.stringify(evidence),
          status,
          assigned_to: assignedTo,
          resolved_at: resolvedAt,
          actions_taken: typeof actionsTaken === 'string' ? actionsTaken : JSON.stringify(actionsTaken),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        this.securityAlerts.set(id, alert);
        return { rows: [alert], rowCount: 1 };
      }
    }

    if (sql.includes('UPDATE security_alerts')) {
      // Mock update - just return success
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('SELECT') && sql.includes('security_alerts')) {
      const allAlerts = Array.from(this.securityAlerts.values());
      
      // Mock data for alerts count
      if (sql.includes('COUNT(*)') && sql.includes('status = \'active\'')) {
        const mockAlertStats = [{
          active_alerts: 3,
          critical_alerts: 1
        }];
        return { rows: mockAlertStats, rowCount: mockAlertStats.length };
      }

      // Filter alerts based on tenant and status
      let filteredAlerts = allAlerts;
      if (params && params.length > 0) {
        const tenantId = params[0];
        filteredAlerts = allAlerts.filter(alert => alert.tenant_id === tenantId);
        
        if (params.length > 1) {
          const status = params[1];
          filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
        }
      }

      // Add some mock data if no alerts exist
      if (filteredAlerts.length === 0) {
        filteredAlerts = [
          {
            id: 'alert_001',
            type: 'anomaly',
            severity: 'medium',
            title: 'Unusual API Activity',
            description: 'High volume of API calls detected',
            tenant_id: params?.[0] || 'test-tenant-123',
            user_id: 'user-123',
            detected_at: new Date().toISOString(),
            evidence: JSON.stringify({ apiCalls: 1200, threshold: 1000 }),
            status: 'active',
            assigned_to: null,
            resolved_at: null,
            actions_taken: JSON.stringify([])
          },
          {
            id: 'alert_002',
            type: 'brute_force',
            severity: 'high',
            title: 'Multiple Failed Login Attempts',
            description: 'Brute force attack detected from IP 192.168.1.100',
            tenant_id: params?.[0] || 'test-tenant-123',
            detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            evidence: JSON.stringify({ failedAttempts: 8, ipAddress: '192.168.1.100' }),
            status: 'resolved',
            assigned_to: 'admin@company.com',
            resolved_at: new Date().toISOString(),
            actions_taken: JSON.stringify(['IP blocked', 'User notified'])
          }
        ];
      }

      return { rows: filteredAlerts, rowCount: filteredAlerts.length };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleTemplateQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Handle template count queries
    if (sql.includes('SELECT COUNT(*)') && sql.includes('templates')) {
      const allTemplates = Array.from(this.templates.values())
        .filter(t => !t.deleted_at);
      return { rows: [{ total: allTemplates.length.toString() }], rowCount: 1 };
    }

    // Handle template creation
    if (sql.includes('INSERT INTO templates')) {
      if (params && params.length >= 8) {
        const [id, tenantId, slug, name, description, content, variables, tags] = params;
        const template = {
          id,
          tenant_id: tenantId,
          slug,
          name,
          description,
          content,
          variables: typeof variables === 'string' ? variables : JSON.stringify(variables),
          tags: typeof tags === 'string' ? tags : JSON.stringify(tags),
          version: 1,
          status: 'active',
          visibility: 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null
        };

        this.templates.set(template.id, template);
        return { rows: [template], rowCount: 1 };
      }
    }

    // Handle specific template by ID query (from template engine)
    if (sql.includes('SELECT * FROM templates WHERE id = $1')) {
      if (params && params.length >= 1) {
        const templateId = params[0];
        const template = this.templates.get(templateId);
        
        if (template && !template.deleted_at) {
          // If tenant filter is provided, check tenant access
          if (params.length >= 2) {
            const tenantId = params[1];
            if (template.tenant_id === tenantId || 
                template.visibility === 'public' || 
                template.visibility === 'marketplace') {
              return { rows: [template], rowCount: 1 };
            }
          } else {
            // No tenant filter, return template if not deleted
            return { rows: [template], rowCount: 1 };
          }
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Handle template selection (list templates)
    if (sql.includes('SELECT * FROM templates WHERE')) {
      let filteredTemplates = Array.from(this.templates.values())
        .filter(t => !t.deleted_at);

      // Apply tenant filter if present
      if (params && params.length > 0) {
        const tenantId = params[0];
        filteredTemplates = filteredTemplates.filter(t => 
          t.tenant_id === tenantId || t.visibility === 'public' || t.visibility === 'marketplace'
        );
      }

      // Apply LIMIT and OFFSET if present
      if (sql.includes('LIMIT') && params && params.length >= 2) {
        const limit = params[params.length - 2] || 20;
        const offset = params[params.length - 1] || 0;
        return { rows: filteredTemplates.slice(offset, offset + limit), rowCount: filteredTemplates.length };
      }

      return { rows: filteredTemplates, rowCount: filteredTemplates.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// Mock client class that mimics pg client behavior
class MockDatabaseClient {
  constructor(private mockDb: MockDatabase) {}

  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    return this.mockDb.query(sql, params);
  }

  release(): void {
    // No-op for mock client
  }
}

// Create singleton instance
export const mockDb = new MockDatabase();

// Database connection interface that works for both real and mock
export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

// Export the appropriate database connection
export const db: DatabaseConnection = env.NODE_ENV === 'development' ? mockDb : require('./database').db;