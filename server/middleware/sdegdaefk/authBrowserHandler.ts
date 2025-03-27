/**
 * Special handler for /auth path when accessed directly via browser from sdegdaefk.gr
 * 
 * This middleware detects browser requests to the /auth path and redirects them
 * to the React SPA for proper handling, avoiding server-side 404 errors.
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { log } from '../../vite';

// Constants for detection
const AUTH_PATH = '/auth';
const BROWSER_MARKERS = ['text/html', 'application/xhtml+xml'];

// Helper to detect browser requests
function isBrowserRequest(req: Request): boolean {
  const accept = req.headers.accept || '';
  // Check for browser content types in accept header
  const wantsBrowserContent = BROWSER_MARKERS.some(marker => accept.includes(marker));
  
  // Check for browser-specific headers
  const hasBrowserHeaders = req.headers['sec-fetch-dest'] === 'document' || 
                         req.headers['sec-fetch-mode'] === 'navigate';
  
  return wantsBrowserContent || hasBrowserHeaders;
}

// Helper to detect if request came from sdegdaefk.gr
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
 * Middleware to handle browser requests to /auth path
 */
export function authBrowserHandler(req: Request, res: Response, next: NextFunction) {
  // Only handle GET requests to /auth path or /auth/*
  const isAuthPath = req.path === AUTH_PATH || req.path.startsWith(`${AUTH_PATH}/`);
  
  if (req.method === 'GET' && isAuthPath && isBrowserRequest(req)) {
    log(`[SdegdaefkHandler] Browser request detected for auth: ${req.path}`, 'info');
    
    try {
      // Instead of trying to directly serve the file which might not exist yet,
      // return a redirect HTML that will take the user to the homepage
      log(`[SdegdaefkHandler] Redirecting browser request for auth: ${req.path}`, 'info');
      
      // Create an HTML response with a client-side redirect
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="0;url=/">
            <title>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</title>
            <script>
              // Try to use the history API if available to maintain a cleaner navigation
              if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '/');
              }
              window.location.href = '/';
            </script>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; }
              h1 { color: #1a5276; }
              p { margin: 15px 0; }
              a { color: #3498db; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>Ανακατεύθυνση...</h1>
            <p>Παρακαλώ περιμένετε καθώς ανακατευθύνεστε στην αρχική σελίδα της εφαρμογής.</p>
            <p>Εάν δεν ανακατευθυνθείτε αυτόματα, <a href="/">πατήστε εδώ</a>.</p>
          </body>
        </html>
      `;
      
      return res
        .status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        })
        .send(html);
    } catch (error: any) {
      log(`[SdegdaefkHandler] Error handling auth browser request: ${error.message}`, 'error');
      return next(error);
    }
  }
  
  // Not a browser request or not for /auth, continue to next middleware
  return next();
}

export default authBrowserHandler;