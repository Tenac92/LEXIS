import { Request, Response, NextFunction } from 'express';

/**
 * Custom CORS middleware to handle connections with external domains
 * especially for sdegdaefk.gr and its subdomains
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the request origin
  const origin = req.headers.origin;
  
  // List of allowed origins for sdegdaefk.gr (both http and https)
  const allowedOrigins = [
    'https://sdegdaefk.gr', 
    'http://sdegdaefk.gr',
    'https://www.sdegdaefk.gr', 
    'http://www.sdegdaefk.gr'
  ];
  
  // Add Replit domains to allowed origins in development
  if (process.env.NODE_ENV !== 'production') {
    // Allow the application's own domain
    if (origin && (
      origin.includes('replit.dev') || 
      origin.includes('replit.app') ||
      origin.includes('repl.co')
    )) {
      allowedOrigins.push(origin);
    }
  }
  
  // Check if the origin is sdegdaefk.gr, a subdomain, or an allowed Replit domain
  const isAllowedDomain = origin && (
    allowedOrigins.includes(origin) || 
    origin.endsWith('.sdegdaefk.gr')
  );
  
  // Special handling for sdegdaefk.gr domain and subdomains
  if (origin && isAllowedDomain) {
    // Log detailed information in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CORS] Request from allowed origin: ${origin}`);
      console.log(`[CORS] Headers: ${JSON.stringify(req.headers)}`);
      console.log(`[CORS] Method: ${req.method}, Path: ${req.path}`);
    }
    
    // Allow the specific origin that made the request
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
  } else if (origin && process.env.NODE_ENV !== 'production') {
    // Log blocked origins in non-production environments
    console.log(`[CORS] Blocked request from unauthorized origin: ${origin}`);
  }

  // Handle preflight (OPTIONS) requests immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end(); // No content response for OPTIONS
    return;
  }

  next();
}

export default corsMiddleware;