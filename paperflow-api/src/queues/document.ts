import { env } from '@/config/env';
import { createQueue, createRedisClient } from '@/config/mock-redis';

const redis = createRedisClient(env.REDIS_URL);

export const documentQueue = createQueue('document-processing', {
  connection: redis as any,
});
