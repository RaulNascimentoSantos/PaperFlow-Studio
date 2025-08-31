import { FastifyRequest, FastifyReply } from 'fastify';
import { createError } from '@/utils/errors';
import { redis } from '@/config/redis';
import { env } from '@/config/env';

export function ipRateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return async (request: FastifyRequest): Promise<void> => {
    const clientIP = getClientIP(request);
    const key = `rate_limit:ip:${clientIP}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        const resetTime = new Date(Date.now() + ttl * 1000);

        throw createError.rateLimitExceeded(resetTime);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('RATE_LIMIT_EXCEEDED')) {
        throw error;
      }
      request.log.warn('Rate limiting unavailable - Redis error:', error);
    }
  };
}

export async function securityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });

  if (env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function getClientIP(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (forwarded) {
    return Array.isArray(forwarded)
      ? forwarded[0].split(',')[0].trim()
      : forwarded.split(',')[0].trim();
  }

  return (
    (request.headers['x-real-ip'] as string) ||
    request.ip ||
    (request.socket ? request.socket.remoteAddress : undefined) ||
    'unknown'
  );
}

export function corsConfig() {
  return {
    origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
      if (env.NODE_ENV === 'development') {
        // Allow all origins in development, including localhost:5173
        return callback(null, true);
      }

      const allowedOrigins = [
        'https://paperflow.app',
        'https://www.paperflow.app',
        'https://app.paperflow.io',
        'http://localhost:5173', // Frontend dev server
        'http://localhost:3000', // Alternative frontend
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-api-key',
    ],
  };
}

export function apiVersioning(supportedVersions: string[] = ['v1']) {
  return async (request: FastifyRequest): Promise<void> => {
    const version = request.headers['x-api-version'] || 'v1';

    if (!supportedVersions.includes(version as string)) {
      throw createError.validation(
        `API version '${version}' not supported. Supported versions: ${supportedVersions.join(', ')}`
      );
    }

    (request as any).apiVersion = version;
  };
}

export function requestSizeLimit(maxSizeBytes: number) {
  return async (request: FastifyRequest): Promise<void> => {
    const contentLength = request.headers['content-length'];

    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > maxSizeBytes) {
        throw createError.validation(
          `Request size (${Math.round(size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(
            maxSizeBytes / 1024 / 1024
          )}MB)`
        );
      }
    }
  };
}
