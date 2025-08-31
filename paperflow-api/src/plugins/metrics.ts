import { FastifyPluginAsync } from 'fastify';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { env } from '@/config/env';

// Registrar métricas padrão do Node.js apenas se as métricas estiverem habilitadas
if (env.ENABLE_METRICS) {
  collectDefaultMetrics({
    prefix: 'paperflow_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
}

// Métricas customizadas do PaperFlow
const httpRequestDuration = new Histogram({
  name: 'paperflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestsTotal = new Counter({
  name: 'paperflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const documentsProcessedTotal = new Counter({
  name: 'paperflow_documents_processed_total',
  help: 'Total number of documents processed',
  labelNames: ['status', 'user_plan'],
});

const pipelineStageDuration = new Histogram({
  name: 'paperflow_pipeline_stage_duration_seconds',
  help: 'Duration of document processing pipeline stages',
  labelNames: ['stage', 'document_type'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
});

const activeSSEConnections = new Gauge({
  name: 'paperflow_sse_connections_active',
  help: 'Number of active Server-Sent Events connections',
});

const piiEntitiesDetected = new Counter({
  name: 'paperflow_pii_entities_detected_total',
  help: 'Total number of PII entities detected',
  labelNames: ['type', 'confidence_level'],
});

const batesNumberingOperations = new Counter({
  name: 'paperflow_bates_numbering_operations_total',
  help: 'Total number of Bates numbering operations',
  labelNames: ['operation', 'status'],
});

const webhookDeliveries = new Counter({
  name: 'paperflow_webhook_deliveries_total',
  help: 'Total number of webhook deliveries',
  labelNames: ['event', 'status_code', 'attempt'],
});

const auditLogEntries = new Counter({
  name: 'paperflow_audit_log_entries_total',
  help: 'Total number of audit log entries',
  labelNames: ['action', 'actor'],
});

const documentsStorageSize = new Gauge({
  name: 'paperflow_documents_storage_bytes',
  help: 'Total storage size of documents in bytes',
  labelNames: ['user_plan'],
});

const apiKeyUsage = new Counter({
  name: 'paperflow_api_key_usage_total',
  help: 'Total API key usage by endpoint',
  labelNames: ['endpoint', 'user_plan'],
});

const ocrOperations = new Counter({
  name: 'paperflow_ocr_operations_total',
  help: 'Total number of OCR operations',
  labelNames: ['confidence_level', 'language'],
});

const embeddingOperations = new Counter({
  name: 'paperflow_embedding_operations_total',
  help: 'Total number of embedding operations',
  labelNames: ['model', 'chunk_size'],
});

// Exportar métricas para uso em outros módulos
export const metrics = {
  httpRequestDuration,
  httpRequestsTotal,
  documentsProcessedTotal,
  pipelineStageDuration,
  activeSSEConnections,
  piiEntitiesDetected,
  batesNumberingOperations,
  webhookDeliveries,
  auditLogEntries,
  documentsStorageSize,
  apiKeyUsage,
  ocrOperations,
  embeddingOperations,
};

// Plugin do Fastify para métricas
const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  if (!env.ENABLE_METRICS) {
    fastify.log.info('Metrics disabled via ENABLE_METRICS=false');
    return;
  }

  // Hook para medir duração das requisições
  fastify.addHook('onRequest', async (request, reply) => {
    (reply as any).startTime = process.hrtime();
  });
  
  fastify.addHook('onResponse', async (request, reply) => {
    const diff = process.hrtime((reply as any).startTime);
    const duration = diff[0] + diff[1] * 1e-9; // Converter para segundos
    
    const route = request.routerPath || request.url.split('?')[0];
    const method = request.method;
    const statusCode = reply.statusCode.toString();
    
    // Incrementar contador de requests
    httpRequestsTotal.labels(method, route, statusCode).inc();
    
    // Observar duração
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
  });
  
  // Endpoint de métricas para Prometheus
  fastify.get('/v1/metrics', {
    schema: {
      description: 'Prometheus metrics endpoint',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'string',
          description: 'Prometheus metrics in text format',
        },
      },
    },
  }, async (request, reply) => {
    reply.type('text/plain; version=0.0.4; charset=utf-8');
    return register.metrics();
  });
  
  // Endpoint de health check com métricas básicas
  fastify.get('/v1/metrics/health', {
    schema: {
      description: 'Health check with basic metrics',
      tags: ['Monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            metrics: {
              type: 'object',
              properties: {
                documentsProcessed: { type: 'number' },
                activeConnections: { type: 'number' },
                piiEntitiesDetected: { type: 'number' },
                webhookDeliveries: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async () => {
    // Obter valores atuais das métricas
    const metricsRegistry = await register.getMetricsAsJSON();
    
    const getMetricValue = (name: string, defaultValue = 0) => {
      const metric = metricsRegistry.find(m => m.name === name);
      if (!metric) return defaultValue;
      
      if (metric.type === 'counter') {
        return (metric as any).values.reduce((sum: number, v: any) => sum + v.value, 0);
      } else if (metric.type === 'gauge') {
        return (metric as any).values[0]?.value || defaultValue;
      }
      
      return defaultValue;
    };
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        documentsProcessed: getMetricValue('paperflow_documents_processed_total'),
        activeConnections: getMetricValue('paperflow_sse_connections_active'),
        piiEntitiesDetected: getMetricValue('paperflow_pii_entities_detected_total'),
        webhookDeliveries: getMetricValue('paperflow_webhook_deliveries_total'),
      },
    };
  });
  
  // Endpoint para reset de métricas (apenas em desenvolvimento)
  if (env.NODE_ENV === 'development') {
    fastify.post('/v1/metrics/reset', {
      schema: {
        description: 'Reset all metrics (development only)',
        tags: ['Monitoring'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    }, async () => {
      register.clear();
      return {
        status: 'success',
        message: 'All metrics have been reset',
      };
    });
  }
  
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Clearing metrics registry...');
    register.clear();
  });
};

// Funções auxiliares para uso em outros serviços
export const metricsHelpers = {
  /**
   * Incrementa contador de documentos processados
   */
  incrementDocumentsProcessed: (status: 'completed' | 'failed', userPlan: string = 'unknown') => {
    documentsProcessedTotal.labels(status, userPlan).inc();
  },
  
  /**
   * Observa duração de estágio do pipeline
   */
  observePipelineStageDuration: (stage: string, durationSeconds: number, documentType: string = 'pdf') => {
    pipelineStageDuration.labels(stage, documentType).observe(durationSeconds);
  },
  
  /**
   * Incrementa/decrementa conexões SSE ativas
   */
  setActiveSSEConnections: (count: number) => {
    activeSSEConnections.set(count);
  },
  
  /**
   * Incrementa entidades PII detectadas
   */
  incrementPIIDetected: (type: string, confidenceLevel: string) => {
    piiEntitiesDetected.labels(type, confidenceLevel).inc();
  },
  
  /**
   * Incrementa operações de Bates numbering
   */
  incrementBatesOperation: (operation: 'applied' | 'removed', status: 'success' | 'failed') => {
    batesNumberingOperations.labels(operation, status).inc();
  },
  
  /**
   * Incrementa entregas de webhook
   */
  incrementWebhookDelivery: (event: string, statusCode: string, attempt: number) => {
    webhookDeliveries.labels(event, statusCode, attempt.toString()).inc();
  },
  
  /**
   * Incrementa entradas do audit log
   */
  incrementAuditLogEntry: (action: string, actor: string) => {
    auditLogEntries.labels(action, actor).inc();
  },
  
  /**
   * Atualiza tamanho do storage de documentos
   */
  setDocumentsStorageSize: (sizeBytes: number, userPlan: string = 'unknown') => {
    documentsStorageSize.labels(userPlan).set(sizeBytes);
  },
  
  /**
   * Incrementa uso de API key
   */
  incrementAPIKeyUsage: (endpoint: string, userPlan: string = 'unknown') => {
    apiKeyUsage.labels(endpoint, userPlan).inc();
  },
  
  /**
   * Incrementa operações de OCR
   */
  incrementOCROperation: (confidenceLevel: string, language: string = 'unknown') => {
    ocrOperations.labels(confidenceLevel, language).inc();
  },
  
  /**
   * Incrementa operações de embedding
   */
  incrementEmbeddingOperation: (model: string, chunkSize: string) => {
    embeddingOperations.labels(model, chunkSize).inc();
  },
};

export default metricsPlugin;