import helmet from 'helmet';
import {Request, Response, NextFunction} from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://sdegdaefk.gr"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://unpkg.com",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://sdegdaefk.gr"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://sdegdaefk.gr"], 
      imgSrc: ["'self'", "data:", "https:", "https://sdegdaefk.gr"],
      connectSrc: [
        "'self'",
        "https://ga.jspm.io",
        "https://esm.sh",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://*.supabase.co",
        "https://sdegdaefk.gr"
      ],
      fontSrc: ["'self'", "https:", "data:", "https://sdegdaefk.gr"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https://sdegdaefk.gr"],
      frameSrc: ["'none'", "https://sdegdaefk.gr"],
      formAction: ["'self'", "https://sdegdaefk.gr"],
      frameAncestors: ["'none'", "https://sdegdaefk.gr"],
      baseUri: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    }
  },
  crossOriginEmbedderPolicy: { policy: "credentialless" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
});

// Additional security middleware
export function additionalSecurity(req: Request, res: Response, next: NextFunction) {
  // Clear sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Allow sdegdaefk.gr connections
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none' https://sdegdaefk.gr");
  
  // Add CORS headers for sdegdaefk.gr
  res.setHeader('Access-Control-Allow-Origin', 'https://sdegdaefk.gr');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  next();
}

export default {
  securityHeaders,
  additionalSecurity
};