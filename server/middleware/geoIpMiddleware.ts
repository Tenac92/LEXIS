import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import { log } from '../vite';

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
  '35.192.0.0/12',    // Replit/Google Cloud IPs
  '34.0.0.0/8',       // Replit/Google Cloud IPs
  '84.205.0.0/16',    // Common Greek ISP range (for testing)
];

/**
 * Exempt domains from geo-restrictions
 * This allows specific domains to bypass geo-restrictions
 */
const EXEMPT_DOMAINS = [
  // Main sdegdaefk.gr domains
  'sdegdaefk.gr',
  'www.sdegdaefk.gr',
  // Subdomains of sdegdaefk.gr
  '.sdegdaefk.gr',
  // Replit domains
  'replit.app',
  'replit.dev',
  'repl.co',
  'replit.com'
];

/**
 * Exempt paths from geo-restrictions
 * Critical paths that should always be accessible
 */
const EXEMPT_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
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
      ip.startsWith('192.168.') ||
      ip.startsWith('84.205.')) {  // Added common Greek IP range
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
    log(`[GeoIP] Dev environment exempt from GeoIP restrictions`, 'geoip');
    return true;
  }
  
  // Enhanced check for sdegdaefk.gr specifically
  const isSdegdaefkDomain = 
    origin.includes('sdegdaefk.gr') || 
    referer.includes('sdegdaefk.gr') || 
    host.includes('sdegdaefk.gr');
  
  if (isSdegdaefkDomain) {
    log(`[GeoIP] sdegdaefk.gr domain exempt from GeoIP restrictions: ${origin || referer || host}`, 'geoip');
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
  
  if (isReplitDomain) {
    log(`[GeoIP] Replit domain exempt from GeoIP restrictions: ${host}`, 'geoip');
    return true;
  }
  
  return isExempt || isReplitDomain;
}

/**
 * Check if a path should be exempt from geo-restrictions
 */
function isPathExempt(path: string): boolean {
  // Check for direct matches or if the path starts with any exempt path
  return EXEMPT_PATHS.some(exemptPath => 
    path === exemptPath || path.startsWith(exemptPath)
  );
}

/**
 * GeoIP Middleware for restricting access by country
 * 
 * This middleware blocks traffic from countries not in the ALLOWED_COUNTRIES list,
 * with exceptions for IP_WHITELIST and EXEMPT_DOMAINS.
 * Enhanced for sdegdaefk.gr domain support.
 */
export function geoIpRestriction(req: Request, res: Response, next: NextFunction) {
  // Allow preflight requests to bypass geo-restriction
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  // Allow exempt paths to bypass geo-restriction
  if (isPathExempt(req.path)) {
    log(`[GeoIP] Exempt path ${req.path} bypassing geo-restrictions`, 'geoip');
    return next();
  }

  // Skip for exempt domains (including sdegdaefk.gr)
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
  
  // Log IP check for debugging
  log(`[GeoIP] Checking IP: ${clientIp} for path ${req.path}`, 'geoip');

  // If IP is in whitelist, allow access
  if (isIpWhitelisted(clientIp as string)) {
    log(`[GeoIP] IP ${clientIp} is whitelisted, allowing access`, 'geoip');
    return next();
  }

  // Lookup country for the IP
  const geo = geoip.lookup(clientIp as string);
  
  // If geo lookup failed, allow access (fail open for production environments)
  // For stricter security, change this to deny by default
  if (!geo) {
    log(`[GeoIP] GeoIP lookup failed for IP: ${clientIp}`, 'geoip');
    return next();
  }

  // Check if country is allowed (Greece)
  if (ALLOWED_COUNTRIES.includes(geo.country)) {
    log(`[GeoIP] Access allowed from Greece (${geo.country}) IP: ${clientIp}`, 'geoip');
    return next();
  }

  // Log blocked access
  log(`[GeoIP] Access blocked: IP ${clientIp} from ${geo.country} attempted to access ${req.path}`, 'geoip-blocked');
  
  // Return 403 Forbidden
  return res.status(403).json({
    error: 'Access Denied',
    message: 'This service is only available in Greece.',
    code: 'COUNTRY_RESTRICTED'
  });
}

// Export the middleware
export default geoIpRestriction;