import { 
  DocumentTemplate, 
  TemplateExecution, 
  WorkflowStep, 
  StepResult, 
  ExecutionError,
  ExecutionMetrics,
  CreateTemplateRequest,
  UpdateTemplateRequest
} from '../types/templates';
import { DatabaseService } from './database';
import { QuotaManager } from './quota-manager';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class TemplateEngine extends EventEmitter {
  constructor(
    private db: DatabaseService,
    private quotaManager: QuotaManager
  ) {
    super();
  }

  // Template Management
  async createTemplate(tenantId: string, request: CreateTemplateRequest): Promise<DocumentTemplate> {
    // Check quotas
    const quotaCheck = await this.quotaManager.checkQuota(tenantId, 'templates', 1);
    if (!quotaCheck.allowed) {
      throw new Error('Template quota exceeded');
    }

    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');

      const templateId = crypto.randomUUID();
      
      // Validate template data
      this.validateTemplate(request);
      
      // Generate workflow step IDs
      const workflow = {
        ...request.workflow,
        steps: request.workflow.steps.map(step => ({
          ...step,
          id: crypto.randomUUID()
        })),
        automations: [],
        integrations: [],
        notifications: []
      };

      // Generate field IDs
      const fields = request.fields.map(field => ({
        ...field,
        id: crypto.randomUUID()
      }));

      // Generate validation rule IDs
      const validations = (request.validations || []).map(validation => ({
        ...validation,
        id: crypto.randomUUID()
      }));

      const template: DocumentTemplate = {
        id: templateId,
        tenantId,
        slug: request.slug,
        name: request.name,
        description: request.description,
        category: request.category,
        icon: request.icon || this.getDefaultIcon(request.category),
        tags: request.tags || [],
        visibility: request.visibility || 'tenant',
        workflow,
        fields,
        validations,
        piiDetection: request.piiDetection || {
          enabled: true,
          patterns: ['cpf', 'cnpj', 'rg'],
          redactionStrategy: 'partial'
        },
        metrics: {
          averageProcessingTime: 0,
          successRate: 100,
          usageCount: 0,
          rating: 0,
          reviews: 0
        },
        version: '1.0.0',
        createdBy: tenantId, // Simplified - should be user ID
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await client.query(`
        INSERT INTO templates (
          id, tenant_id, slug, name, description, category, icon, tags, 
          visibility, workflow, fields, validations, pii_detection, 
          metrics, version, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
      `, [
        template.id,
        template.tenantId,
        template.slug,
        template.name,
        template.description,
        template.category,
        template.icon,
        JSON.stringify(template.tags),
        template.visibility,
        JSON.stringify(template.workflow),
        JSON.stringify(template.fields),
        JSON.stringify(template.validations),
        JSON.stringify(template.piiDetection),
        JSON.stringify(template.metrics),
        template.version,
        template.createdBy,
        template.createdAt,
        template.updatedAt
      ]);

      await client.query('COMMIT');
      
      // Emit event
      this.emit('templateCreated', template);
      
      return template;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemplate(templateId: string, tenantId?: string): Promise<DocumentTemplate | null> {
    try {
      let query = 'SELECT * FROM templates WHERE id = $1 AND deleted_at IS NULL';
      const params = [templateId];

      if (tenantId) {
        query += ' AND (tenant_id = $2 OR visibility IN (\'public\', \'marketplace\'))';
        params.push(tenantId);
      }

      const result = await this.db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToTemplate(result.rows[0]);
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  async listTemplates(
    tenantId: string,
    filters: {
      category?: string;
      tags?: string[];
      visibility?: string;
      search?: string;
    } = {},
    page = 1,
    limit = 20
  ): Promise<{
    templates: DocumentTemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = ['deleted_at IS NULL'];
      const params: any[] = [];
      let paramIndex = 1;

      // Tenant-scoped templates or public ones
      conditions.push(`(tenant_id = $${paramIndex++} OR visibility IN ('public', 'marketplace'))`);
      params.push(tenantId);

      if (filters.category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(filters.category);
      }

      if (filters.visibility) {
        conditions.push(`visibility = $${paramIndex++}`);
        params.push(filters.visibility);
      }

      if (filters.tags?.length) {
        conditions.push(`tags && $${paramIndex++}::jsonb`);
        params.push(JSON.stringify(filters.tags));
      }

      if (filters.search) {
        conditions.push(`(name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
        params.push(`%${filters.search}%`, `%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Count total
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM templates WHERE ${whereClause}`,
        params
      );

      // Get templates
      params.push(limit, offset);
      const result = await this.db.query(
        `SELECT * FROM templates WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        params
      );

      return {
        templates: result.rows.map(row => this.mapDatabaseToTemplate(row)),
        total: parseInt(countResult.rows[0].total),
        page,
        limit
      };

    } catch (error) {
      console.error('Error listing templates:', error);
      return { templates: [], total: 0, page, limit };
    }
  }

  // Template Execution
  async executeTemplate(
    templateId: string,
    tenantId: string,
    documentId: string,
    userId: string,
    inputData: Record<string, any> = {}
  ): Promise<TemplateExecution> {
    const template = await this.getTemplate(templateId, tenantId);
    if (!template) {
      throw new Error('Template not found');
    }

    const executionId = crypto.randomUUID();
    
    const execution: TemplateExecution = {
      id: executionId,
      templateId,
      tenantId,
      documentId,
      userId,
      status: 'pending',
      stepResults: {},
      data: { ...inputData },
      errors: [],
      metrics: {
        stepCount: template.workflow.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        retryCount: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save execution to database
    await this.saveExecution(execution);

    // Start execution asynchronously
    this.processExecution(execution, template).catch(error => {
      console.error('Execution failed:', error);
      this.handleExecutionError(execution, error);
    });

    return execution;
  }

  private async processExecution(execution: TemplateExecution, template: DocumentTemplate): Promise<void> {
    const startTime = Date.now();
    
    try {
      execution.status = 'running';
      await this.updateExecution(execution);
      
      // Sort steps by order
      const sortedSteps = [...template.workflow.steps].sort((a, b) => a.order - b.order);
      
      for (const step of sortedSteps) {
        // Check dependencies
        if (step.dependencies?.length) {
          const dependenciesMet = step.dependencies.every(depId => {
            const depResult = execution.stepResults[depId];
            return depResult?.status === 'completed';
          });
          
          if (!dependenciesMet) {
            execution.stepResults[step.id] = {
              stepId: step.id,
              status: 'skipped',
              startedAt: new Date(),
              completedAt: new Date(),
              error: 'Dependencies not met'
            };
            execution.metrics.skippedSteps++;
            continue;
          }
        }

        // Execute step
        const stepResult = await this.executeStep(step, execution, template);
        execution.stepResults[step.id] = stepResult;
        
        if (stepResult.status === 'completed') {
          execution.metrics.completedSteps++;
        } else if (stepResult.status === 'failed') {
          execution.metrics.failedSteps++;
          
          if (step.required) {
            throw new Error(`Required step ${step.name} failed: ${stepResult.error}`);
          }
        }
        
        execution.currentStep = step.id;
        execution.updatedAt = new Date();
        await this.updateExecution(execution);
        
        // Emit step completed event
        this.emit('stepCompleted', {
          executionId: execution.id,
          stepId: step.id,
          result: stepResult
        });
      }
      
      // Execution completed
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.metrics.totalDuration = Date.now() - startTime;
      
      await this.updateExecution(execution);
      await this.updateTemplateMetrics(template.id);
      
      this.emit('executionCompleted', execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.errors.push({
        code: 'EXECUTION_FAILED',
        message: error.message,
        timestamp: new Date(),
        details: { error: error.stack }
      });
      execution.metrics.totalDuration = Date.now() - startTime;
      
      await this.updateExecution(execution);
      
      this.emit('executionFailed', { execution, error });
      throw error;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    execution: TemplateExecution,
    template: DocumentTemplate
  ): Promise<StepResult> {
    const startTime = Date.now();
    
    const stepResult: StepResult = {
      stepId: step.id,
      status: 'running',
      startedAt: new Date(),
      metrics: {
        duration: 0,
        attempts: 1
      }
    };

    try {
      let result: any;
      
      switch (step.type) {
        case 'upload':
          result = await this.executeUploadStep(step, execution);
          break;
        case 'validation':
          result = await this.executeValidationStep(step, execution, template);
          break;
        case 'extraction':
          result = await this.executeExtractionStep(step, execution, template);
          break;
        case 'approval':
          result = await this.executeApprovalStep(step, execution);
          break;
        case 'signature':
          result = await this.executeSignatureStep(step, execution);
          break;
        case 'package':
          result = await this.executePackageStep(step, execution);
          break;
        case 'integration':
          result = await this.executeIntegrationStep(step, execution);
          break;
        case 'ai_analysis':
          result = await this.executeAIAnalysisStep(step, execution);
          break;
        case 'ocr':
          result = await this.executeOCRStep(step, execution);
          break;
        case 'webhook':
          result = await this.executeWebhookStep(step, execution);
          break;
        case 'notification':
          result = await this.executeNotificationStep(step, execution);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      stepResult.status = 'completed';
      stepResult.result = result;
      stepResult.completedAt = new Date();
      stepResult.metrics!.duration = Date.now() - startTime;

      return stepResult;

    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
      stepResult.completedAt = new Date();
      stepResult.metrics!.duration = Date.now() - startTime;

      // Retry logic
      if (step.retryPolicy && stepResult.metrics!.attempts < step.retryPolicy.maxAttempts) {
        const delay = this.calculateRetryDelay(step.retryPolicy, stepResult.metrics!.attempts);
        
        setTimeout(async () => {
          stepResult.metrics!.attempts++;
          execution.metrics.retryCount++;
          
          const retryResult = await this.executeStep(step, execution, template);
          Object.assign(stepResult, retryResult);
          
          await this.updateExecution(execution);
        }, delay);
      }

      return stepResult;
    }
  }

  // Step execution implementations
  private async executeUploadStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Implementation for file upload validation
    return { status: 'completed', message: 'File upload validated' };
  }

  private async executeValidationStep(
    step: WorkflowStep, 
    execution: TemplateExecution, 
    template: DocumentTemplate
  ): Promise<any> {
    // Run template validations
    const errors: string[] = [];
    
    for (const validation of template.validations) {
      try {
        const isValid = await this.validateField(validation, execution.data);
        if (!isValid) {
          errors.push(validation.errorMessage);
        }
      } catch (error) {
        errors.push(`Validation error: ${error.message}`);
      }
    }

    if (errors.length > 0 && step.config.failOnError !== false) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return { 
      status: 'completed', 
      validationResults: errors.length === 0 ? 'passed' : 'warnings',
      errors 
    };
  }

  private async executeExtractionStep(
    step: WorkflowStep, 
    execution: TemplateExecution, 
    template: DocumentTemplate
  ): Promise<any> {
    // Extract data from document based on template fields
    const extractedData: Record<string, any> = {};
    
    for (const field of template.fields) {
      if (field.extraction?.enabled) {
        try {
          const value = await this.extractFieldValue(field, execution.documentId);
          extractedData[field.name] = value;
        } catch (error) {
          console.error(`Failed to extract field ${field.name}:`, error);
          if (field.required) {
            throw error;
          }
        }
      }
    }

    // Merge extracted data into execution data
    Object.assign(execution.data, extractedData);

    return { 
      status: 'completed', 
      extractedFields: Object.keys(extractedData).length,
      data: extractedData
    };
  }

  private async executeApprovalStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Create approval request (this would integrate with approval system)
    return { 
      status: 'completed', 
      message: 'Approval request created',
      approvalId: crypto.randomUUID()
    };
  }

  private async executeSignatureStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Signature step implementation
    return { 
      status: 'completed', 
      message: 'Signature request sent',
      signatureId: crypto.randomUUID()
    };
  }

  private async executePackageStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Package creation implementation
    return { 
      status: 'completed', 
      message: 'Evidence package created',
      packageId: crypto.randomUUID()
    };
  }

  private async executeIntegrationStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Integration step implementation
    return { 
      status: 'completed', 
      message: 'Integration executed',
      integrationResult: {}
    };
  }

  private async executeAIAnalysisStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // AI analysis implementation
    return { 
      status: 'completed', 
      message: 'AI analysis completed',
      analysis: {}
    };
  }

  private async executeOCRStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // OCR implementation
    return { 
      status: 'completed', 
      message: 'OCR processing completed',
      extractedText: 'Sample extracted text'
    };
  }

  private async executeWebhookStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Webhook execution
    return { 
      status: 'completed', 
      message: 'Webhook sent',
      webhookResponse: {}
    };
  }

  private async executeNotificationStep(step: WorkflowStep, execution: TemplateExecution): Promise<any> {
    // Notification implementation
    return { 
      status: 'completed', 
      message: 'Notification sent'
    };
  }

  // Helper methods
  private validateTemplate(request: CreateTemplateRequest): void {
    if (!request.name || request.name.length < 3) {
      throw new Error('Template name must be at least 3 characters');
    }
    
    if (!request.slug || !/^[a-z0-9-]+$/.test(request.slug)) {
      throw new Error('Template slug must contain only lowercase letters, numbers, and hyphens');
    }
    
    if (!request.workflow.steps.length) {
      throw new Error('Template must have at least one workflow step');
    }
  }

  private getDefaultIcon(category: string): string {
    const icons: Record<string, string> = {
      hr: '👥',
      finance: '💰',
      legal: '⚖️',
      compliance: '✅',
      procurement: '🛒',
      sales: '📊'
    };
    
    return icons[category] || '📄';
  }

  private async validateField(validation: any, data: Record<string, any>): Promise<boolean> {
    // Field validation logic
    return true; // Simplified
  }

  private async extractFieldValue(field: any, documentId: string): Promise<any> {
    // Field extraction logic
    return `extracted_${field.name}`; // Simplified
  }

  private calculateRetryDelay(retryPolicy: any, attempt: number): number {
    const { backoffStrategy, initialDelay, maxDelay } = retryPolicy;
    
    let delay = initialDelay;
    
    switch (backoffStrategy) {
      case 'exponential':
        delay = initialDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = initialDelay * attempt;
        break;
      case 'fixed':
      default:
        delay = initialDelay;
    }
    
    return maxDelay ? Math.min(delay, maxDelay) : delay;
  }

  private async saveExecution(execution: TemplateExecution): Promise<void> {
    await this.db.query(`
      INSERT INTO template_executions (
        id, template_id, tenant_id, document_id, user_id, status,
        current_step, step_results, data, errors, metrics,
        created_at, updated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      execution.id,
      execution.templateId,
      execution.tenantId,
      execution.documentId,
      execution.userId,
      execution.status,
      execution.currentStep,
      JSON.stringify(execution.stepResults),
      JSON.stringify(execution.data),
      JSON.stringify(execution.errors),
      JSON.stringify(execution.metrics),
      execution.createdAt,
      execution.updatedAt,
      execution.completedAt
    ]);
  }

  private async updateExecution(execution: TemplateExecution): Promise<void> {
    await this.db.query(`
      UPDATE template_executions SET
        status = $2, current_step = $3, step_results = $4, data = $5,
        errors = $6, metrics = $7, updated_at = $8, completed_at = $9
      WHERE id = $1
    `, [
      execution.id,
      execution.status,
      execution.currentStep,
      JSON.stringify(execution.stepResults),
      JSON.stringify(execution.data),
      JSON.stringify(execution.errors),
      JSON.stringify(execution.metrics),
      execution.updatedAt,
      execution.completedAt
    ]);
  }

  private async updateTemplateMetrics(templateId: string): Promise<void> {
    // Update template usage metrics
    await this.db.query(`
      UPDATE templates SET
        metrics = jsonb_set(metrics, '{usageCount}', (COALESCE(metrics->>'usageCount', '0')::int + 1)::text::jsonb),
        updated_at = NOW()
      WHERE id = $1
    `, [templateId]);
  }

  private async handleExecutionError(execution: TemplateExecution, error: Error): Promise<void> {
    console.error('Template execution failed:', error);
    
    execution.status = 'failed';
    execution.errors.push({
      code: 'EXECUTION_ERROR',
      message: error.message,
      timestamp: new Date()
    });
    
    await this.updateExecution(execution);
  }

  private mapDatabaseToTemplate(row: any): DocumentTemplate {
    // Parse workflow with error handling
    let workflow;
    try {
      workflow = typeof row.workflow === 'string' ? JSON.parse(row.workflow) : row.workflow;
      // Ensure workflow has steps array
      if (workflow && !workflow.steps) {
        workflow.steps = [];
      }
    } catch (error) {
      console.error('Error parsing workflow JSON:', error, 'Raw workflow:', row.workflow);
      workflow = { steps: [] };
    }

    // Parse fields with error handling
    let fields;
    try {
      fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
      if (!Array.isArray(fields)) {
        fields = [];
      }
    } catch (error) {
      console.error('Error parsing fields JSON:', error, 'Raw fields:', row.fields);
      fields = [];
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
      visibility: row.visibility,
      workflow,
      fields,
      validations: typeof row.validations === 'string' ? JSON.parse(row.validations || '[]') : row.validations,
      piiDetection: typeof row.pii_detection === 'string' ? JSON.parse(row.pii_detection) : row.pii_detection,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
      marketplace: row.marketplace ? (typeof row.marketplace === 'string' ? JSON.parse(row.marketplace) : row.marketplace) : undefined,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      deletedAt: row.deleted_at
    };
  }
}