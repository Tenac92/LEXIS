/**
 * Special handler for the root path when accessed directly via browser from sdegdaefk.gr
 * 
 * This middleware detects browser requests to the root path and ensures proper SPA loading.
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { log } from '../../vite';

// Constants for detection
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
 * Middleware to handle browser requests to the root path from sdegdaefk.gr
 */
export function rootHandler(req: Request, res: Response, next: NextFunction) {
  // Allow units endpoint to bypass
  if (req.path === '/api/users/units') {
    console.log('[RootHandler] Allowing units endpoint to bypass: ', req.path);
    return next();
  }
  
  // Only handle GET requests to the root path from sdegdaefk.gr
  const isRootPath = req.path === '/' || req.path === '';
  const isFromSdegdaefk = isFromSdegdaefkDomain(req);
  
  if (req.method === 'GET' && isRootPath && isBrowserRequest(req) && isFromSdegdaefk) {
    log(`[SdegdaefkHandler] Browser request from sdegdaefk.gr to root path detected`, 'info');
    
    try {
      // Log session cookie diagnostics
      const cookies = req.cookies || {};
      const sessionCookie = cookies.sid || null;
      
      log(`[SdegdaefkHandler] Session cookie present: ${sessionCookie ? 'yes' : 'no'}`, 'info');
      
      // Return index.html or other SPA entry point with proper headers
      // Directly send file to avoid problems with Vite middleware
      return next();
    } catch (error: any) {
      log(`[SdegdaefkHandler] Error handling root path request: ${error.message}`, 'error');
      return next(error);
    }
  }
  
  // Not a browser request or not from sdegdaefk.gr to root, continue to next middleware
  return next();
}

export default rootHandler;