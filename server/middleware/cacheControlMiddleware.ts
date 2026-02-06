import { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware for different endpoint categories
 * Sets appropriate Cache-Control headers based on the API endpoint and response type
 */

export interface CacheConfig {
  maxAge: number; // in seconds
  sMaxAge?: number; // shared cache max age (CDN/proxy cache)
  public?: boolean;
  private?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
}

// Configuration for different endpoint categories
const cacheConfigs: Record<string, CacheConfig> = {
  // Reference data - rarely changes, safe to cache for longer periods
  referenceData: {
    maxAge: 3600, // 1 hour
    sMaxAge: 86400, // 24 hours for CDN
    public: true,
    immutable: true,
  },
  
  // Geographic data - static, can be cached indefinitely
  geographicData: {
    maxAge: 86400, // 24 hours
    sMaxAge: 604800, // 7 days for CDN
    public: true,
    immutable: true,
  },
  
  // User-specific data - cache in browser but not CDN
  userSpecific: {
    maxAge: 300, // 5 minutes
    private: true,
    mustRevalidate: true,
  },
  
  // Frequently changing data - minimal caching
  volatile: {
    maxAge: 60, // 1 minute
    private: true,
    mustRevalidate: true,
  },
  
  // No caching - always fresh
  noCache: {
    maxAge: 0,
    mustRevalidate: true,
  },
};

/**
 * Build Cache-Control header value from config
 */
function buildCacheControlHeader(config: CacheConfig): string {
  const parts: string[] = [];
  
  if (config.public) {
    parts.push('public');
  } else if (config.private) {
    parts.push('private');
  }
  
  parts.push(`max-age=${config.maxAge}`);
  
  if (config.sMaxAge !== undefined) {
    parts.push(`s-maxage=${config.sMaxAge}`);
  }
  
  if (config.mustRevalidate) {
    parts.push('must-revalidate');
  }
  
  if (config.proxyRevalidate) {
    parts.push('proxy-revalidate');
  }
  
  if (config.immutable) {
    parts.push('immutable');
  }
  
  return parts.join(', ');
}

/**
 * Middleware to apply cache-control based on the request path
 */
export function cacheControlMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  let config: CacheConfig | null = null;
  
  // Reference data endpoints
  if (path.includes('/units') || 
      path.includes('/event-types') || 
      path.includes('/expenditure-types') ||
      path.includes('/kallikratis')) {
    config = cacheConfigs.referenceData;
  }
  
  // Geographic data endpoints
  else if (path.includes('/geographic') || 
           path.includes('/regions') || 
           path.includes('/municipalities') ||
           path.includes('/geo-')) {
    config = cacheConfigs.geographicData;
  }
  
  // User-specific data (beneficiaries, projects for user's units)
  else if (path.includes('/beneficiaries') || 
           path.includes('/projects') ||
           path.includes('/employees')) {
    config = cacheConfigs.userSpecific;
  }
  
  // Volatile data (budget, documents, real-time updates)
  else if (path.includes('/budget') || 
           path.includes('/documents') ||
           path.includes('/dashboard')) {
    config = cacheConfigs.volatile;
  }
  
  if (config) {
    const cacheHeader = buildCacheControlHeader(config);
    res.setHeader('Cache-Control', cacheHeader);
    
    // Add Vary header for endpoints that might vary by authentication
    if (config.private) {
      res.setHeader('Vary', 'Authorization, Cookie');
    }
  }
  
  next();
}

/**
 * Set cache control for a specific response
 * Useful when you need to override the default middleware behavior
 */
export function setCacheControl(res: Response, type: keyof typeof cacheConfigs | CacheConfig) {
  let config: CacheConfig;
  
  if (typeof type === 'string') {
    config = cacheConfigs[type] || cacheConfigs.noCache;
  } else {
    config = type;
  }
  
  const cacheHeader = buildCacheControlHeader(config);
  res.setHeader('Cache-Control', cacheHeader);
  
  if (config.private) {
    res.setHeader('Vary', 'Authorization, Cookie');
  }
}

/**
 * Force no caching for specific response
 */
export function noCache(res: Response) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default cacheControlMiddleware;
