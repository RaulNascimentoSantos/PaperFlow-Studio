import { FastifyRequest } from 'fastify';
import { AuthService } from '@/services/auth';
import { createError } from '@/utils/errors';
import { User } from '@/types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

export async function authenticate(
  request: FastifyRequest
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    throw createError.unauthorized('Missing API key');
  }

  const user = await AuthService.validateApiKey(apiKey);

  if (!user) {
    throw createError.unauthorized('Invalid API key');
  }

  request.user = user;
}
