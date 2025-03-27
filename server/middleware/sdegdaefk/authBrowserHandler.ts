/**
 * Special handler for direct browser requests to /auth/login from sdegdaefk.gr
 * 
 * This middleware detects and properly handles HTML requests to /auth/login
 * from browsers on the sdegdaefk.gr domain to prevent 500 errors.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../vite';

/**
 * Detect if a request is from a browser (HTML) rather than API call
 */
function isBrowserRequest(req: Request): boolean {
  const accept = req.headers.accept || '';
  return (
    accept.includes('text/html') || 
    req.headers['sec-fetch-dest'] === 'document'
  );
}

/**
 * Detect if a request is coming from sdegdaefk.gr domain
 */
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

/**
 * Special handler for /auth and /auth/* paths
 */
export function authBrowserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Only intercept browser requests to auth endpoints
    if ((req.path === '/auth' || req.path.startsWith('/auth/')) && 
        (isBrowserRequest(req) || isFromSdegdaefkDomain(req))) {
      
      log(`[AuthBrowserHandler] Caught browser request to auth path: ${req.path}`, 'auth');
      
      // For browser requests, redirect to root instead of returning JSON errors
      // which would be displayed as plain text in the browser
      const redirectHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="0;url=/">
            <title>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
              h1 { color: #0066cc; }
              .info-box { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
              .btn { display: inline-block; background: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
            </style>
            <script>
              // Immediate redirect to homepage
              window.location.href = "/";
            </script>
          </head>
          <body>
            <h1>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</h1>
            <div class="info-box">
              <p>Ανακατεύθυνση στην αρχική σελίδα της εφαρμογής...</p>
              <p>Εάν δεν ανακατευθυνθείτε αυτόματα, παρακαλώ κάντε κλικ στο παρακάτω κουμπί:</p>
              <p><a class="btn" href="/">Μετάβαση στην αρχική σελίδα</a></p>
            </div>
          </body>
        </html>
      `;
      
      // Send HTML response for browser requests
      return res
        .status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        })
        .send(redirectHtml);
    }
    
    // For all other requests, continue to next middleware
    next();
  } catch (error: any) {
    log(`[AuthBrowserHandler] Error: ${error.message}`, 'error');
    next(); // Continue even on error
  }
}

export default authBrowserHandler;