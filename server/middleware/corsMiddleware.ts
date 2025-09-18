import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

/**
 * Custom CORS middleware to handle connections with external domains
 * especially for sdegdaefk.gr and its subdomains
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the request information
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // List of allowed origins for sdegdaefk.gr (both http and https)
  const allowedOrigins = [
    'https://sdegdaefk.gr', 
    'http://sdegdaefk.gr',
    'https://www.sdegdaefk.gr', 
    'http://www.sdegdaefk.gr'
  ];
  
  // Add Replit domains and local development to allowed origins in development
  if (process.env.NODE_ENV !== 'production') {
    // Allow local development
    allowedOrigins.push('http://127.0.0.1:5000');
    allowedOrigins.push('http://localhost:5000');
    
    // Allow the application's own domain
    if (origin && (
      origin.includes('replit.dev') || 
      origin.includes('replit.app') ||
      origin.includes('repl.co')
    )) {
      allowedOrigins.push(origin);
    }
  }
  
  // Enhanced detection of sdegdaefk.gr requests
  const isSdegdaefkRequest = 
    (origin && (allowedOrigins.includes(origin) || origin.endsWith('.sdegdaefk.gr'))) ||
    (referer && referer.includes('sdegdaefk.gr')) ||
    (host && host.includes('sdegdaefk.gr'));
  
  // Check if the origin is sdegdaefk.gr, a subdomain, or an allowed Replit domain
  const isAllowedDomain = origin && (
    allowedOrigins.includes(origin) || 
    origin.endsWith('.sdegdaefk.gr') ||
    (process.env.NODE_ENV !== 'production' && (
      origin.includes('replit.dev') || 
      origin.includes('replit.app') ||
      origin.includes('repl.co') ||
      origin.includes('127.0.0.1') ||
      origin.includes('localhost')
    ))
  );
  
  // Special handling for sdegdaefk.gr domain and subdomains
  if (isAllowedDomain) {
    // Log detailed information for debugging (headers removed for security)
    log(`[CORS] Request from allowed origin: ${origin}`, 'cors');
    log(`[CORS] Method: ${req.method}, Path: ${req.path}`, 'cors');
    
    // Allow the specific origin that made the request
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    // Allow common methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    
    // Allow common headers - expand for wider compatibility
    res.setHeader('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Referrer, ' +
      'X-API-Key, Cache-Control, Pragma, Set-Cookie, Cookie, withcredentials');
    
    // Always allow credentials (cookies, auth headers)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Cache preflight requests for 24 hours
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Expose headers the client might need - add Set-Cookie for auth
    res.setHeader('Access-Control-Expose-Headers',
      'Content-Length, Content-Type, X-Requested-With, Set-Cookie, ETag, Date');
    
    // Check if this is an authentication route
    if (req.path.includes('/api/auth')) {
      log(`[CORS] Processing authentication route: ${req.path} from origin: ${origin}`, 'cors-auth');
    }
  } else if (isSdegdaefkRequest) {
    // Special handling for sdegdaefk.gr requests without valid origin
    // This handles cases where origin is missing but other headers indicate sdegdaefk.gr
    log(`[CORS] Processing sdegdaefk.gr request without valid origin:`, 'cors');
    log(`[CORS] Referer: ${referer}, Host: ${host}`, 'cors');
    
    // Set default origin for sdegdaefk.gr
    res.setHeader('Access-Control-Allow-Origin', 'https://sdegdaefk.gr');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-Requested-With, Set-Cookie');
    
    log(`[CORS] Applied fallback CORS headers for sdegdaefk.gr request`, 'cors');
  } else if (origin) {
    // Log blocked origins for debugging
    log(`[CORS] Blocked request from unauthorized origin: ${origin}`, 'cors-blocked');
  }

  // Handle preflight (OPTIONS) requests immediately
  if (req.method === 'OPTIONS') {
    // Special handling for sdegdaefk.gr preflight requests
    if (isSdegdaefkRequest) {
      log(`[CORS] Processing sdegdaefk.gr preflight request`, 'cors');
      // Ensure all necessary headers are set for cross-domain cookies to work
      if (!res.getHeader('Access-Control-Allow-Credentials')) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      if (!res.getHeader('Access-Control-Allow-Origin') && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (!res.getHeader('Access-Control-Allow-Origin')) {
        res.setHeader('Access-Control-Allow-Origin', 'https://sdegdaefk.gr');
      }
    }
    
    res.status(204).end(); // No content response for OPTIONS
    return;
  }

  next();
}

export default corsMiddleware;