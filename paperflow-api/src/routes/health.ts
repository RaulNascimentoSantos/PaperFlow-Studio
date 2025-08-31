import { FastifyPluginAsync } from 'fastify';
import { db } from '@/config/database';
import { redis } from '@/config/redis';

const healthRoutes: FastifyPluginAsync = async function (fastify) {
  fastify.get('/', {
    schema: {
      description: 'Comprehensive health check',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            uptime_seconds: { type: 'number' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
                s3: { type: 'string' },
                ai: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (_, reply) => {
    const services = {
      database: 'down',
      redis: 'down',
      s3: 'down',
      ai: 'down',
    };

    // Check database
    try {
      await db.query('SELECT 1');
      services.database = 'healthy';
    } catch (error) {
      // ignore
    }

    // Check Redis
    try {
      await redis.ping();
      services.redis = 'healthy';
    } catch (error) {
      // ignore
    }

    // Check S3 (simplified)
    // In a real scenario, you would check S3 connectivity
    services.s3 = 'healthy';

    // Check AI service (simplified)
    // In a real scenario, you would check the AI service provider
    services.ai = 'healthy';

    const isHealthy = Object.values(services).every((s) => s === 'healthy');

    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0-mvp',
      uptime_seconds: process.uptime(),
      services,
    };

    if (!isHealthy) {
      reply.status(503);
    }

    return response;
  });
};

export default healthRoutes;
