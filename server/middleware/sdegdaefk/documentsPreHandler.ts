/**
 * Special handler for document requests from sdegdaefk.gr domain
 * 
 * This middleware intercepts document requests from sdegdaefk.gr domain
 * before they are processed, checks the database connection status,
 * and returns appropriate responses if database issues are detected.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../vite';
import { testConnection } from '../../config/db';

/**
 * Helper function to determine if a request is from the sdegdaefk.gr domain
 */
function isFromSdegdaefkDomain(req: Request): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Check if this is from sdegdaefk.gr domain
  return (
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr'))
  );
}

// Track database health status
let lastDbCheck = 0;
let isDbHealthy = true;
const DB_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Check database health with cache to avoid checking on every request
 */
async function checkDatabaseHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Use cached value if checked recently
  if (now - lastDbCheck < DB_CHECK_INTERVAL) {
    return isDbHealthy;
  }
  
  // Update the check time regardless of outcome
  lastDbCheck = now;
  
  try {
    // Test database connection with a short timeout
    const connectionStatus = await testConnection(1, 1000);
    isDbHealthy = connectionStatus;
    return connectionStatus;
  } catch (error) {
    log(`[DocumentsPreHandler] Database health check failed: ${error}`, 'error');
    isDbHealthy = false;
    return false;
  }
}

/**
 * Send a helpful error message for document requests during database issues
 */
function sendFriendlyDbErrorResponse(req: Request, res: Response): void {
  // For API requests, return a structured error response
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    res.status(200).json({
      status: 'error',
      loginRequired: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Η βάση δεδομένων δεν είναι διαθέσιμη αυτή τη στιγμή. Παρακαλούμε δοκιμάστε ξανά σε λίγο.',
      },
      redirectUrl: '/'
    });
    return;
  }
  
  // For browser requests, show an HTML error page with retry options
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="el">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Προσωρινά Μη Διαθέσιμο</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: center; }
        .error-container { max-width: 600px; margin: 100px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        h1 { color: #d32f2f; }
        .buttons { margin-top: 30px; }
        .button { display: inline-block; margin: 0 10px; padding: 10px 20px; background-color: #1976d2; color: white; 
          text-decoration: none; border-radius: 4px; }
        .button.secondary { background-color: #757575; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>Προσωρινά Μη Διαθέσιμο</h1>
        <p>Το σύστημα είναι προσωρινά μη διαθέσιμο λόγω εργασιών συντήρησης στη βάση δεδομένων.</p>
        <p>Παρακαλούμε δοκιμάστε ξανά σε λίγα λεπτά.</p>
        <div class="buttons">
          <a href="/" class="button">Επιστροφή στην αρχική σελίδα</a>
          <a href="javascript:window.location.reload()" class="button secondary">Ανανέωση σελίδας</a>
        </div>
      </div>
    </body>
    </html>
  `);
}

/**
 * Middleware to preemptively handle document requests when database issues are detected
 */
export async function documentsPreHandler(req: Request, res: Response, next: NextFunction) {
  // Allow /api/users/units to bypass this handler
  if (req.path === '/api/users/units') {
    console.log('[DocumentsPreHandler] Allowing units endpoint to bypass authentication');
    return next();
  }
  
  // Only process requests from sdegdaefk.gr domain related to documents
  if (!isFromSdegdaefkDomain(req) || !(req.path.startsWith('/documents') || req.path.includes('document'))) {
    return next();
  }
  
  log(`[DocumentsPreHandler] Handling request from sdegdaefk.gr to ${req.path}`, 'info');
  
  // Check database health
  const isDatabaseHealthy = await checkDatabaseHealth();
  
  // If database is unhealthy, return a friendly error response
  if (!isDatabaseHealthy) {
    log(`[DocumentsPreHandler] Database is unhealthy, sending friendly error for ${req.path}`, 'error');
    sendFriendlyDbErrorResponse(req, res);
    return;
  }
  
  // If database is healthy, proceed with the request
  next();
}

export default documentsPreHandler;