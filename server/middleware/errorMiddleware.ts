/**
 * Global Error Handling Middleware
 * 
 * This middleware catches unhandled errors throughout the application,
 * formats them appropriately for the client, and logs them for debugging.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

// Determine the client type for better error responses
type ClientType = 'browser' | 'api' | 'unknown';

function isBrowserRequest(req: Request): boolean {
  const accept = req.headers.accept || '';
  return accept.includes('text/html') || 
    req.headers['sec-fetch-dest'] === 'document' ||
    req.headers['sec-fetch-mode'] === 'navigate';
}

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

function getClientType(req: Request): ClientType {
  if (isBrowserRequest(req)) {
    return 'browser';
  } else if (req.headers['accept'] && 
            (req.headers['accept'].includes('application/json') || 
             req.xhr)) {
    return 'api';
  }
  
  return 'unknown';
}

// Handle specific Postgres error codes with appropriate messages
function handlePostgresError(code: string): {
  status: number;
  userMessage: string;
  logMessage: string;
} {
  switch (code) {
    case '23505': // Unique violation
      return {
        status: 409, // Conflict
        userMessage: 'Παραβίαση μοναδικότητας στοιχείων. Τα δεδομένα που εισάγατε υπάρχουν ήδη στη βάση.',
        logMessage: 'Unique constraint violation (23505)'
      };
    case '23503': // Foreign key violation
      return {
        status: 409, // Conflict
        userMessage: 'Σφάλμα αναφορικής ακεραιότητας. Αδυναμία ενημέρωσης ή διαγραφής εγγραφής λόγω εξαρτήσεων.',
        logMessage: 'Foreign key constraint violation (23503)'
      };
    case '42P01': // Undefined table
      return {
        status: 500, // Internal Server Error
        userMessage: 'Σφάλμα διακομιστή. Επικοινωνήστε με τον διαχειριστή του συστήματος.',
        logMessage: 'Undefined table error (42P01)'
      };
    case 'XX000': // Internal server error
      return {
        status: 500, // Internal Server Error
        userMessage: 'Σφάλμα βάσης δεδομένων. Παρακαλούμε ανανεώστε τη σελίδα και προσπαθήστε ξανά.',
        logMessage: 'Internal PostgreSQL error (XX000)'
      };
    default:
      return {
        status: 500, // Internal Server Error
        userMessage: 'Σφάλμα βάσης δεδομένων. Παρακαλούμε δοκιμάστε ξανά αργότερα.',
        logMessage: `Database error (${code})`
      };
  }
}

// Create HTML error page for browser clients
function createErrorHtml(req: Request, error: any, status: number): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const isFromSdegdaefk = isFromSdegdaefkDomain(req);
  const errorCode = error.code || 'UNKNOWN';
  
  // Sanitize the error message for display
  let safeMessage = 'An unexpected server error occurred.';
  let detailedInfo = '';
  
  if (error instanceof Error) {
    safeMessage = error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Only in development or for specific request paths show stack trace
    if (isDev) {
      detailedInfo = (error.stack || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    }
  }
  
  // Set user-friendly message in Greek for sdegdaefk.gr domain
  let userMessage = 'Παρουσιάστηκε σφάλμα στον διακομιστή.';
  
  // For database errors, get a more specific message
  if (errorCode.match(/^[0-9]{5}$/) || errorCode === 'XX000') {
    const dbError = handlePostgresError(errorCode);
    userMessage = dbError.userMessage;
  } else if (status === 401) {
    userMessage = 'Δεν έχετε συνδεθεί ή η συνεδρία σας έχει λήξει. Παρακαλώ συνδεθείτε ξανά.';
  } else if (status === 403) {
    userMessage = 'Δεν έχετε επαρκή δικαιώματα για την πρόσβαση στη συγκεκριμένη σελίδα.';
  } else if (status === 404) {
    userMessage = 'Η σελίδα που ζητήσατε δεν βρέθηκε.';
  }
  
  // Create appropriate HTML response
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>ΣΔΕΓΔΑΕΦΚ - Σφάλμα ${status}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #d81e06; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          .error-box { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .status { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
          .message { margin-bottom: 15px; font-size: 16px; }
          .detail { background-color: #f1f1f1; padding: 10px; overflow-x: auto; margin-top: 20px; }
          .actions { margin-top: 25px; }
          .btn { display: inline-block; background: #2980b9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
          .btn:hover { background: #3498db; }
          .btn-warning { background: #d81e06; }
          .btn-warning:hover { background: #e74c3c; }
          .tech-details { margin-top: 30px; font-size: 0.9em; color: #777; border-top: 1px solid #eee; padding-top: 15px; }
          pre { white-space: pre-wrap; font-family: monospace; font-size: 14px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <h1>Σφάλμα Διακομιστή</h1>
        <div class="error-box">
          <div class="status">Κωδικός κατάστασης: ${status}</div>
          <div class="message">${userMessage}</div>
          
          ${isDev && detailedInfo ? `
          <div class="detail">
            <pre>${detailedInfo}</pre>
          </div>
          ` : ''}
        </div>
        
        <div class="actions">
          <a href="/" class="btn">Επιστροφή στην αρχική σελίδα</a>
          ${isDev || isFromSdegdaefk ? 
          `<button onclick="window.location.reload()" class="btn btn-warning">Ανανέωση σελίδας</button>` : 
          ''}
        </div>
        
        ${isDev ? `
        <div class="tech-details">
          <p>Τεχνικές λεπτομέρειες για αποσφαλμάτωση:</p>
          <ul>
            <li>Error code: ${errorCode}</li>
            <li>Error message: ${safeMessage}</li>
            <li>Request path: ${req.originalUrl || req.url}</li>
            <li>Request method: ${req.method}</li>
            <li>From sdegdaefk.gr: ${isFromSdegdaefk ? 'Yes' : 'No'}</li>
            <li>Host: ${req.headers.host || 'unknown'}</li>
            <li>Origin: ${req.headers.origin || 'none'}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
        </div>
        ` : ''}
      </body>
    </html>
  `;
}

// Error middleware implementation
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  // Default error status and messages
  let status = err.status || err.statusCode || 500;
  let errorMessage = err.message || 'Internal Server Error';
  const errorCode = err.code || 'UNKNOWN';
  
  // If this is a postgres error with a code, handle it specifically
  let dbErrorDetails: null | {status: number; userMessage: string; logMessage: string;} = null;
  
  if (errorCode.match(/^[0-9]{5}$/) || errorCode === 'XX000') {
    dbErrorDetails = handlePostgresError(errorCode);
    status = dbErrorDetails.status;
    
    // Enhance logger with database error info
    log(`[Error] Database error ${dbErrorDetails.logMessage}: ${errorMessage}`, 'error');
  } else {
    // Regular error logging
    log(`[Error] ${status} error for ${req.method} ${req.path}: ${errorMessage}`, 'error');
    console.error(`[Error Handler] ${err.stack || err}`);
  }
  
  // Determine client type for appropriate response format
  const clientType = getClientType(req);
  
  // Handle based on client type
  if (clientType === 'browser') {
    // Send HTML response for browser clients
    return res
      .status(status)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(createErrorHtml(req, err, status));
  } else {
    // Send JSON for API clients
    return res.status(status).json({
      status: 'error',
      message: dbErrorDetails ? dbErrorDetails.userMessage : errorMessage,
      code: errorCode,
      path: req.path
    });
  }
}

export default errorMiddleware;