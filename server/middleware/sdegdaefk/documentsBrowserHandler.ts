/**
 * Special handler for direct browser requests to /documents from sdegdaefk.gr
 * 
 * This middleware fixes the 500 Internal Server Error when accessing
 * https://sdegdaefk.gr/documents directly from a browser.
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
 * Special handler for /documents path
 */
export function documentsBrowserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Only process if this is the /documents path specifically
    if (req.path === '/documents') {
      log(`[DocumentsHandler] Caught request to /documents path: ${req.method}`, 'documents');
      
      // Check if this is a browser request (HTML) from sdegdaefk.gr
      if (isBrowserRequest(req) || isFromSdegdaefkDomain(req)) {
        log(`[DocumentsHandler] Browser request from sdegdaefk.gr to /documents detected`, 'documents');
        
        // Create a user-friendly response with redirect
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta http-equiv="refresh" content="0;url=/">
              <title>ΣΔΕΓΔΑΕΦΚ - Έγγραφα</title>
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
              <h1>ΣΔΕΓΔΑΕΦΚ - Έγγραφα</h1>
              <div class="info-box">
                <p>Ανακατεύθυνση στην αρχική σελίδα της εφαρμογής...</p>
                <p>Εάν δεν ανακατευθυνθείτε αυτόματα, παρακαλώ κάντε κλικ στο παρακάτω κουμπί:</p>
                <p><a class="btn" href="/">Μετάβαση στην αρχική σελίδα</a></p>
              </div>
            </body>
          </html>
        `;
        
        // Send HTML response with appropriate headers
        return res
          .status(200)
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          })
          .send(html);
      }
    }
    
    // For all other requests, continue to next middleware
    next();
  } catch (error: any) {
    log(`[DocumentsHandler] Error: ${error.message}`, 'error');
    next(); // Continue even on error
  }
}

export default documentsBrowserHandler;