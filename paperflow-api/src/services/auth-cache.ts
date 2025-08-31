import { env } from '@/config/env';
import { User } from '@/types';
import { createRedisClient } from '@/config/mock-redis';

class AuthCacheService {
  private redis = createRedisClient(env.REDIS_URL);
  private connected = false;

  async connect() {
    if (!this.connected) {
      await this.redis.connect();
      this.connected = true;
    }
  }

  private getUserCacheKey(apiKey: string): string {
    // Use a hash of the API key for cache key (don't store actual key)
    const crypto = require('crypto');
    return `auth:${crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16)}`;
  }

  async getCachedUser(apiKey: string): Promise<User | null> {
    try {
      await this.connect();
      const cacheKey = this.getUserCacheKey(apiKey);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async setCachedUser(apiKey: string, user: User, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.connect();
      const cacheKey = this.getUserCacheKey(apiKey);
      
      // Cache user data without sensitive information
      const cacheData = {
        id: user.id,
        email: user.email,
        company: user.company,
        plan: user.plan,
        credits_remaining: user.credits_remaining,
        last_active: user.last_active,
        metadata: user.metadata,
      };
      
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw - caching is optional
    }
  }

  async invalidateUser(apiKey: string): Promise<void> {
    try {
      await this.connect();
      const cacheKey = this.getUserCacheKey(apiKey);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async invalidateAllUserCache(userId: string): Promise<void> {
    try {
      await this.connect();
      // This is more complex - would need to track user-to-cache mappings
      // For now, we'll use a simple expiration strategy
      console.log(`TODO: Invalidate all cache entries for user ${userId}`);
    } catch (error) {
      console.error('Cache bulk invalidation error:', error);
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.redis.disconnect();
      this.connected = false;
    }
  }

  // Rate limiting helpers
  async checkRateLimit(
    identifier: string, 
    windowMs: number, 
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      await this.connect();
      const key = `rate_limit:${identifier}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      
      const ttl = await this.redis.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetTime,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request (fail open)
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
    }
  }
}

export const authCache = new AuthCacheService();