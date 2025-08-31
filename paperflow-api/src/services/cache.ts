import { EventEmitter } from 'events';
import logger from '../config/logger';

// In-memory cache for development/small deployments
class InMemoryCache extends EventEmitter {
  private cache: Map<string, { value: any; expiry: number; size: number }> = new Map();
  private totalSize = 0;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 100 * 1024 * 1024) { // 100MB default
    super();
    this.maxSize = maxSize;
    
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key: string, value: any, ttlSeconds: number = 3600): boolean {
    try {
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');
      const expiry = Date.now() + (ttlSeconds * 1000);

      // Check if we have space
      if (this.totalSize + size > this.maxSize) {
        this.evictLRU(size);
      }

      // Remove existing entry if it exists
      if (this.cache.has(key)) {
        const existing = this.cache.get(key)!;
        this.totalSize -= existing.size;
      }

      this.cache.set(key, { value: serialized, expiry, size });
      this.totalSize += size;

      this.emit('set', key, size);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.emit('miss', key);
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.delete(key);
      this.emit('expired', key);
      return null;
    }

    try {
      const value = JSON.parse(entry.value);
      this.emit('hit', key);
      return value;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      this.delete(key);
      return null;
    }
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
      this.emit('delete', key);
      return true;
    }
    return false;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
    this.emit('clear');
  }

  private evictLRU(neededSize: number): void {
    // Simple eviction: remove oldest entries until we have space
    const entries = Array.from(this.cache.entries());
    
    for (const [key] of entries) {
      this.delete(key);
      if (this.totalSize + neededSize <= this.maxSize) {
        break;
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  getStats(): {
    size: number;
    maxSize: number;
    entries: number;
    hitRate?: number;
  } {
    return {
      size: this.totalSize,
      maxSize: this.maxSize,
      entries: this.cache.size
    };
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Redis cache implementation for production
class RedisCache extends EventEmitter {
  private client: any = null;
  private connected = false;

  constructor() {
    super();
    this.setupMockRedis();
  }

  private setupMockRedis(): void {
    // Mock Redis client for development
    this.client = {
      set: async (key: string, value: string, ex?: number) => {
        logger.debug(`🧪 Mock Redis SET: ${key} (TTL: ${ex}s)`);
        return 'OK';
      },
      get: async (key: string) => {
        logger.debug(`🧪 Mock Redis GET: ${key}`);
        return null; // Always return null for mock
      },
      del: async (key: string) => {
        logger.debug(`🧪 Mock Redis DEL: ${key}`);
        return 1;
      },
      exists: async (key: string) => {
        logger.debug(`🧪 Mock Redis EXISTS: ${key}`);
        return 0;
      },
      flushall: async () => {
        logger.debug(`🧪 Mock Redis FLUSHALL`);
        return 'OK';
      }
    };
    this.connected = true;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, 'EX', ttlSeconds);
      this.emit('set', key);
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error });
      return false;
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected) {
      this.emit('miss', key);
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        this.emit('miss', key);
        return null;
      }

      this.emit('hit', key);
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis get error', { key, error });
      this.emit('miss', key);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.del(key);
      this.emit('delete', key);
      return result > 0;
    } catch (error) {
      logger.error('Redis delete error', { key, error });
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis exists error', { key, error });
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.flushall();
      this.emit('clear');
    } catch (error) {
      logger.error('Redis clear error', error);
    }
  }

  getStats(): any {
    return {
      type: 'redis',
      connected: this.connected,
      mock: true
    };
  }

  shutdown(): void {
    if (this.client && this.client.quit) {
      this.client.quit();
    }
  }
}

export interface CacheInterface {
  set(key: string, value: any, ttlSeconds?: number): Promise<boolean> | boolean;
  get(key: string): Promise<any | null> | any | null;
  delete(key: string): Promise<boolean> | boolean;
  has(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
  getStats(): any;
  shutdown(): void;
  on(event: string, listener: (...args: any[]) => void): this;
}

// Cache factory
export class CacheService {
  private cache: CacheInterface;
  private hitCount = 0;
  private missCount = 0;

  constructor(useRedis = false) {
    this.cache = useRedis ? new RedisCache() : new InMemoryCache();
    
    // Track hit/miss rates
    this.cache.on('hit', () => this.hitCount++);
    this.cache.on('miss', () => this.missCount++);
    
    logger.info(`Cache service initialized with ${useRedis ? 'Redis' : 'InMemory'} backend`);
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    const result = await this.cache.set(key, value, ttlSeconds);
    logger.debug('Cache set', { key, ttl: ttlSeconds, success: result });
    return result;
  }

  async get(key: string): Promise<any | null> {
    const value = await this.cache.get(key);
    logger.debug('Cache get', { key, found: value !== null });
    return value;
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.cache.delete(key);
    logger.debug('Cache delete', { key, success: result });
    return result;
  }

  async has(key: string): Promise<boolean> {
    return await this.cache.has(key);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cache cleared');
  }

  // Cache with automatic key generation for query results
  async cached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached as T;
    }

    // Fetch fresh data
    const freshData = await fetchFn();
    
    // Cache the result
    await this.set(key, freshData, ttlSeconds);
    
    return freshData;
  }

  // Invalidate cache by pattern (simple prefix matching for in-memory)
  async invalidatePattern(pattern: string): Promise<number> {
    if (this.cache instanceof InMemoryCache) {
      const keys = Array.from((this.cache as any).cache.keys())
        .filter((key: string) => key.startsWith(pattern.replace('*', '')));
      
      for (const key of keys) {
        await this.delete(key);
      }
      
      logger.debug(`Invalidated ${keys.length} cache entries with pattern ${pattern}`);
      return keys.length;
    }

    // For Redis, you would use SCAN and DEL
    logger.warn('Pattern invalidation not implemented for Redis mock');
    return 0;
  }

  getStats(): {
    backend: any;
    performance: {
      hitCount: number;
      missCount: number;
      hitRate: number;
      totalRequests: number;
    };
  } {
    const totalRequests = this.hitCount + this.missCount;
    return {
      backend: this.cache.getStats(),
      performance: {
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
        totalRequests
      }
    };
  }

  shutdown(): void {
    this.cache.shutdown();
    logger.info('Cache service shut down');
  }
}

// Global cache instance
export const cache = new CacheService(process.env.NODE_ENV === 'production');

// Cache key helpers
export class CacheKeys {
  static document(tenantId: string, documentId: string): string {
    return `doc:${tenantId}:${documentId}`;
  }

  static documentList(tenantId: string, page: number = 1, limit: number = 50): string {
    return `docs:${tenantId}:${page}:${limit}`;
  }

  static template(tenantId: string, templateId: string): string {
    return `tpl:${tenantId}:${templateId}`;
  }

  static templateList(tenantId: string): string {
    return `tpls:${tenantId}`;
  }

  static tenant(tenantId: string): string {
    return `tenant:${tenantId}`;
  }

  static healthScore(tenantId: string): string {
    return `health:${tenantId}`;
  }

  static metrics(tenantId: string, type: string, period: string): string {
    return `metrics:${tenantId}:${type}:${period}`;
  }

  static user(userId: string): string {
    return `user:${userId}`;
  }

  static billing(tenantId: string): string {
    return `billing:${tenantId}`;
  }

  static integration(tenantId: string, type: string): string {
    return `integration:${tenantId}:${type}`;
  }

  // Pattern helpers
  static allDocuments(tenantId: string): string {
    return `doc:${tenantId}:*`;
  }

  static allTemplates(tenantId: string): string {
    return `tpl:${tenantId}:*`;
  }

  static allMetrics(tenantId: string): string {
    return `metrics:${tenantId}:*`;
  }
}