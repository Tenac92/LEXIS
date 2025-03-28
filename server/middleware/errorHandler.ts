/**
 * Enhanced Error Handling Middleware
 * 
 * This middleware provides comprehensive error handling for the application,
 * with special focus on Supabase and database connection issues.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { markFailedConnection, testConnection } from '../config/db';

interface ErrorWithCode extends Error {
  code?: string;
  status?: number;
  supabaseError?: boolean;
}

/**
 * Determines if an error is related to a database connection issue
 * 
 * @param error The error to check
 * @returns true if the error is a database connection issue
 */
function isDatabaseConnectionError(error: ErrorWithCode): boolean {
  // Common database connection errors
  const connectionErrorCodes = [
    'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH',
    'connection_error', 'socket_closed', 'socket_hang_up', 'ECONNRESET',
    '28P01', // Postgres authentication errors
    '28000', // Invalid auth specification
    '3D000', // Database does not exist
    '57P01', // Database shut down
    '57P02', // Database connection interrupted
    '57P03', // Cannot connect now
    '08006', // Connection failed
    '08001', // SQL client unable to establish connection
    '08004', // Server rejected the connection
    'PGCONNECTION', // Generic Postgres connection error
    '40P01', // Deadlock detected
    'connection_closed', // Supabase specific connection error
    'pool_timeout', // Connection pool timeout
  ];
  
  // Check for common connection error patterns in the message or code
  const connectionErrorPatterns = [
    'connection', 'timeout', 'timed out', 'could not connect',
    'database connection', 'postgres connection', 'socket', 'connect ECONNREFUSED',
    'network error', 'EOF', 'end of file', 'terminated', 'closed', 'unable to connect',
    'unavailable', 'unreachable', 'broken pipe', 'access denied', 'authentication failed',
    'supabase', 'password authentication', 'pg client',
  ];
  
  // Check error code
  if (error.code && connectionErrorCodes.includes(error.code)) {
    return true;
  }
  
  // Check error message patterns
  if (error.message) {
    const lowerCaseMessage = error.message.toLowerCase();
    for (const pattern of connectionErrorPatterns) {
      if (lowerCaseMessage.includes(pattern.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Supabase-specific flag
  if (error.supabaseError) {
    return true;
  }
  
  return false;
}

/**
 * Main error handler middleware
 */
export function errorHandler(err: ErrorWithCode, req: Request, res: Response, _next: NextFunction) {
  // Log the error for debugging
  console.error('[Error Handler] Caught error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status
  });
  
  let statusCode = err.status || 500;
  let errorMessage = err.message || 'Internal Server Error';
  let userMessage = 'Σφάλμα εφαρμογής. Παρακαλώ προσπαθήστε ξανά σε λίγο.';
  
  // Special handling for database connection errors
  if (isDatabaseConnectionError(err)) {
    console.warn('[Error Handler] Database connection error detected');
    
    // Mark the connection as failed for health monitoring
    markFailedConnection();
    
    // Test the connection in the background
    testConnection(1, 5000).catch(() => {
      // Ignore any errors - we're already handling an error
    });
    
    // Database errors should always be internal server errors
    statusCode = 503;
    userMessage = 'Η βάση δεδομένων δεν είναι προσωρινά διαθέσιμη. Παρακαλώ προσπαθήστε ξανά σε λίγο.';
    
    // Add more specific error messages for common errors
    if (err.message && err.message.includes('password authentication')) {
      userMessage = 'Σφάλμα ταυτοποίησης στη βάση δεδομένων. Παρακαλώ επικοινωνήστε με τον διαχειριστή.';
    } else if (err.message && err.message.toLowerCase().includes('limit')) {
      userMessage = 'Υπέρβαση ορίου σύνδεσης βάσης δεδομένων. Παρακαλώ προσπαθήστε ξανά σε λίγο.';
    }
  }
  
  // Special handling for authentication errors
  if (err.message && err.message.includes('Authentication')) {
    statusCode = 401;
    userMessage = 'Απαιτείται σύνδεση για αυτή την ενέργεια. Παρακαλώ συνδεθείτε και προσπαθήστε ξανά.';
  }
  
  // Special handling for not found errors 
  if (statusCode === 404 || (err.message && err.message.includes('not found'))) {
    statusCode = 404;
    userMessage = 'Δεν βρέθηκε η ζητούμενη πληροφορία ή πόρος.';
  }
  
  // API endpoints get JSON response
  if (req.path.startsWith('/api') || req.accepts('json')) {
    return res.status(statusCode).json({
      error: true,
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
  
  // All other requests get HTML response
  const htmlErrorMessage = `
    <html>
      <head>
        <title>Σφάλμα Εφαρμογής</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 2rem;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.5;
          }
          h1 { color: #e53e3e; }
          .error-box {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 1rem;
            margin: 1rem 0;
          }
          .back-button {
            display: inline-block;
            background-color: #4299e1;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <h1>Σφάλμα Εφαρμογής</h1>
        <p>${userMessage}</p>
        <div class="error-box">
          <p>Κωδικός σφάλματος: ${statusCode}</p>
          ${process.env.NODE_ENV === 'development' ? `<p>Λεπτομέρειες: ${errorMessage}</p>` : ''}
        </div>
        <a href="/" class="back-button">Επιστροφή στην αρχική σελίδα</a>
      </body>
    </html>
  `;
  
  return res.status(statusCode).send(htmlErrorMessage);
}

/**
 * Async error handler wrapper
 * Catches errors in async route handlers and forwards them to the error handler
 * 
 * @example
 * app.get('/api/data', asyncHandler(async (req, res) => {
 *   // Your async code here
 * }));
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Export single middleware function to wrap routes with error handling
 * This uses both async handling and applies the error handler middleware
 */
export function withErrorHandling(app: any) {
  return {
    get: (path: string, handler: Function) => app.get(path, asyncHandler(handler)),
    post: (path: string, handler: Function) => app.post(path, asyncHandler(handler)),
    put: (path: string, handler: Function) => app.put(path, asyncHandler(handler)),
    delete: (path: string, handler: Function) => app.delete(path, asyncHandler(handler)),
    patch: (path: string, handler: Function) => app.patch(path, asyncHandler(handler)),
  };
}