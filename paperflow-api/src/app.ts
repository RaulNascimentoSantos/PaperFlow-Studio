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

// Error handling
import { sanitizeError } from './utils/errors';

// Routes
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import aiRoutes from './routes/ai';
import webhooksRoutes from './routes/webhooks';
import userRoutes from './routes/users';
import usageRoutes from './routes/usage';

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

  // Global middleware
  app.addHook('onRequest', securityHeaders);
  app.addHook('onRequest', apiVersioning(['v1']));
  app.addHook('onRequest', ipRateLimit(env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW));
  app.addHook('onRequest', requestSizeLimit(env.MAX_FILE_SIZE_MB * 1024 * 1024));

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
    // All routes will be prefixed with /v1
    await app.register(healthRoutes, { prefix: '/v1/health' });
    await app.register(authRoutes, { prefix: '/v1/auth' });
    await app.register(documentRoutes, { prefix: '/v1/documents' });
    await app.register(aiRoutes, { prefix: '/v1/ai' });
    await app.register(webhooksRoutes, { prefix: '/v1/webhooks' });
    await app.register(userRoutes, { prefix: '/v1/users' });
    await app.register(usageRoutes, { prefix: '/v1/usage' });
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const sanitized = sanitizeError(error as any);
    
    // Log the error
    request.log.error({
      error: sanitized,
      req: {
        method: request.method,
        url: request.url,
        headers: request.headers,
      },
    }, 'Request error');

    // Send error response
    reply.status(sanitized.statusCode || 500).send({
      success: false,
      error: {
        code: sanitized.code,
        message: sanitized.message,
        ...(env.NODE_ENV !== 'production' && { stack: sanitized.stack }),
      },
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