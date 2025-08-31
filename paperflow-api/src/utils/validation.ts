import { z } from 'zod';
import { FastifyRequest } from 'fastify';
import { createError } from './errors';

export function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  source: 'body' | 'params' | 'query' | 'headers' = 'body'
) {
  return async (request: FastifyRequest) => {
    try {
      const data = source === 'body' ? request.body :
                  source === 'params' ? request.params :
                  source === 'query' ? request.query :
                  request.headers;

      const validated = schema.parse(data);
      
      (request as any)[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw createError.validation(
          'Validation failed',
        );
      }
      throw error;
    }
  };
}
