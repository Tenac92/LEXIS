import { Router, Request, Response } from 'express';
import geoip from 'geoip-lite';
import { log } from '../vite';

export const router = Router();

/**
 * Health check endpoint
 * GET /api/healthcheck
 * 
 * This endpoint provides basic health checking functionality
 * and also serves as a test for CORS configuration with external domains
 */
router.get('/', (_req: Request, res: Response) => {
  // Construct a response that contains useful debugging information
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
      'Cross-Origin-Embedder-Policy': res.getHeader('Cross-Origin-Embedder-Policy'),
      'Cross-Origin-Opener-Policy': res.getHeader('Cross-Origin-Opener-Policy'),
      'Cross-Origin-Resource-Policy': res.getHeader('Cross-Origin-Resource-Policy')
    },
    // Include additional information that might be helpful for debugging
    message: 'Server is running and healthy',
    cors: {
      enabled: true,
      domains: ['https://sdegdaefk.gr', 'http://sdegdaefk.gr']
    },
  };
  
  res.status(200).json(response);
});

/**
 * Extended health check endpoint with origin testing
 * GET /api/healthcheck/cors-test
 * 
 * This endpoint specifically tests CORS handling
 */
router.get('/cors-test', (req: Request, res: Response) => {
  const origin = req.headers.origin || 'No origin header';
  const referer = req.headers.referer || 'No referer header';
  const host = req.headers.host || 'No host header';
  
  // Check if this appears to be from sdegdaefk.gr
  const isSdegdaefkRequest = 
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr'));
    
  // Log detailed information for debugging
  if (isSdegdaefkRequest) {
    log(`[HealthCheck] CORS test from sdegdaefk.gr domain: ${JSON.stringify({
      origin, 
      referer,
      host,
      cookies: req.headers.cookie
    })}`, 'healthcheck');
  }
  
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    requestOrigin: origin,
    requestReferer: referer,
    requestHost: host,
    corsEnabled: true,
    message: 'CORS test endpoint',
    isSdegdaefkRequest,
    cookies: req.headers.cookie ? 'Present' : 'None',
    allowedOrigins: ['https://sdegdaefk.gr', 'http://sdegdaefk.gr', 'https://*.sdegdaefk.gr', 'http://*.sdegdaefk.gr'],
    allowCredentials: true,
    responseHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  };
  
  res.status(200).json(response);
});

/**
 * GeoIP restriction test endpoint
 * GET /api/healthcheck/geoip-test
 * 
 * This endpoint tests the GeoIP restriction functionality
 */
router.get('/geoip-test', (req: Request, res: Response) => {
  // Extract client IP
  let clientIp = 
    req.headers['x-forwarded-for'] || 
    req.socket.remoteAddress || 
    req.ip || 'Unknown IP';
  
  // If x-forwarded-for contains multiple IPs, take the first one
  if (typeof clientIp === 'string' && clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }

  // Get GeoIP data if available
  let geoData = null;
  try {
    geoData = geoip.lookup(clientIp as string);
  } catch (error) {
    log(`[HealthCheck] Error performing GeoIP lookup: ${error}`, 'healthcheck');
  }

  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'GeoIP restriction test endpoint',
    clientInfo: {
      ip: clientIp,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'referer': req.headers.referer,
        'origin': req.headers.origin,
        'user-agent': req.headers['user-agent']
      }
    },
    geoIpData: geoData || 'GeoIP data not available',
    restrictionConfig: {
      allowedCountries: ['GR'],
      exemptDomains: ['sdegdaefk.gr', 'replit.app', 'replit.dev', 'repl.co'],
      ipWhitelistExample: ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
    }
  };
  
  res.status(200).json(response);
});

/**
 * Cross-domain authentication test endpoint
 * GET /api/healthcheck/auth-test
 * 
 * This endpoint tests if authentication cookies are properly working across domains
 */
router.get('/auth-test', (req: Request, res: Response) => {
  // Extract session information
  const hasSession = !!req.session;
  const hasUser = !!(req.session && req.session.user);
  const sessionID = req.sessionID;
  
  // Extract request details
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Check for sdegdaefk.gr related request
  const isSdegdaefkRequest = 
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr'));
  
  // Log detailed information for debugging cross-domain auth
  log(`[HealthCheck] Auth test: ${JSON.stringify({
    hasSession,
    hasUser,
    sessionID,
    origin,
    referer,
    host,
    isSdegdaefkRequest,
    cookies: req.headers.cookie,
    ip: req.ip
  })}`, 'healthcheck');
  
  // Return authentication status
  res.status(200).json({
    status: 'ok',
    message: 'Authentication test endpoint',
    auth: {
      hasSession,
      hasUser,
      sessionID,
      userRole: hasUser && req.session.user ? req.session.user.role : null,
      userName: hasUser && req.session.user ? req.session.user.name : null
    },
    request: {
      origin: origin || 'None',
      referer: referer || 'None',
      host: host || 'None',
      ip: req.ip,
      isSdegdaefkRequest,
      cookies: req.headers.cookie ? 'Present' : 'None'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Special endpoint for sdegdaefk.gr domain testing
 * GET /api/healthcheck/sdegdaefk
 * 
 * This endpoint specifically tests sdegdaefk.gr domain connectivity
 */
router.get('/sdegdaefk', (req: Request, res: Response) => {
  // Extract all request information
  const cookies = req.headers.cookie;
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Check if this is from sdegdaefk.gr
  const isSdegdaefkRequest = 
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr'));
  
  // Log detailed information
  log(`[HealthCheck] sdegdaefk.gr test: ${JSON.stringify({
    isSdegdaefkRequest,
    origin,
    referer,
    host,
    cookies,
    ip: req.ip,
    headers: {
      cookie: cookies ? 'Present' : 'None',
      origin: origin || 'None',
      referer: referer || 'None',
      host: host || 'None'
    }
  })}`, 'healthcheck');
  
  // Return comprehensive information
  res.status(200).json({
    status: 'ok',
    message: 'sdegdaefk.gr connectivity test endpoint',
    connection: {
      isSdegdaefkRequest,
      origin: origin || 'None',
      referer: referer || 'None',
      host: host || 'None',
      hasCookies: !!cookies,
      ip: req.ip
    },
    environment: {
      cookieDomain: process.env.COOKIE_DOMAIN || 'Not set',
      nodeEnv: process.env.NODE_ENV || 'Not set'
    },
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
      'Content-Security-Policy': res.getHeader('Content-Security-Policy') ? 'Present (truncated)' : 'Not set',
      'Vary': res.getHeader('Vary')
    },
    timestamp: new Date().toISOString()
  });
});

export default router;