import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import { log } from '../vite';

/**
 * Allowed country codes
 * GR - Greece
 */
const ALLOWED_COUNTRIES = ['GR'];

/**
 * Known trusted proxy IPs (Render, Cloudflare, etc.)
 * Only these proxies' X-Forwarded-For values will be trusted
 */
const TRUSTED_PROXY_RANGES = [
  '10.0.0.0/8',       // Render internal
  '172.16.0.0/12',    // Docker/internal
  '100.64.0.0/10',    // Render private network
];

/**
 * Exempt paths from geo-restrictions
 * Only truly critical paths that must always be accessible
 */
const EXEMPT_PATHS = [
  '/api/health',
];

/**
 * Check if an IP is a private/internal IP
 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  
  return ip.startsWith('10.') || 
         ip.startsWith('127.') || 
         ip === '::1' ||
         (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31) ||
         ip.startsWith('192.168.') ||
         ip.startsWith('100.64.');
}

/**
 * Determine if the direct socket connection appears to be coming from a trusted proxy
 * Right now we treat private/internal ranges as trusted. If more ranges are added above,
 * this helper can be expanded to do proper CIDR matching.
 */
function isTrustedProxyIp(ip: string): boolean {
  return isPrivateIp(ip);
}

/**
 * Check if a path should be exempt from geo-restrictions
 */
function isPathExempt(path: string): boolean {
  return EXEMPT_PATHS.some(exemptPath => 
    path === exemptPath || path.startsWith(exemptPath)
  );
}

/**
 * Get the client's real IP address from request
 * SECURITY: Only trust X-Forwarded-For if the direct connection is from a trusted proxy
 * We use the RIGHTMOST non-private IP (the one added by the trusted proxy), not the leftmost
 * This prevents attackers from prepending fake IPs to the header
 */
export function getClientIp(req: Request): string {
  const socketIp = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  
  if (isTrustedProxyIp(socketIp)) {
    // Prefer the left-most public IP from X-Forwarded-For (original client)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = typeof forwardedFor === 'string' 
        ? forwardedFor.split(',').map(ip => ip.trim().replace(/^::ffff:/, ''))
        : forwardedFor.map(ip => ip.replace(/^::ffff:/, ''));

      const publicIps = ips.filter(ip => ip && !isPrivateIp(ip));
      if (publicIps.length > 0) {
        return publicIps[0];
      }

      if (ips.length > 0) {
        // All IPs are private, return the first as a fallback
        return ips[0];
      }
    }
  }
  
  return socketIp;
}

/**
 * Get client IP from raw socket (for WebSocket connections)
 * SECURITY: Only trust X-Forwarded-For if socket is from trusted proxy
 * We use the RIGHTMOST non-private IP (the one added by the trusted proxy), not the leftmost
 * This prevents attackers from prepending fake IPs to the header
 */
export function getClientIpFromSocket(
  socketAddress: string | undefined,
  headers: { [key: string]: string | string[] | undefined }
): string {
  const socketIp = (socketAddress || '').replace(/^::ffff:/, '');
  
  if (isTrustedProxyIp(socketIp)) {
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = typeof forwardedFor === 'string' 
        ? forwardedFor.split(',').map(ip => ip.trim().replace(/^::ffff:/, ''))
        : (Array.isArray(forwardedFor) ? forwardedFor : [forwardedFor]).map(ip => (ip || '').replace(/^::ffff:/, ''));

      const publicIps = ips.filter(ip => ip && !isPrivateIp(ip));
      if (publicIps.length > 0) {
        return publicIps[0];
      }

      if (ips.length > 0) {
        return ips[0];
      }
    }
  }
  
  return socketIp;
}

/**
 * Check if an IP address is from Greece
 * SECURITY: Private IPs are only allowed if they come from the actual socket (internal services)
 */
export function isGreekIp(ip: string, isFromSocket: boolean = false): boolean {
  if (!ip) {
    log(`[GeoIP] No IP provided`, 'geoip');
    return false;
  }

  if (isPrivateIp(ip)) {
    if (isFromSocket) {
      log(`[GeoIP] Private IP ${ip} allowed (direct socket connection)`, 'geoip');
      return true;
    }
    log(`[GeoIP] Private IP ${ip} DENIED (not from direct socket)`, 'geoip-blocked');
    return false;
  }

  const geo = geoip.lookup(ip);
  
  if (!geo) {
    log(`[GeoIP] Lookup failed for IP: ${ip} - DENIED (fail-closed)`, 'geoip-blocked');
    return false;
  }

  const isGreece = ALLOWED_COUNTRIES.includes(geo.country);
  log(`[GeoIP] IP ${ip} country: ${geo.country}, allowed: ${isGreece}`, 'geoip');
  return isGreece;
}

/**
 * Check if the session has been geo-verified (user logged in from Greece)
 */
function isSessionGeoVerified(req: Request): boolean {
  return req.session?.geoVerified === true;
}

/**
 * GeoIP Middleware for restricting access by country
 * 
 * Security model:
 * 1. Unauthenticated users must come from Greece
 * 2. Users who logged in from Greece have their session marked as "geo-verified"
 * 3. Geo-verified sessions can access from anywhere (VPN, travel, etc.)
 * 4. No header-based bypasses - only trust X-Forwarded-For from actual proxies
 * 5. Fail-closed: if GeoIP lookup fails, deny access
 */
export function geoIpRestriction(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  if (isPathExempt(req.path)) {
    log(`[GeoIP] Exempt path ${req.path} bypassing geo-restrictions`, 'geoip');
    return next();
  }

  if (isSessionGeoVerified(req)) {
    log(`[GeoIP] Session geo-verified, allowing access for path ${req.path}`, 'geoip');
    return next();
  }

  const socketIp = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const isDirectPrivate = isPrivateIp(socketIp);
  
  if (isDirectPrivate) {
    const clientIp = getClientIp(req);
    
    if (isPrivateIp(clientIp)) {
      log(`[GeoIP] Internal request allowed: ${clientIp}`, 'geoip');
      return next();
    }
    
    const geo = geoip.lookup(clientIp);
    
    if (!geo) {
      log(`[GeoIP] Access DENIED: GeoIP lookup failed for IP: ${clientIp} - fail-closed policy`, 'geoip-blocked');
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Unable to verify your location. This service is only available in Greece.',
        code: 'GEOIP_LOOKUP_FAILED'
      });
    }

    if (ALLOWED_COUNTRIES.includes(geo.country)) {
      log(`[GeoIP] Access allowed from Greece (${geo.country}) via proxy, IP: ${clientIp}`, 'geoip');
      return next();
    }

    log(`[GeoIP] Access BLOCKED: IP ${clientIp} from ${geo.country} attempted to access ${req.path}`, 'geoip-blocked');
    return res.status(403).json({
      error: 'Access Denied',
      message: 'This service is only available in Greece.',
      code: 'COUNTRY_RESTRICTED'
    });
  }
  
  const geo = geoip.lookup(socketIp);
  
  if (!geo) {
    log(`[GeoIP] Access DENIED: GeoIP lookup failed for direct IP: ${socketIp} - fail-closed policy`, 'geoip-blocked');
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Unable to verify your location. This service is only available in Greece.',
      code: 'GEOIP_LOOKUP_FAILED'
    });
  }

  if (ALLOWED_COUNTRIES.includes(geo.country)) {
    log(`[GeoIP] Access allowed from Greece (${geo.country}) direct IP: ${socketIp}`, 'geoip');
    return next();
  }

  log(`[GeoIP] Access BLOCKED: Direct IP ${socketIp} from ${geo.country} attempted to access ${req.path}`, 'geoip-blocked');
  
  return res.status(403).json({
    error: 'Access Denied',
    message: 'This service is only available in Greece.',
    code: 'COUNTRY_RESTRICTED'
  });
}

export default geoIpRestriction;
