/**
 * Database Error Recovery Middleware
 * 
 * This middleware specifically intercepts database-related errors with code XX000
 * and attempts to recover by reconnecting to the database before proceeding.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { testConnection, pool } from '../config/db';

/**
 * A record of recent error recovery attempts to prevent infinite loops
 */
const recoveryAttempts = new Map<string, {
  count: number;
  lastAttempt: number;
}>();

/**
 * Maximum number of recovery attempts in a time window
 */
const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Time window for recovery attempts (in milliseconds)
 * 5 minutes = 300,000 ms
 */
const RECOVERY_WINDOW = 300000;

/**
 * Generates a unique key for the request to track recovery attempts
 */
function getRequestKey(req: Request): string {
  return `${req.method}:${req.path}:${req.ip}`;
}

/**
 * Check if we've exceeded recovery attempts for this request
 */
function canAttemptRecovery(key: string): boolean {
  const now = Date.now();
  const attempt = recoveryAttempts.get(key);
  
  // If no previous attempts or attempts were a long time ago, reset counter
  if (!attempt || (now - attempt.lastAttempt > RECOVERY_WINDOW)) {
    recoveryAttempts.set(key, { count: 1, lastAttempt: now });
    return true;
  }
  
  // If we've exceeded max attempts in the time window, don't try again
  if (attempt.count >= MAX_RECOVERY_ATTEMPTS) {
    return false;
  }
  
  // Increment the attempt counter
  attempt.count += 1;
  attempt.lastAttempt = now;
  recoveryAttempts.set(key, attempt);
  
  return true;
}

/**
 * Close all existing connections and attempt to reconnect
 */
async function reconnectDatabase(): Promise<boolean> {
  try {
    log('[DatabaseRecovery] Attempting to reconnect to database...', 'info');
    
    // Test if the database is still alive
    const isAlive = await testConnection(1, 0);
    
    if (isAlive) {
      log('[DatabaseRecovery] Database appears to still be connected', 'info');
      return true;
    }
    
    // Clear the connection pool to force new connections
    // This is a more aggressive approach when experiencing XX000 errors
    log('[DatabaseRecovery] Clearing connection pool and reconnecting...', 'info');
    await pool.end();
    
    // Wait a moment for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reconnect and verify with a test query
    log('[DatabaseRecovery] Attempting to reconnect to database...', 'info');
    const client = await pool.connect();
    await client.query('SELECT 1 AS recovery_test');
    client.release();
    
    log('[DatabaseRecovery] Successfully reconnected to database', 'info');
    return true;
  } catch (error) {
    log(`[DatabaseRecovery] Failed to reconnect: ${error}`, 'error');
    return false;
  }
}

/**
 * The actual error recovery middleware
 */
export async function databaseErrorRecoveryMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  // Only handle database errors with code XX000
  if (err.code !== 'XX000') {
    return next(err);
  }
  
  const requestKey = getRequestKey(req);
  
  log(`[DatabaseRecovery] Detected XX000 database error for ${req.method} ${req.path}`, 'error');
  
  // Check if we can attempt recovery
  if (!canAttemptRecovery(requestKey)) {
    log(`[DatabaseRecovery] Too many recovery attempts for ${requestKey}, proceeding to error handler`, 'error');
    return next(err);
  }
  
  // Attempt to recover the database connection
  const recoverySucceeded = await reconnectDatabase();
  
  if (!recoverySucceeded) {
    log(`[DatabaseRecovery] Recovery failed for ${requestKey}, proceeding to error handler`, 'error');
    return next(err);
  }
  
  // If recovery succeeded, retry the original request
  log(`[DatabaseRecovery] Recovered database connection, retrying ${req.method} ${req.path}`, 'info');
  
  // Special handling for sdegdaefk.gr domain requests
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  const isFromSdegdaefkDomain = 
    (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
    (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
    (typeof referer === 'string' && referer.includes('sdegdaefk.gr'));
  
  if (isFromSdegdaefkDomain) {
    log(`[DatabaseRecovery] Request from sdegdaefk.gr domain, redirecting to home page`, 'info');
    
    // For API requests, return a special recovery message with refresh code
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(209).json({
        status: 'recovered',
        message: 'Η σύνδεση με τη βάση δεδομένων αποκαταστάθηκε. Παρακαλώ ανανεώστε τη σελίδα.',
        action: 'refresh',
        path: '/'
      });
    }
    
    // For browser requests, redirect to the home page
    return res.redirect('/');
  }
  
  // For other requests, let Express handle them normally
  return next();
}

export default databaseErrorRecoveryMiddleware;