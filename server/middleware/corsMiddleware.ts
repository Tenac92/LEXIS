import { Request, Response, NextFunction } from 'express';

/**
 * Custom CORS middleware to handle connections with external domains
 * especially for sdegdaefk.gr
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the request origin
  const origin = req.headers.origin;
  
  // Special handling for sdegdaefk.gr
  if (origin === 'https://sdegdaefk.gr') {
    // Allow the specific origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    // Allow common methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    
    // Allow common headers
    res.setHeader('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Referrer, X-API-Key, Cache-Control, Pragma, withcredentials');
    
    // Allow credentials (cookies, auth headers)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Cache preflight requests for 24 hours (1440 minutes)
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Expose headers the client might need
    res.setHeader('Access-Control-Expose-Headers',
      'Content-Length, Content-Type, X-Requested-With');
  }

  // Handle preflight (OPTIONS) requests immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end(); // No content response for OPTIONS
    return;
  }
  
  // Log CORS-related requests in development
  if (process.env.NODE_ENV !== 'production' && origin === 'https://sdegdaefk.gr') {
    console.log(`[CORS] Request from ${origin} to ${req.method} ${req.path}`);
  }

  next();
}

export default corsMiddleware;