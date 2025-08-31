import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
// import underPressure from '@fastify/under-pressure';

import { env } from './config/env';
import logger from './config/logger';
import { initDatabase } from './config/database';

// Middleware
import { 
  securityHeaders, 
  ipRateLimit, 
  corsConfig, 
  apiVersioning,
  requestSizeLimit 
} from './middleware/security';
import { createTenantMiddleware } from './middleware/tenant';

// Error handling
import { sanitizeError } from './utils/errors';

// Plugins
import metricsPlugin from './plugins/metrics';

// Routes
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import aiRoutes from './routes/ai';
import webhooksRoutes from './routes/webhooks';
import userRoutes from './routes/users';
import usageRoutes from './routes/usage';
import tenantRoutes from './routes/tenants';
import templatesRoutes from './routes/templates';
import billingRoutes from './routes/billing';
import integrationsRoutes from './routes/integrations';
import metricsRoutes from './routes/metrics';
import securityRoutes from './routes/security';

export async function createApp(): Promise<FastifyInstance> {
  // Initialize database first
  await initDatabase();
  
  // Create Fastify instance
  const app = Fastify({
    logger: logger as any,
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
    disableRequestLogging: false,
    maxParamLength: 500,
    bodyLimit: env.MAX_FILE_SIZE_MB * 1024 * 1024, // Convert MB to bytes
  });

  // Trust proxy disabled temporarily due to version mismatch
  // await app.register(underPressure, {
  //   maxEventLoopDelay: 1000,
  //   maxHeapUsedBytes: 1000000000, // 1GB
  //   maxRssBytes: 1000000000,
  // });

  // Register CORS
  await app.register(cors, corsConfig() as any);

  // Register security middleware
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1,
      fields: 10,
    },
    attachFieldsToBody: false,
  });

  // Register metrics plugin
  await app.register(metricsPlugin);

  // Register Swagger documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'PaperFlow API',
        description: 'Transform Documents into Data Intelligence',
        version: '1.0.0-mvp',
        contact: {
          name: 'PaperFlow Team',
          email: 'support@paperflow.app',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: env.NODE_ENV === 'production' 
            ? 'https://api.paperflow.app'
            : `http://${env.HOST}:${env.PORT}`,
          description: env.NODE_ENV === 'production' ? 'Production' : 'Development',
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'API Key authentication.',
          },
        },
      },
      security: [
        {
          ApiKeyAuth: [],
        },
      ],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // OpenAPI JSON endpoint for SDK generation
  app.get('/openapi.json', {
    schema: {
      hide: true,
    },
  }, async () => {
    return app.swagger();
  });

  // Security hooks for sanitizing sensitive data in logs
  // Only apply redaction in production to avoid breaking development
  if (env.NODE_ENV === 'production') {
    app.addHook('onRequest', async (req) => {
      if (req.headers['x-api-key']) {
        req.headers['x-api-key'] = '[REDACTED]';
      }
      if ((req.query as any)?.apiKey) {
        (req.query as any).apiKey = '[REDACTED]';
      }
    });
  }

  // Global middleware
  app.addHook('onRequest', securityHeaders);
  app.addHook('onRequest', apiVersioning(['v1']));
  app.addHook('onRequest', ipRateLimit(env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW));
  app.addHook('onRequest', requestSizeLimit(env.MAX_FILE_SIZE_MB * 1024 * 1024));
  
  // Tenant middleware (applied to tenant-scoped routes only)
  const { DatabaseService } = await import('./services/database');
  const db = new DatabaseService();
  const tenantMiddleware = createTenantMiddleware(db);

  // API root endpoint
  app.get('/', {
    schema: {
      description: 'API information',
      tags: ['Root'],
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            documentation: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    return {
      name: 'PaperFlow API',
      version: '1.0.0-mvp',
      description: 'Transform Documents into Data Intelligence',
      documentation: `${request.protocol}://${request.hostname}/docs`,
    };
  });

  // Register API routes with versioning
  app.register(async function(app) {
    // Public routes (no tenant context required)
    await app.register(healthRoutes, { prefix: '/v1/health' });
    await app.register(authRoutes, { prefix: '/v1/auth' });
    
    // Administrative routes (tenant management)
    await app.register(tenantRoutes, { prefix: '/v1/tenants' });
    
    // Tenant-scoped routes (require tenant context)
    app.register(async function(tenantApp) {
      // Apply tenant middleware to all routes in this context
      tenantApp.addHook('onRequest', tenantMiddleware);
      
      await tenantApp.register(documentRoutes, { prefix: '/v1/documents' });
      await tenantApp.register(templatesRoutes, { prefix: '/v1/templates' });
      await tenantApp.register(billingRoutes, { prefix: '/v1/billing' });
      await tenantApp.register(integrationsRoutes, { prefix: '/v1/integrations' });
      await tenantApp.register(aiRoutes, { prefix: '/v1/ai' });
      await tenantApp.register(webhooksRoutes, { prefix: '/v1/webhooks' });
      await tenantApp.register(userRoutes, { prefix: '/v1/users' });
      await tenantApp.register(usageRoutes, { prefix: '/v1/usage' });
      await tenantApp.register(metricsRoutes, { prefix: '/v1/metrics' });
      await tenantApp.register(securityRoutes, { prefix: '/v1/security' });
    });
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const traceId = crypto.randomUUID();
    const status = (error as any).statusCode || 500;
    const sanitized = sanitizeError(error as any);
    
    // Log the error with trace ID
    request.log.error({
      err: error,
      traceId,
      url: request.url,
      method: request.method,
      ip: request.ip,
    });
    
    // Send sanitized error response to client
    reply.status(status).send({
      error: {
        code: sanitized.code || 'INTERNAL_SERVER_ERROR',
        message: status < 500 ? sanitized.message : 'An unexpected error occurred',
        traceId,
        ...(env.NODE_ENV !== 'production' && { stack: sanitized.stack }),
      }
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
    });
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, closing server...`);
    
    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      app.log.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}