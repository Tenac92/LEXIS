import helmet from 'helmet';
import {Request, Response, NextFunction} from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://unpkg.com",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://sdegdaefk.gr",
        "http://sdegdaefk.gr",
        "*"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"], 
      imgSrc: ["'self'", "data:", "https:", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      connectSrc: [
        "'self'",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://*.supabase.co",
        "https://sdegdaefk.gr",
        "http://sdegdaefk.gr",
        "*"
      ],
      fontSrc: ["'self'", "https:", "data:", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      objectSrc: ["'self'"],
      mediaSrc: ["'self'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      frameSrc: ["'self'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      formAction: ["'self'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      frameAncestors: ["'self'", "https://sdegdaefk.gr", "http://sdegdaefk.gr", "*"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: null,
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: false,
  frameguard: false,  // Allow framing
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" },
  xssFilter: true
});

// Additional security middleware
export function additionalSecurity(req: Request, res: Response, next: NextFunction) {
  // Clear sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers, but allow sdegdaefk.gr and subdomains
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Get the request origin
  const origin = req.headers.origin;
  
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
  
  // Check if the origin is allowed
  const isAllowedDomain = origin && (
    allowedOrigins.includes(origin) || 
    (origin.endsWith('.sdegdaefk.gr'))
  );
  
  // Log request information in development
  if (process.env.NODE_ENV !== 'production' && origin) {
    console.log(`[Security] Request from origin: ${origin}, isAllowed: ${isAllowedDomain}`);
  }
  
  if (origin && isAllowedDomain) {
    // Modern browsers ignore ALLOW-FROM, but we'll set it anyway for older browsers
    res.setHeader('X-Frame-Options', `ALLOW-FROM ${origin}`);
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  
  // Set more permissive CSP for sdegdaefk.gr domains (with wildcards for subdomains)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr *; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sdegdaefk.gr http://*.sdegdaefk.gr *; " +
    "connect-src 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr *; " +
    "frame-ancestors 'self' https://*.sdegdaefk.gr http://*.sdegdaefk.gr *"
  );
  
  // Add CORS headers for external domains with special handling for sdegdaefk.gr domain and subdomains
  if (origin && isAllowedDomain) {
    // Log more detailed information in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Security] Setting CORS headers for: ${origin}`);
      console.log(`[Security] Request method: ${req.method}, path: ${req.path}`);
      console.log(`[Security] Cookie headers: ${req.headers.cookie}`);
    }
    
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-API-Key, ' +
      'Cache-Control, Pragma, withcredentials, Cookie, cookie'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  next();
}

export default {
  securityHeaders,
  additionalSecurity
};