/**
 * sdegdaefk.gr Diagnostic Endpoints
 * 
 * This file provides special diagnostic endpoints specifically for sdegdaefk.gr
 * to help troubleshoot integration issues.
 */

import { Router, Request, Response } from 'express';
import { log } from '../vite';

// Helper function to detect sdegdaefk.gr domain requests
function isFromSdegdaefkDomain(req: Request): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  return (
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr'))
  );
}

const router = Router();

/**
 * GET /api/sdegdaefk-diagnostic/system
 * 
 * Returns system information to help diagnose deployment issues
 */
router.get('/system', (req: Request, res: Response) => {
  // Generate system diagnostics
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    nodeVersion: process.version,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      accept: req.headers.accept,
      contentType: req.headers['content-type'],
      cookie: req.headers.cookie ? 'present' : 'absent'
    },
    request: {
      url: req.url,
      originalUrl: req.originalUrl,
      method: req.method,
      protocol: req.protocol,
      secure: req.secure,
      ip: req.ip,
      hostname: req.hostname,
      path: req.path,
      query: req.query
    },
    sdegdaefk: {
      detected: isFromSdegdaefkDomain(req),
      cookieDomain: process.env.COOKIE_DOMAIN || 'not set'
    },
    env: {
      // List of environment variables that might be relevant for debugging
      // Only include values for non-sensitive variables
      DATABASE_URL: process.env.DATABASE_URL ? 'present' : 'absent',
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || '5000 (default)',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'present' : 'absent',
      CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || 'not set'
    }
  };

  // Log the diagnostic information
  log(`[Diagnostic] System information requested: ${JSON.stringify(diagnostics)}`, 'diagnostic');

  // Return the diagnostics
  res.status(200).json(diagnostics);
});

/**
 * GET /api/sdegdaefk-diagnostic/cors-test
 * 
 * Test endpoint to check CORS settings
 */
router.get('/cors-test', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'CORS test successful',
    origin: req.headers.origin || 'No origin header',
    host: req.headers.host || 'No host header'
  });
});

/**
 * GET /api/sdegdaefk-diagnostic/cookie-test
 * 
 * Test endpoint to check cookie settings
 */
router.get('/cookie-test', (req: Request, res: Response) => {
  // Set a test cookie
  res.cookie('sdegdaefk_test', 'test_value', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: process.env.COOKIE_DOMAIN || undefined
  });

  res.status(200).json({
    success: true,
    message: 'Cookie test - check your browser cookies',
    cookieConfig: {
      domain: process.env.COOKIE_DOMAIN || 'default',
      secure: true,
      sameSite: 'none'
    },
    existing: req.headers.cookie ? 'Cookies present in request' : 'No cookies in request'
  });
});

/**
 * GET /api/sdegdaefk-diagnostic/health
 * 
 * Basic health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/sdegdaefk-diagnostic/documents-test
 * 
 * Tests the /documents path handling specifically
 */
router.get('/documents-test', (req: Request, res: Response) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const accept = req.headers.accept || '';
  
  // Check if this is a browser request
  const isBrowserRequest = accept.includes('text/html') || req.headers['sec-fetch-dest'] === 'document';
  
  // Check if from sdegdaefk domain
  const isSdegdaefkRequest = isFromSdegdaefkDomain(req);
  
  res.status(200).json({
    status: 'ok',
    message: 'Documents path access test',
    timestamp: new Date().toISOString(),
    request: {
      isBrowser: isBrowserRequest,
      isSdegdaefkDomain: isSdegdaefkRequest,
      origin: origin || 'none',
      host: host || 'none',
      referer: referer || 'none',
      accept: accept
    },
    documentsBrowserHandler: {
      status: 'active',
      paths: ['/documents'],
      action: 'redirect to homepage',
      redirectUrl: '/'
    },
    testDocumentsUrl: '/documents',
    testResult: 'Use this endpoint to verify the documents browser handler is working'
  });
});

export default router;