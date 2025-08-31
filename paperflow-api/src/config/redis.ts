import { createClient } from 'redis';
import { env } from './env';
import { mockRedis } from './mock-redis';

export const redis = env.NODE_ENV === 'development' ? mockRedis : createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

export async function initRedis() {
  try {
    if (env.NODE_ENV === 'development') {
      await redis.connect();
      console.log('✅ Mock Redis connected successfully');
    } else {
      await redis.connect();
      await redis.ping();
      console.log('✅ Redis connected successfully');
    }
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export async function closeRedisConnections() {
  await redis.quit();
}