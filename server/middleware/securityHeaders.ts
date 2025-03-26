import helmet from 'helmet';
import {Request, Response, NextFunction} from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://sdegdaefk.gr", "*"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://unpkg.com",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://sdegdaefk.gr",
        "*"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://sdegdaefk.gr", "*"], 
      imgSrc: ["'self'", "data:", "https:", "https://sdegdaefk.gr", "*"],
      connectSrc: [
        "'self'",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://*.supabase.co",
        "https://sdegdaefk.gr",
        "*"
      ],
      fontSrc: ["'self'", "https:", "data:", "https://sdegdaefk.gr", "*"],
      objectSrc: ["'self'"],
      mediaSrc: ["'self'", "https://sdegdaefk.gr", "*"],
      frameSrc: ["'self'", "https://sdegdaefk.gr", "*"],
      formAction: ["'self'", "https://sdegdaefk.gr", "*"],
      frameAncestors: ["'self'", "https://sdegdaefk.gr", "*"],
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

  // Add security headers, but allow sdegdaefk.gr
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Allow frames from sdegdaefk.gr
  if (req.headers.origin === 'https://sdegdaefk.gr') {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://sdegdaefk.gr');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  
  // Set more permissive CSP for sdegdaefk.gr
  res.setHeader('Content-Security-Policy', "default-src 'self' https://sdegdaefk.gr *; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdegdaefk.gr *; connect-src 'self' https://sdegdaefk.gr *; frame-ancestors 'self' https://sdegdaefk.gr *");
  
  // Add CORS headers for external domains with special handling for sdegdaefk.gr
  const origin = req.headers.origin;
  if (origin === 'https://sdegdaefk.gr') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  next();
}

export default {
  securityHeaders,
  additionalSecurity
};