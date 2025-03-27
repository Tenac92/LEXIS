/**
 * Database Configuration Module
 * Centralizes database connection parameters and configuration
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

// PostgreSQL pool configuration
export const poolConfig = {
  connectionString: postgresUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout
  // Add these parameters to improve stability in high-load environments
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000, // 30 seconds initial delay
};

// Export pool instance for reuse across the application
export const pool = new Pool(poolConfig);

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

// Test database connection with enhanced error handling and retries
export async function testConnection(retries = 3, delay = 1000) {
  let attempt = 0;
  
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const attemptConnection = async (): Promise<boolean> => {
    try {
      attempt++;
      log(`[Database] Connection test attempt ${attempt}/${retries}`, 'info');
      
      // Test PostgreSQL connection with timeout protection
      const connectionPromise = pool.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );
      
      // Race between connection and timeout
      const pgClient = await Promise.race([connectionPromise, timeoutPromise]) as pg.PoolClient;
      
      // Test a simple query
      const pgResult = await pgClient.query('SELECT 1 AS pg_connection_test');
      pgClient.release();
      
      log('[Database] PostgreSQL connection successful', 'info');
      
      // Test Supabase connection if configured
      if (supabaseUrl && supabaseKey) {
        // First test with a lightweight query
        const { data: healthData, error: healthError } = await supabase
          .rpc('pg_health_check')
          .maybeSingle();
          
        if (healthError) {
          log(`[Database] Supabase health check failed: ${healthError.message}`, 'warn');
        }
        
        // Then try to access a table
        const { data: supabaseData, error: supabaseError } = await supabase
          .from('users')
          .select('count(*)', { count: 'exact', head: true })
          .limit(1);
        
        if (supabaseError) {
          throw new Error(`Supabase connection error: ${supabaseError.message} (Code: ${supabaseError.code})`);
        }
        
        log('[Database] Supabase connection successful', 'info');
      }
      
      return true;
    } catch (error: any) {
      const errorDetails = {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
        detail: error?.detail,
        hint: error?.hint,
        severity: error?.severity,
        position: error?.position,
      };
      
      log(`[Database] Connection test attempt ${attempt} failed: ${errorDetails.message} (${errorDetails.code})`, 'error');
      console.error('[Database] Connection test failed:', errorDetails);
      
      // If we have retries left, wait and try again
      if (attempt < retries) {
        log(`[Database] Retrying connection in ${delay}ms...`, 'info');
        await sleep(delay);
        return attemptConnection();
      }
      
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