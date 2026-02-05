import { createLogger } from '../utils/logger';
import { getCached, setCached, isRedisAvailable, getRedisClient, invalidateCachePattern } from '../config/redis';

const logger = createLogger('ReferenceDataCache');

// Fallback in-memory cache for when Redis is unavailable
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const fallbackCache = new Map<string, CacheEntry<any>>();
const FALLBACK_TTL = 10 * 60 * 1000; // 10 minutes
const REDIS_TTL = 3600; // 1 hour in seconds

/**
 * Cache reference data using Redis with in-memory fallback
 * Optimized for reference data that rarely changes
 */
export async function cacheReferenceData<T>(
  key: string,
  data: T,
  label?: string
): Promise<void> {
  const logLabel = label || key;

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const success = await setCached<T>(key, data, REDIS_TTL);
      if (success) {
        logger.info(`${logLabel}: Cached in Redis (TTL: ${REDIS_TTL}s)`);
        return;
      }
    } catch (error) {
      logger.warn(`${logLabel}: Failed to cache in Redis, using fallback`);
    }
  }

  // Fallback to in-memory cache
  fallbackCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  logger.info(`${logLabel}: Cached in memory (TTL: ${FALLBACK_TTL}ms)`);
}

/**
 * Retrieve reference data from cache with automatic fallback
 */
export async function getReferenceData<T>(
  key: string,
  label?: string
): Promise<T | null> {
  const logLabel = label || key;

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const cached = await getCached<T>(key);
      if (cached) {
        logger.debug(`${logLabel}: Retrieved from Redis`);
        return cached;
      }
    } catch (error) {
      logger.warn(`${logLabel}: Failed to retrieve from Redis, checking fallback`);
    }
  }

  // Check fallback cache
  const fallback = fallbackCache.get(key);
  if (fallback && Date.now() - fallback.timestamp < FALLBACK_TTL) {
    logger.debug(`${logLabel}: Retrieved from fallback cache`);
    return fallback.data as T;
  }

  if (fallback) {
    fallbackCache.delete(key);
    logger.debug(`${logLabel}: Fallback cache expired`);
  }

  logger.debug(`${logLabel}: Not in cache`);
  return null;
}

/**
 * Clear reference data cache
 */
export async function invalidateReferenceData(key: string): Promise<void> {
  // Remove from fallback cache
  fallbackCache.delete(key);

  // Try to remove from Redis if available
  if (isRedisAvailable()) {
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.del(key);
        logger.info(`Invalidated Redis cache: ${key}`);
      }
    } catch (error) {
      logger.warn(`Failed to invalidate Redis cache: ${key}`, error);
    }
  }

  logger.info(`Invalidated cache: ${key}`);
}

/**
 * Clear all reference data caches matching a pattern
 */
export async function invalidateReferenceDataPattern(pattern: string): Promise<void> {
  // Clear from fallback cache
  const keysToDelete: string[] = [];
  fallbackCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => fallbackCache.delete(key));

  // Clear from Redis if available
  if (isRedisAvailable()) {
    try {
      const deleted = await invalidateCachePattern(`*${pattern}*`);
      logger.info(`Invalidated Redis cache pattern: ${pattern} (${deleted} keys)`);
    } catch (error) {
      logger.warn(`Failed to invalidate Redis cache pattern: ${pattern}`, error);
    }
  }

  logger.info(`Invalidated cache pattern: ${pattern}`);
}

export default {
  cacheReferenceData,
  getReferenceData,
  invalidateReferenceData,
  invalidateReferenceDataPattern,
};
