import { FastifyPluginAsync } from 'fastify';

const webhookRoutes: FastifyPluginAsync = async function (fastify) {
  // Stripe webhook handler
  fastify.post('/stripe', {
    schema: {
      description: 'Stripe webhook handler',
      tags: ['Webhooks'],
    },
  }, async () => {
    return {
      success: true,
      message: 'Webhook received - implementation in progress'
    };
  });
};

export default webhookRoutes;
