/**
 * Database Error Recovery Middleware
 * 
 * This middleware detects database errors, marks them, and attempts recovery
 * by resetting connections and testing connectivity.
 */

import { Request, Response, NextFunction } from 'express';
import { resetConnectionPoolIfNeeded, markFailedConnection, testConnection } from '../config/db';
import { log } from '../vite';

/**
 * Check if an error is related to database connectivity
 */
function isDatabaseError(err: any): boolean {
  if (!err) return false;
  
  // Check for common database error codes and messages
  const dbErrorCodes = ['28P01', '3D000', '08006', '08001', '08004', 'PGCONNECTION'];
  const dbErrorPatterns = [
    'database', 'db', 'connection', 'postgres', 'pg', 'supabase', 
    'timeout', 'connection refused', 'password authentication'
  ];
  
  // Check error code
  if (err.code && dbErrorCodes.includes(err.code)) {
    return true;
  }
  
  // Check error message
  if (err.message) {
    const message = err.message.toLowerCase();
    for (const pattern of dbErrorPatterns) {
      if (message.includes(pattern.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Middleware to detect database errors and attempt recovery
 */
export function databaseErrorRecoveryMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  if (isDatabaseError(err)) {
    log('[Database] Database error detected, initiating recovery procedure...', 'warn');
    
    // Mark the connection as failed
    markFailedConnection();
    
    // Reset connection pool if needed
    resetConnectionPoolIfNeeded();
    
    // Test the connection to see if it's now working
    testConnection(1)
      .then(success => {
        if (success) {
          log('[Database] Recovery successful - connection restored', 'info');
        } else {
          log('[Database] Recovery attempt failed - connection still down', 'error');
        }
      })
      .catch(testError => {
        log('[Database] Error during connection test: ' + testError.message, 'error');
      })
      .finally(() => {
        // Always continue to the next error handler
        // This middleware doesn't send a response, it just tries to recover
        next(err);
      });
  } else {
    // Not a database error, continue to next middleware
    next(err);
  }
}