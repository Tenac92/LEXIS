import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger';

const logger = createLogger('Redis');

let redisClient: RedisClientType | null = null;
let isConnecting = false;

/**
 * Initialize Redis connection
 * Falls back gracefully if Redis is unavailable
 */
export async function initializeRedis(): Promise<boolean> {
  if (redisClient) {
    logger.info('Redis client already initialized');
    return true;
  }

  if (isConnecting) {
    logger.info('Redis connection already in progress');
    return true;
  }

  isConnecting = true;

  try {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('REDIS_URL not set, Redis caching will be disabled');
      isConnecting = false;
      return false;
    }

    redisClient = createClient({
      url: redisUrl,
      socket: {
        noDelay: true,
      },
    });

    // Set up event listeners
    redisClient.on('error', (error: Error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Attempt connection
    await redisClient.connect();
    logger.info('Redis initialized successfully');
    isConnecting = false;
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error instanceof Error ? error.message : String(error));
    redisClient = null;
    isConnecting = false;
    return false;
  }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isOpen;
}

/**
 * Get a value from Redis cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redisClient || !redisClient.isOpen) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(value) as T;
    }
    logger.debug(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logger.error(`Error getting cache for ${key}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Set a value in Redis cache with optional TTL
 */
export async function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    
    if (ttlSeconds) {
      await redisClient.setEx(key, ttlSeconds, serialized);
      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    } else {
      await redisClient.set(key, serialized);
      logger.debug(`Cache SET: ${key}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error setting cache for ${key}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Delete a value from Redis cache
 */
export async function deleteCached(key: string): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    const result = await redisClient.del(key);
    logger.debug(`Cache DELETE: ${key} (${result} keys deleted)`);
    return result > 0;
  } catch (error) {
    logger.error(`Error deleting cache for ${key}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  if (!redisClient || !redisClient.isOpen) {
    return 0;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    
    const deleted = await redisClient.del(keys);
    logger.debug(`Cache INVALIDATE PATTERN: ${pattern} (${deleted} keys deleted)`);
    return deleted;
  } catch (error) {
    logger.error(`Error invalidating cache pattern ${pattern}:`, error instanceof Error ? error.message : String(error));
    return 0;
  }
}

/**
 * Clear entire cache (use with caution)
 */
export async function clearCache(): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    await redisClient.flushDb();
    logger.info('Cache cleared');
    return true;
  } catch (error) {
    logger.error('Error clearing cache:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (!redisClient || !redisClient.isOpen) {
    return null;
  }

  try {
    const info = await redisClient.info();
    return {
      available: true,
      info: info,
    };
  } catch (error) {
    logger.error('Error getting cache stats:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export default {
  initializeRedis,
  getRedisClient,
  isRedisAvailable,
  getCached,
  setCached,
  deleteCached,
  invalidateCachePattern,
  clearCache,
  getCacheStats,
};
