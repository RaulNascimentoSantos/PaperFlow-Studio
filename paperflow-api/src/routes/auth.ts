import { FastifyPluginAsync } from 'fastify';
import { AuthService } from '@/services/auth';
import { authenticate } from '@/middleware/auth';
import { createError } from '@/utils/errors';

const authRoutes: FastifyPluginAsync = async function (fastify) {
  fastify.post('/register', {
    schema: {
      description: 'Create a new user and get an API key',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'company', 'plan'],
        properties: {
          email: { type: 'string', format: 'email' },
          company: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'pro', 'team', 'enterprise'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            api_key: { type: 'string' },
            api_secret: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email, company, plan } = request.body as {
      email: string;
      company: string;
      plan: string;
    };

    try {
      const { apiKey, apiSecret } = await AuthService.registerUser({
        email,
        company,
        plan,
      });
      reply.status(201);
      return { api_key: apiKey, api_secret: apiSecret };
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw createError.duplicate('User with this email already exists');
      }
      throw error;
    }
  });

  fastify.post('/rotate-key', {
    preHandler: [authenticate],
    schema: {
      description: 'Rotate API key',
      tags: ['Auth'],
      security: [{ ApiKeyAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            new_key: { type: 'string' },
            expires_old: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (request) => {
    const user = request.user!;
    const { newApiKey, oldKeyExpiration } = await AuthService.rotateApiKey(user.id);
    return {
      new_key: newApiKey,
      expires_old: oldKeyExpiration.toISOString(),
    };
  });
};

export default authRoutes;
