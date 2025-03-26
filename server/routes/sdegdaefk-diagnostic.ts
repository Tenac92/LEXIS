/**
 * Special Diagnostic Routes for sdegdaefk.gr Integration
 * 
 * These routes provide detailed diagnostics and tests specifically for 
 * the integration with sdegdaefk.gr domain and its subdomains.
 */

import { Router, Request, Response } from 'express';
import { log } from '../vite';
import { verifyDatabaseConnections } from '../data/index';
import { supabase } from '../config/db';

export const router = Router();

/**
 * Root diagnostic endpoint
 * GET /api/sdegdaefk-diagnostic
 */
router.get('/', (req: Request, res: Response) => {
  // Check if this is a browser request (looking for HTML)
  const acceptHeader = req.headers.accept || '';
  const isBrowserRequest = acceptHeader.includes('text/html') || req.headers['sec-fetch-dest'] === 'document';
  
  // If this is a browser request directly to the diagnostic endpoint, show a friendly HTML page
  if (isBrowserRequest) {
    log(`[sdegdaefk-diagnostic] Browser request detected, serving HTML diagnostic page`, 'info');
    
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ΣΔΕΓΔΑΕΦΚ - Διαγνωστικό</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #0066cc; }
            .diagnostics { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
            .item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .success { color: green; }
            .warning { color: orange; }
            .error { color: red; }
            .btn { display: inline-block; background: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>ΣΔΕΓΔΑΕΦΚ - Διαγνωστικό Σύστημα</h1>
          <div class="diagnostics">
            <div class="item">
              <span class="label">Κατάσταση API:</span> 
              <span class="success">Λειτουργικό</span>
            </div>
            <div class="item">
              <span class="label">Αίτημα από:</span> 
              ${req.headers.origin || req.headers.host || 'Άγνωστο'}
            </div>
            <div class="item">
              <span class="label">IP Διεύθυνση:</span> 
              ${req.ip}
            </div>
            <div class="item">
              <span class="label">Ενσωμάτωση με sdegdaefk.gr:</span>
              <span class="success">Ενεργοποιημένη</span>
            </div>
            <div class="item">
              <span class="label">Χρόνος Διακομιστή:</span> 
              ${new Date().toLocaleString('el-GR')}
            </div>
          </div>
          
          <p>Αυτή η σελίδα χρησιμοποιείται για διαγνωστικούς σκοπούς. Παρακαλούμε επιστρέψτε στην κύρια εφαρμογή.</p>
          
          <a class="btn" href="/">Επιστροφή στην αρχική σελίδα</a>
        </body>
      </html>
    `;
    
    return res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      })
      .send(htmlResponse);
  }
  
  // Extract request information
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Check if this is from sdegdaefk.gr
  const isSdegdaefkRequest = 
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr'));
  
  // Log this diagnostic access
  log(`[sdegdaefk-diagnostic] Diagnostic endpoint accessed: ${req.method} ${req.path}`, 'info');
  log(`[sdegdaefk-diagnostic] Request origin: ${origin || 'None'}`, 'info');
  log(`[sdegdaefk-diagnostic] From sdegdaefk.gr: ${isSdegdaefkRequest}`, 'info');
  
  // Enhanced response with CORS and security headers visualization
  const response = {
    status: 'ok',
    message: 'sdegdaefk.gr diagnostic endpoint',
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      path: req.path,
      headers: {
        origin: origin || 'Not set',
        referer: referer || 'Not set',
        host: host || 'Not set',
        'user-agent': req.headers['user-agent'] || 'Not set',
        cookie: req.headers.cookie ? 'Present' : 'Not set'
      },
      ip: req.ip,
      isSdegdaefkRequest
    },
    response: {
      headers: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin') || 'Not set',
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials') || 'Not set',
        'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods') || 'Not set',
        'content-security-policy': res.getHeader('Content-Security-Policy') ? 'Present (truncated)' : 'Not set',
        'x-frame-options': res.getHeader('X-Frame-Options') || 'Not set'
      }
    },
    environment: {
      cookieDomain: process.env.COOKIE_DOMAIN || 'Not set',
      nodeEnv: process.env.NODE_ENV || 'Not set',
      databaseConfigured: !!process.env.DATABASE_URL
    },
    integration: {
      cors: {
        enabled: true,
        allowsCredentials: true,
        allowedOrigins: [
          'https://sdegdaefk.gr',
          'http://sdegdaefk.gr',
          'https://*.sdegdaefk.gr',
          'http://*.sdegdaefk.gr'
        ]
      },
      session: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        domain: process.env.COOKIE_DOMAIN || 'Not configured'
      }
    }
  };
  
  res.status(200).json(response);
});

/**
 * Database connectivity test
 * GET /api/sdegdaefk-diagnostic/database
 */
router.get('/database', async (req: Request, res: Response) => {
  const origin = req.headers.origin;
  const isSdegdaefkRequest = typeof origin === 'string' && origin.includes('sdegdaefk.gr');
  
  log(`[sdegdaefk-diagnostic] Database test requested ${isSdegdaefkRequest ? 'from sdegdaefk.gr' : ''}`, 'info');
  
  try {
    // Test database connectivity
    const connectionStatus = await verifyDatabaseConnections();
    
    // Test specific tables relevant to sdegdaefk.gr integration
    let documentsTestResult: { success: boolean, error: string | null } = { success: false, error: null };
    let usersTestResult: { success: boolean, error: string | null } = { success: false, error: null };
    
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select('count(*)', { count: 'exact' })
        .limit(1);
        
      documentsTestResult.success = !error;
      if (error) documentsTestResult.error = error.message;
    } catch (err: any) {
      documentsTestResult.error = err.message;
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count(*)', { count: 'exact' })
        .limit(1);
        
      usersTestResult.success = !error;
      if (error) usersTestResult.error = error.message;
    } catch (err: any) {
      usersTestResult.error = err.message;
    }
    
    res.status(200).json({
      status: 'ok',
      message: 'Database connectivity test for sdegdaefk.gr integration',
      timestamp: new Date().toISOString(),
      connectionStatus,
      tableTests: {
        documents: documentsTestResult,
        users: usersTestResult
      },
      request: {
        origin: origin || 'None',
        isSdegdaefkRequest
      }
    });
  } catch (error: any) {
    log(`[sdegdaefk-diagnostic] Database test error: ${error.message}`, 'error');
    
    res.status(500).json({
      status: 'error',
      message: 'Error performing database connectivity test',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Authentication test
 * GET /api/sdegdaefk-diagnostic/auth
 */
router.get('/auth', (req: Request, res: Response) => {
  // Extract session information
  const hasSession = !!(req as any).session;
  const hasUser = !!(req as any).session?.user;
  const sessionID = (req as any).sessionID;
  
  // Extract cookies and credentials
  const cookies = req.headers.cookie;
  const origin = req.headers.origin;
  const isSdegdaefkRequest = typeof origin === 'string' && origin.includes('sdegdaefk.gr');
  
  log(`[sdegdaefk-diagnostic] Auth test requested ${isSdegdaefkRequest ? 'from sdegdaefk.gr' : ''}`, 'info');
  log(`[sdegdaefk-diagnostic] Session: ${hasSession}, User: ${hasUser}, SessionID: ${sessionID}`, 'info');
  
  // Return authentication information
  res.status(200).json({
    status: 'ok',
    message: 'Authentication test for sdegdaefk.gr integration',
    timestamp: new Date().toISOString(),
    auth: {
      hasSession,
      hasUser,
      sessionID,
      userDetails: hasUser ? {
        // Safely extract non-sensitive user information
        role: (req as any).session?.user?.role || null,
        name: (req as any).session?.user?.name || null,
        units: (req as any).session?.user?.units || null
      } : null
    },
    cookies: {
      present: !!cookies,
      sessionCookiePresent: cookies?.includes('connect.sid') || false
    },
    request: {
      origin: origin || 'None',
      isSdegdaefkRequest,
      ip: req.ip
    },
    environment: {
      cookieDomain: process.env.COOKIE_DOMAIN || 'Not set',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    }
  });
});

/**
 * Headers echo test
 * GET /api/sdegdaefk-diagnostic/headers
 */
router.get('/headers', (req: Request, res: Response) => {
  // Log all headers for debugging
  log(`[sdegdaefk-diagnostic] Headers test with all request headers: ${JSON.stringify(req.headers)}`, 'info');
  
  // Extract specific headers of interest
  const origin = req.headers.origin;
  const isSdegdaefkRequest = typeof origin === 'string' && origin.includes('sdegdaefk.gr');
  
  // Return all headers (safely)
  res.status(200).json({
    status: 'ok',
    message: 'Headers echo test for sdegdaefk.gr integration',
    timestamp: new Date().toISOString(),
    requestHeaders: {
      ...req.headers,
      // Exclude potentially sensitive headers
      cookie: req.headers.cookie ? 'Present (redacted)' : 'Not present',
      authorization: req.headers.authorization ? 'Present (redacted)' : 'Not present'
    },
    responseHeaders: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin') || 'Not set',
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials') || 'Not set',
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods') || 'Not set',
      'content-security-policy': res.getHeader('Content-Security-Policy') ? 'Present (truncated)' : 'Not set',
      'x-frame-options': res.getHeader('X-Frame-Options') || 'Not set',
      'vary': res.getHeader('Vary') || 'Not set'
    },
    isSdegdaefkRequest
  });
});

/**
 * OPTIONS handler for preflight requests
 */
router.options('*', (req: Request, res: Response) => {
  log(`[sdegdaefk-diagnostic] Handling OPTIONS preflight request from: ${req.headers.origin || 'Unknown'}`, 'info');
  
  // Set permissive CORS headers specifically for sdegdaefk.gr preflight requests
  if (req.headers.origin && req.headers.origin.includes('sdegdaefk.gr')) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
    
    log(`[sdegdaefk-diagnostic] Allowed preflight for sdegdaefk.gr origin: ${req.headers.origin}`, 'info');
  }
  
  res.status(204).end();
});

export default router;