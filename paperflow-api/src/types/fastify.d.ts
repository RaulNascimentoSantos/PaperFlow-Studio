import { TenantContext } from './tenant';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext;
  }
}