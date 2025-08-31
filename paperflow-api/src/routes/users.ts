import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '@/middleware/auth';

const userRoutes: FastifyPluginAsync = async function (fastify) {
  fastify.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get current user profile',
        tags: ['Users'],
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              company: { type: 'string' },
              plan: { type: 'string' },
              credits_remaining: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      return request.user;
    }
  );
};

export default userRoutes;
