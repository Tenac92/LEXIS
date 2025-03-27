/**
 * Database Configuration Module
 * Centralizes database connection parameters and configuration for all database access in the application
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { log } from '../vite';
import type { Database } from '@shared/schema';

const { Pool } = pg;

// Custom PostgreSQL error type extension
interface PostgresError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
  position?: string;
  severity?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

// Get database connection parameters from environment variables
const postgresUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Validate required config
if (!postgresUrl) {
  log('[Database] DATABASE_URL environment variable is required', 'error');
}

if (supabaseUrl && !supabaseKey) {
  log('[Database] SUPABASE_KEY or SUPABASE_ANON_KEY is required when SUPABASE_URL is provided', 'error');
}

// PostgreSQL pool configuration with enhanced resilience
export const poolConfig = {
  connectionString: postgresUrl,
  max: 20,                           // Increased to handle more concurrent connections
  min: 2,                            // Ensure some connections are always ready
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,    // Increased timeout for slower networks
  // Add these parameters to improve stability in high-load environments
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000, // 30 seconds initial delay
  statement_timeout: 30000,           // 30 second query timeout
  query_timeout: 30000,               // 30 second query timeout
  // Error handling behavior
  application_name: 'sdegdaefk-app',  // For identifying connections in logs
  // Connection validation with frequency doubled
  clientConnectionParamProps: { options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000' },
};

// Create and export the connection pool
export const pool = new Pool(poolConfig);

// Add connection acquisition timeout tracking 
let lastPoolReset = Date.now();
const POOL_RESET_INTERVAL = 3600000; // 1 hour

// Function to recreate the pool if needed
export function resetConnectionPoolIfNeeded() {
  const now = Date.now();
  if (now - lastPoolReset > POOL_RESET_INTERVAL) {
    log('[Database] Performing scheduled connection pool reset', 'info');
    try {
      pool.end().catch(err => {
        log(`[Database] Error ending pool during reset: ${err.message}`, 'error');
      });
      
      // Create a new pool with the same config
      const newPool = new Pool(poolConfig);
      Object.assign(pool, newPool);
      
      lastPoolReset = now;
      log('[Database] Connection pool reset successfully', 'info');
    } catch (error: any) {
      log(`[Database] Failed to reset connection pool: ${error.message}`, 'error');
    }
  }
}

// Initialize connection error handling with enhanced logging
pool.on('error', (err: Error) => {
  const pgError = err as PostgresError;
  const errorCode = pgError.code || 'UNKNOWN';
  const errorMessage = pgError.message || 'Unknown database error';
  
  log(`[Database] PostgreSQL pool error: ${errorCode} - ${errorMessage}`, 'error');
  console.error('[Database] PostgreSQL pool error:', {
    code: errorCode,
    message: errorMessage,
    detail: pgError.detail,
    hint: pgError.hint,
    position: pgError.position,
    severity: pgError.severity
  });
  
  // Log if this is a connection error that might require reconnection
  if (errorCode.startsWith('08') || errorCode === 'XX000') {
    log('[Database] This appears to be a connection error, consider reconnecting', 'error');
  }
});

// Client Error Handler - Enhance error handling for individual clients from the pool
pool.on('connect', (client) => {
  client.on('error', (err: Error) => {
    const pgError = err as PostgresError;
    log(`[Database] Client connection error: ${pgError.code || 'UNKNOWN'} - ${pgError.message}`, 'error');
  });

  client.on('notice', (notice) => {
    log(`[Database] Notice: ${notice.name} - ${notice.message}`, 'info');
  });
});

// Create and export Supabase client
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  }
);

// Helper utility for timing operations
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test database connection with enhanced error handling and retries
 * @param retries Number of retry attempts
 * @param timeoutMs Timeout in milliseconds for each attempt
 * @returns Promise resolving to boolean indicating connection success
 */
export async function testConnection(retries = 3, timeoutMs = 5000): Promise<boolean> {
  let attempt = 0;
  
  // Explicitly check for pool reset need
  resetConnectionPoolIfNeeded();
  
  // Execute a safe, quick query to test the database
  const attemptConnection = async (): Promise<boolean> => {
    try {
      attempt++;
      log(`[Database] Connection test attempt ${attempt}/${retries}`, 'info');
      
      // Create a client with explicit timeout
      const connectionPromise = pool.connect();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs)
      );
      
      // Race between connection acquisition and timeout
      let pgClient: pg.PoolClient;
      try {
        pgClient = await Promise.race([connectionPromise, timeoutPromise]) as pg.PoolClient;
      } catch (connErr: any) {
        throw new Error(`Failed to acquire connection: ${connErr.message}`);
      }
      
      try {
        // Run connection test query with row count validation
        const pgResult = await pgClient.query('SELECT 1 AS pg_connection_test');
        
        // Validate query actually returned a result
        if (!pgResult || !pgResult.rows || pgResult.rows.length === 0) {
          throw new Error('Query succeeded but returned no results');
        }
        
        // Additional health check query
        const healthResult = await pgClient.query(`
          SELECT 
            current_setting('server_version') as version,
            current_setting('max_connections') as max_connections,
            (SELECT count(*) FROM pg_stat_activity) as active_connections
        `);
        
        const dbInfo = healthResult.rows[0];
        log(`[Database] PostgreSQL version: ${dbInfo.version}, Connections: ${dbInfo.active_connections}/${dbInfo.max_connections}`, 'info');
        
        // Check if we're approaching connection limits
        const connectionUsage = parseInt(dbInfo.active_connections) / parseInt(dbInfo.max_connections);
        if (connectionUsage > 0.8) {
          log(`[Database] WARNING: High connection usage (${Math.round(connectionUsage * 100)}%)`, 'warn');
        }
      } catch (queryErr: any) {
        // Make sure to release the client even if query fails
        pgClient.release(true); // Release with error flag
        throw queryErr;
      }
      
      // Release the client back to the pool
      pgClient.release();
      
      log('[Database] PostgreSQL connection successfully verified', 'info');
      
      // Test Supabase connection if configured
      if (supabaseUrl && supabaseKey) {
        try {
          // First test with a lightweight query that doesn't require auth
          const { data: healthData, error: healthError } = await supabase
            .from('users')
            .select('count(*)', { count: 'exact', head: true });
            
          if (healthError) {
            log(`[Database] Supabase connection warning: ${healthError.message}`, 'warn');
            // Don't fail the whole test if only Supabase has issues
          } else {
            log('[Database] Supabase connection successful', 'info');
          }
        } catch (supabaseErr: any) {
          log(`[Database] Supabase test error: ${supabaseErr.message}`, 'warn');
          // Don't fail the whole test if only Supabase has issues
        }
      }
      
      return true;
    } catch (error: any) {
      // Extract as many error details as possible
      const errorDetails = {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
        detail: error?.detail,
        hint: error?.hint,
        severity: error?.severity,
        position: error?.position,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace',
      };
      
      log(`[Database] Connection test attempt ${attempt} failed: ${errorDetails.message} (${errorDetails.code})`, 'error');
      console.error('[Database] Connection test error details:', errorDetails);
      
      // Increase delay exponentially with each retry (backoff strategy)
      const currentDelay = Math.min(30000, Math.pow(2, attempt) * 1000);
      
      // If we have retries left, wait and try again
      if (attempt < retries) {
        log(`[Database] Retrying connection in ${currentDelay}ms (attempt ${attempt+1}/${retries})...`, 'info');
        await sleep(currentDelay);
        return attemptConnection();
      }
      
      // After all retries, log additional diagnostic info
      log('[Database] All connection attempts failed. Database might be down or unreachable.', 'error');
      
      return false;
    }
  };
  
  return attemptConnection();
}

// Close all database connections
export async function closeConnections() {
  await pool.end();
  log('[Database] All database connections closed', 'info');
}