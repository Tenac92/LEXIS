import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';

/**
 * Allowed country codes
 * GR - Greece
 */
const ALLOWED_COUNTRIES = ['GR'];

/**
 * Whitelist of IPs that can bypass geo restrictions
 * Include internal IPs, localhost, development environments, and Replit IPs
 */
const IP_WHITELIST = [
  '127.0.0.1',
  'localhost',
  '::1',
  '10.0.0.0/8',       // Internal network
  '172.16.0.0/12',    // Internal network
  '192.168.0.0/16',   // Internal network
  '35.192.0.0/12',    // Replit/Google Cloud IPs (may need adjustment)
  '34.0.0.0/8',       // Replit/Google Cloud IPs (may need adjustment)
];

/**
 * Exempt domains from geo-restrictions
 * This allows specific domains to bypass geo-restrictions
 */
const EXEMPT_DOMAINS = [
  'sdegdaefk.gr',
  'replit.app',
  'replit.dev',
  'repl.co'
];

/**
 * Check if an IP is in the whitelist
 */
function isIpWhitelisted(ip: string): boolean {
  // Direct IP match
  if (IP_WHITELIST.includes(ip)) return true;

  // Check for CIDR matches (simplified)
  if (ip.startsWith('10.') || 
      ip.startsWith('127.') || 
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31) ||
      ip.startsWith('192.168.')) {
    return true;
  }

  return false;
}

/**
 * Check if a domain is exempt from geo-restrictions
 */
function isDomainExempt(req: Request): boolean {
  const referer = req.get('Referer') || '';
  const origin = req.get('Origin') || '';
  const host = req.get('Host') || '';
  
  // In development mode, always exempt
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[GeoIP] Dev environment exempt from GeoIP restrictions`);
    return true;
  }
  
  // Check if any of the headers indicate exempt domains
  const isExempt = EXEMPT_DOMAINS.some(domain => {
    return (referer.includes(domain) || origin.includes(domain) || host.includes(domain));
  });
  
  // Add extra check for Replit domains
  const isReplitDomain = [referer, origin, host].some(header => {
    return header.includes('replit.dev') || 
           header.includes('replit.app') ||
           header.includes('repl.co');
  });
  
  if (isReplitDomain && process.env.NODE_ENV !== 'production') {
    console.log(`[GeoIP] Replit domain exempt from GeoIP restrictions: ${host}`);
  }
  
  return isExempt || isReplitDomain;
}

/**
 * GeoIP Middleware for restricting access by country
 * 
 * This middleware blocks traffic from countries not in the ALLOWED_COUNTRIES list,
 * with exceptions for IP_WHITELIST and EXEMPT_DOMAINS.
 */
export function geoIpRestriction(req: Request, res: Response, next: NextFunction) {
  // Allow health checks and preflight requests to bypass geo-restriction
  if (req.path.includes('/api/healthcheck') || req.method === 'OPTIONS') {
    return next();
  }

  // Skip for exempt domains
  if (isDomainExempt(req)) {
    return next();
  }

  // Get client's IP
  let clientIp = 
    req.headers['x-forwarded-for'] || 
    req.socket.remoteAddress || 
    req.ip || '';
  
  // If x-forwarded-for contains multiple IPs, take the first one
  if (typeof clientIp === 'string' && clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }

  // If IP is in whitelist, allow access
  if (isIpWhitelisted(clientIp as string)) {
    return next();
  }

  // Lookup country for the IP
  const geo = geoip.lookup(clientIp as string);
  
  // If geo lookup failed, allow access (fail open for production environments)
  // For stricter security, change this to deny by default
  if (!geo) {
    console.warn(`GeoIP lookup failed for IP: ${clientIp}`);
    return next();
  }

  // Check if country is allowed
  if (ALLOWED_COUNTRIES.includes(geo.country)) {
    return next();
  }

  // Log blocked access
  console.warn(`Access blocked: IP ${clientIp} from ${geo.country} attempted to access ${req.path}`);
  
  // Return 403 Forbidden
  return res.status(403).json({
    error: 'Access Denied',
    message: 'This service is only available in Greece.',
    code: 'COUNTRY_RESTRICTED'
  });
}

// Export the middleware
export default geoIpRestriction;