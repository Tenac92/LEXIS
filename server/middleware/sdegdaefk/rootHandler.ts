/**
 * Special Root Request Handler for sdegdaefk.gr Domain
 * 
 * This middleware provides special handling for root path (/) requests
 * coming from the sdegdaefk.gr domain.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../vite';

/**
 * Detect if a request is from sdegdaefk.gr domain
 * @param req Express request object
 * @returns boolean indicating if request is from sdegdaefk.gr
 */
export function isFromSdegdaefkDomain(req: Request): boolean {
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
 * Root path handler for sdegdaefk.gr domain
 */
export function sdegdaefkRootHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (isFromSdegdaefkDomain(req)) {
      log(`[SdegdaefkRootHandler] Request from sdegdaefk.gr domain detected: ${req.originalUrl}`, 'info');
      
      // Special handling for direct access to root path
      if (req.originalUrl === '/' || req.originalUrl === '') {
        log('[SdegdaefkRootHandler] Root path access, passing to React app', 'info');
        // Continue to next middleware to serve the React app
        return next();
      }
      
      // For specific issues with browser requests to paths besides root
      if (req.headers.accept?.includes('text/html') && req.originalUrl !== '/') {
        log('[SdegdaefkRootHandler] Browser request to non-root path, redirecting to root', 'info');
        
        // Create redirect HTML with messaging
        const redirectHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta http-equiv="refresh" content="3;url=/">
              <title>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { color: #0066cc; }
                .info-box { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
                .btn { display: inline-block; background: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</h1>
              <div class="info-box">
                <p>Γίνεται ανακατεύθυνση στην αρχική σελίδα του συστήματος.</p>
                <p>Παρακαλώ περιμένετε...</p>
                <p><a class="btn" href="/">Επιστροφή στην αρχική σελίδα</a></p>
              </div>
              <p><small>Διαδρομή: ${req.originalUrl}</small></p>
            </body>
          </html>
        `;
        
        return res
          .status(200)
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          })
          .send(redirectHtml);
      }
    }
    
    // For all other cases, continue to the next middleware
    next();
  } catch (error: any) {
    log(`[SdegdaefkRootHandler] Error: ${error.message}`, 'error');
    next(); // Continue to next middleware even on error
  }
}

export default sdegdaefkRootHandler;