/**
 * Special diagnostic endpoints for sdegdaefk.gr integration troubleshooting.
 * These endpoints do not require authentication and provide information about 
 * the connection status, CORS configuration, and other integration-specific details.
 */

import express, { Request, Response } from 'express';
import { log } from '../vite';
import { testConnection } from '../config/db';

const router = express.Router();

/**
 * Basic connectivity check endpoint
 * Returns information about CORS and cookie settings
 */
router.get('/check', (req: Request, res: Response) => {
  try {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;
    const userAgent = req.headers['user-agent'];
    const acceptHeader = req.headers.accept || '';
    
    // Check if this is a browser request
    const isBrowserRequest = acceptHeader.includes('text/html') || req.headers['sec-fetch-dest'] === 'document';
    
    // Check if this is from sdegdaefk.gr domain
    const isSdegdaefkRequest = 
      (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
      (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
      (typeof referer === 'string' && referer.includes('sdegdaefk.gr'));
    
    // Log diagnostic information
    log(`[SdegdaefkDiagnostic] Connectivity check from: origin=${origin || 'none'}, host=${host || 'none'}, referer=${referer || 'none'}`, 'info');
    
    // Return diagnostic information
    return res.status(200).json({
      status: 'ok',
      message: 'sdegdaefk.gr integration diagnostic check',
      timestamp: new Date().toISOString(),
      request: {
        origin: origin || 'none',
        host: host || 'none',
        referer: referer || 'none',
        userAgent: userAgent || 'none',
        isBrowserRequest,
        isSdegdaefkRequest
      },
      integration: {
        enabled: true,
        cors: {
          enabled: true,
          credentials: true,
          allowedOrigins: ['https://sdegdaefk.gr', 'http://sdegdaefk.gr'],
          allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        cookieDomain: process.env.COOKIE_DOMAIN || 'not configured',
        environment: process.env.NODE_ENV || 'development',
        deployedUrl: process.env.DEPLOYED_URL || 'not configured'
      }
    });
  } catch (error: any) {
    log(`[SdegdaefkDiagnostic] Error in check endpoint: ${error.message}`, 'error');
    
    return res.status(500).json({
      status: 'error',
      message: 'Error processing diagnostic check',
      error: 'internal_error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database connectivity test endpoint
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    log('[SdegdaefkDiagnostic] Testing database connectivity', 'info');
    
    // Test database connection with retries
    const connectionResult = await testConnection(2, 1000);
    
    return res.status(200).json({
      status: connectionResult ? 'ok' : 'error',
      message: connectionResult ? 'Database connection successful' : 'Database connection failed',
      timestamp: new Date().toISOString(),
      database: {
        connected: connectionResult,
        postgresUrl: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    });
  } catch (error: any) {
    log(`[SdegdaefkDiagnostic] Error testing database: ${error.message}`, 'error');
    
    return res.status(500).json({
      status: 'error',
      message: 'Error testing database connection',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Session test endpoint - checks if session is properly configured
 */
router.get('/session', (req: Request, res: Response) => {
  try {
    const session = req.session;
    const sessionID = req.sessionID;
    const cookies = req.cookies || {};
    const headers = req.headers;
    
    // Log session information
    log(`[SdegdaefkDiagnostic] Session check: sessionID=${sessionID}, session exists=${!!session}`, 'info');
    
    // Update session with diagnostic information
    if (session) {
      if (!session.diagnostic) {
        session.diagnostic = {};
      }
      
      session.diagnostic.lastChecked = new Date().toISOString();
      session.diagnostic.accessCount = (session.diagnostic.accessCount || 0) + 1;
    }
    
    return res.status(200).json({
      status: 'ok',
      message: 'Session diagnostic check',
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        id: sessionID || 'none',
        cookie: session?.cookie ? {
          maxAge: session.cookie.maxAge,
          expires: session.cookie.expires,
          secure: session.cookie.secure,
          httpOnly: session.cookie.httpOnly,
          domain: session.cookie.domain || 'not set',
          sameSite: session.cookie.sameSite || 'not set'
        } : 'no session cookie',
        cookiesPresent: Object.keys(cookies).length > 0,
        cookieNames: Object.keys(cookies)
      },
      sessionConfiguration: {
        cookieName: process.env.SESSION_COOKIE_NAME || 'sid',
        domain: process.env.COOKIE_DOMAIN || 'not configured',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      },
      headers: {
        origin: headers.origin || 'none',
        host: headers.host || 'none',
        referer: headers.referer || 'none'
      }
    });
  } catch (error: any) {
    log(`[SdegdaefkDiagnostic] Error in session check: ${error.message}`, 'error');
    
    return res.status(500).json({
      status: 'error',
      message: 'Error checking session configuration',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;