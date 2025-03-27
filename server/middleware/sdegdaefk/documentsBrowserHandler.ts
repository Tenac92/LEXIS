/**
 * Special handler for /documents path when accessed directly via browser from sdegdaefk.gr
 * 
 * This middleware detects browser requests to the /documents path and redirects them
 * to the React SPA for proper handling, avoiding server-side 404 errors.
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { log } from '../../vite';

// Constants for detection
const DOCUMENTS_PATH = '/documents';
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
 * Middleware to handle browser requests to /documents path
 */
export function documentsBrowserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Only handle GET requests to /documents path or /documents/*
    const isDocumentsPath = req.path === DOCUMENTS_PATH || req.path.startsWith(`${DOCUMENTS_PATH}/`);
    
    // Log all requests to /documents for debugging
    if (isDocumentsPath) {
      log(`[SdegdaefkHandler] Received request for documents path: ${req.path}`, 'info');
      log(`[SdegdaefkHandler] Headers: ${JSON.stringify({
        accept: req.headers.accept,
        host: req.headers.host,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent'],
        'sec-fetch-dest': req.headers['sec-fetch-dest'],
        'sec-fetch-mode': req.headers['sec-fetch-mode']
      })}`, 'info');
    }
    
    if (req.method === 'GET' && isDocumentsPath) {
      // Check if this is a browser request or from sdegdaefk.gr
      const isBrowserReq = isBrowserRequest(req);
      const isFromDomain = isFromSdegdaefkDomain(req);
      
      log(`[SdegdaefkHandler] Path: ${req.path}, Browser request: ${isBrowserReq}, From sdegdaefk: ${isFromDomain}`, 'info');
      
      if (isBrowserReq || isFromDomain) {
        log(`[SdegdaefkHandler] Handling browser/domain request for: ${req.path}`, 'info');
        
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
            'Expires': '0',
            // Ensure proper CORS headers for sdegdaefk.gr domain
            'Access-Control-Allow-Origin': req.headers.origin || '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Type, X-Requested-With'
          })
          .send(html);
      }
    }
  } catch (error: any) {
    log(`[SdegdaefkHandler] Error handling document request: ${error.message}`, 'error');
    
    // Don't pass error to next middleware to prevent 500 errors
    // Instead, send a friendly error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ΣΔΕΓΔΑΕΦΚ - Σφάλμα συστήματος</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; }
            h1 { color: #c0392b; }
            p { margin: 15px 0; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .error-code { font-family: monospace; background: #f9f9f9; padding: 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>Προέκυψε ένα σφάλμα</h1>
          <p>Λυπούμαστε, αλλά προέκυψε ένα προσωρινό σφάλμα κατά την επεξεργασία του αιτήματός σας.</p>
          <p>Παρακαλώ επιστρέψτε στην <a href="/">αρχική σελίδα</a> και δοκιμάστε ξανά.</p>
          <p>Εάν το πρόβλημα παραμένει, επικοινωνήστε με την τεχνική υποστήριξη.</p>
          <p><span class="error-code">Κωδικός: DOC-ERR-500</span></p>
        </body>
      </html>
    `;
    
    return res
      .status(200) // Use 200 to ensure the error page is displayed
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Ensure proper CORS headers for sdegdaefk.gr domain
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      })
      .send(errorHtml);
  }
  
  // Not a browser request or not for /documents, continue to next middleware
  return next();
}

export default documentsBrowserHandler;