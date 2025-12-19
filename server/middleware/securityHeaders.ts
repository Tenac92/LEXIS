import helmet from 'helmet';
import {Request, Response, NextFunction} from 'express';
import { log } from '../vite';

/**
 * Main helmet security configuration
 * Relaxed to support cross-domain communication with sdegdaefk.gr
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      // Allow all content from sdegdaefk.gr domain and subdomains
      defaultSrc: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr",
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", 
        "https://unpkg.com",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://sdegdaefk.gr",
        "http://sdegdaefk.gr",
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ], 
      imgSrc: [
        "'self'", 
        "data:", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      connectSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://*.supabase.co",
        "https://sdegdaefk.gr",
        "http://sdegdaefk.gr",
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      fontSrc: [
        "'self'", 
        "https:", 
        "data:", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr",
        "https://fonts.gstatic.com"
      ],
      objectSrc: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      mediaSrc: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      frameSrc: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      formAction: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      frameAncestors: [
        "'self'", 
        "https://sdegdaefk.gr", 
        "http://sdegdaefk.gr", 
        "https://*.sdegdaefk.gr",
        "http://*.sdegdaefk.gr"
      ],
      baseUri: ["'self'"],
      // Don't automatically upgrade HTTP to HTTPS for sdegdaefk.gr to support both protocols
      upgradeInsecureRequests: null,
    }
  },
  // Disable cross-origin policies that might interfere with sdegdaefk.gr integration
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: false,
  frameguard: true,  // Protect against clickjacking; allow explicit framing via CSP above
  hidePoweredBy: true,
  // Keep HSTS for production security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  // Use more permissive referrer policy to support cross-domain links
  referrerPolicy: { policy: "no-referrer-when-downgrade" },
  xssFilter: true
});

/**
 * Additional security middleware with enhanced cross-domain support
 * This adds explicit CORS headers and frame permissions for sdegdaefk.gr domain
 */
export function additionalSecurity(req: Request, res: Response, next: NextFunction) {
  // Clear sensitive headers
  res.removeHeader('X-Powered-By');

  // Add basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Get the request information
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Allow frames from sdegdaefk.gr and its subdomains (both HTTP and HTTPS)
  const allowedOrigins = [
    'https://sdegdaefk.gr', 
    'http://sdegdaefk.gr',
    'https://www.sdegdaefk.gr', 
    'http://www.sdegdaefk.gr'
  ];
  
  // Add Replit domains to allowed origins in development
  if (process.env.NODE_ENV !== 'production' && origin) {
    // Allow the application's own domain
    if (origin.includes('replit.dev') || 
        origin.includes('replit.app') ||
        origin.includes('repl.co')) {
      allowedOrigins.push(origin);
    }
  }
  
  // Enhanced detection of sdegdaefk.gr requests
  const isSdegdaefkRequest = 
    (origin && (allowedOrigins.includes(origin) || origin.endsWith('.sdegdaefk.gr'))) ||
    (referer && referer.includes('sdegdaefk.gr')) ||
    (host && host.includes('sdegdaefk.gr'));
  
  // Check if the origin is allowed
  const isAllowedDomain = origin && (
    allowedOrigins.includes(origin) || 
    origin.endsWith('.sdegdaefk.gr') ||
    (process.env.NODE_ENV !== 'production' && (
      origin.includes('replit.dev') || 
      origin.includes('replit.app') ||
      origin.includes('repl.co')
    ))
  );
  
  // Log request information for debugging
  log(`[Security] Request from origin: ${origin || 'none'}, referer: ${referer || 'none'}, host: ${host || 'none'}`, 'security');
  log(`[Security] Is allowed domain: ${isAllowedDomain}, is sdegdaefk request: ${isSdegdaefkRequest}`, 'security');
  
  // Handle frame permissions
  if (isAllowedDomain || isSdegdaefkRequest) {
    // Set more permissive frame options for sdegdaefk.gr
    if (origin) {
      // Modern browsers ignore ALLOW-FROM, but we'll set it anyway for older browsers
      res.setHeader('X-Frame-Options', `ALLOW-FROM ${origin}`);
    } else {
      // If no origin but still from sdegdaefk.gr, use a default
      res.setHeader('X-Frame-Options', 'ALLOW-FROM https://sdegdaefk.gr');
    }
  } else {
    // Default to same-origin framing for all other domains
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  
  // Basic XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  
  // Set comprehensive CSP for sdegdaefk.gr domains
  // This is a backup CSP if helmet's doesn't apply (which should be rare)
  const cspValue = 
    "default-src 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr; " +
    "script-src 'self' 'unsafe-inline' https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr; " +
    "connect-src 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr; " +
    "frame-ancestors 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr; " +
    "img-src 'self' data: https: https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr; " +
    "font-src 'self' data: https: https://*.sdegdaefk.gr http://*.sdegdaefk.gr https://sdegdaefk.gr http://sdegdaefk.gr;";
  
  // Only set CSP if it's not already set by helmet
  if (!res.getHeader('Content-Security-Policy')) {
    res.setHeader('Content-Security-Policy', cspValue);
  }
  
  // Enhanced CORS headers for cross-domain communication
  if (isAllowedDomain || isSdegdaefkRequest) {
    // Log detailed CORS information
    log(`[Security] Setting enhanced CORS headers for sdegdaefk.gr domain access`, 'security');
    log(`[Security] Method: ${req.method}, Path: ${req.path}`, 'security');
    
    // Set CORS headers with origin reflection
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (isSdegdaefkRequest) {
      // If no origin header but other indicators suggest sdegdaefk.gr, use a default
      res.setHeader('Access-Control-Allow-Origin', 'https://sdegdaefk.gr');
    }
    
    // Allow all common methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    
    // Allow a comprehensive set of headers for cross-domain requests
    res.setHeader('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Referrer, ' +
      'X-API-Key, Cache-Control, Pragma, Set-Cookie, Cookie, withcredentials'
    );
    
    // Critical for cookie/session authentication across domains
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Expose important headers like Set-Cookie for cross-domain access
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-Requested-With, Set-Cookie, ETag, Date');
    
    // Cache preflight results for 24 hours to reduce OPTIONS requests
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Check if this is an authentication route
    if (req.path.includes('/api/auth')) {
      log(`[Security] Processing authentication route with enhanced cross-domain support: ${req.path}`, 'security-auth');
    }
  }

  next();
}

export default {
  securityHeaders,
  additionalSecurity
};
