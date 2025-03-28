/**
 * Database Configuration Module
 * Centralizes database connection parameters and configuration for all database access in the application
 * FULLY MIGRATED TO SUPABASE - All database operations now use Supabase exclusively
 */

import { createClient } from '@supabase/supabase-js';
import { log } from '../vite';
import type { Database } from '@shared/schema';

// Custom Error types
interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
}

// Get database connection parameters from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Validate required config
if (!supabaseUrl || !supabaseKey) {
  log('[Database] SUPABASE_URL and SUPABASE_KEY/SUPABASE_ANON_KEY environment variables are required', 'error');
  throw new Error('Supabase configuration is missing. Please set the SUPABASE_URL and SUPABASE_KEY environment variables.');
}

// Create and export Supabase client with enhanced configuration
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-application-name': 'sdegdaefk-app'
      },
    },
    // Add more resilient network settings
    realtime: {
      params: {
        eventsPerSecond: 5,
      },
    },
  }
);

// Create a custom client for health checks to avoid interfering with main operations
export const healthCheckClient = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-application-name': 'sdegdaefk-app-healthcheck'
      },
    },
  }
);

// Helper utility for timing operations
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// For compatibility with existing code that expects a pool object
export const pool = {
  connect: async () => {
    throw new Error('Direct PostgreSQL connections are no longer supported. Use Supabase client instead.');
  },
  query: async () => {
    throw new Error('Direct PostgreSQL queries are no longer supported. Use Supabase client instead.');
  },
  end: async () => {
    log('[Database] PostgreSQL pool is no longer used. No connections to close.', 'info');
    return Promise.resolve();
  }
};

// Compatibility export to maintain API compatibility
export const poolConfig = {
  // This is just a placeholder to avoid breaking existing code
};

/**
 * Test database connection with enhanced error handling and retries
 * @param retries Number of retry attempts
 * @param timeoutMs Timeout in milliseconds for each attempt
 * @returns Promise resolving to boolean indicating connection success
 */
export async function testConnection(retries = 3, timeoutMs = 5000): Promise<boolean> {
  let retriesLeft = retries;
  let lastError: Error | null = null;
  
  console.log('[Database] Testing connection with Supabase URL:', supabaseUrl);
  
  // Create a promise with timeout
  const timeoutPromise = (ms: number): Promise<never> => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout exceeded')), ms);
    });
  };
  
  while (retriesLeft > 0) {
    try {
      console.log(`[Database] Connection attempt ${retries - retriesLeft + 1}/${retries}`);
      
      // First check basic auth connection
      console.log('[Database] Testing authentication endpoint...');
      const authTest = await Promise.race([
        healthCheckClient.auth.getSession(),
        timeoutPromise(timeoutMs / 2)
      ]);
      
      if (authTest.error) {
        console.error('[Database] Auth endpoint error:', authTest.error);
        throw authTest.error;
      }
      
      console.log('[Database] Auth endpoint is accessible');
      
      // Then check database access
      console.log('[Database] Testing database access...');
      const dbTest = await Promise.race([
        healthCheckClient.from('users').select('id').limit(1),
        timeoutPromise(timeoutMs / 2)
      ]);
      
      if (dbTest.error) {
        console.error('[Database] Query error:', dbTest.error);
        throw dbTest.error;
      }
      
      log('[Database] Supabase connection successfully verified', 'info');
      console.log('[Database] Connection test result:', { 
        data: dbTest.data, 
        count: dbTest.data?.length || 0
      });
      
      // Mark this as a successful connection for our health monitoring
      markSuccessfulConnection();
      
      return true;
    } catch (err: any) {
      lastError = err;
      console.error(`[Database] Connection test failed (${retriesLeft} retries left)`);
      
      // Add detailed error logging
      console.error('[Database] Error message:', err.message);
      
      // Structured error logging based on error type
      if (err.code || err.details || err.hint || err.status) {
        console.error('[Database] Error details:', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
          status: err.status,
          statusText: err.statusText
        });
      }
      
      // Only log stack in development to avoid sensitive info in production
      if (err.stack && process.env.NODE_ENV !== 'production') {
        console.error('[Database] Error stack:', err.stack);
      }
      
      // Mark this failed connection for health monitoring
      markFailedConnection();
      
      // Decrease retries and wait before next attempt with exponential backoff
      retriesLeft--;
      if (retriesLeft > 0) {
        // Calculate backoff with some randomness (jitter) to prevent thundering herd
        const jitter = Math.floor(Math.random() * 500);
        const backoffTime = Math.min(2000 * (retries - retriesLeft) + jitter, 10000);
        console.log(`[Database] Retrying in ${backoffTime}ms...`);
        await sleep(backoffTime);
      }
    }
  }
  
  // If we got here, all retries failed
  console.error('[Database] All connection attempts failed');
  if (lastError) {
    console.error('[Database] Last error:', lastError.message);
  }
  return false;
}

// Track last successful connection time for health monitoring
let lastSuccessfulConnection = Date.now();
let connectionErrors = 0;
const MAX_ERRORS_BEFORE_RESET = 3;

/**
 * Resets Supabase connection if needed by creating a new healthcheck client
 * This helps recover from connection issues or stale connections
 */
export function resetConnectionPoolIfNeeded() {
  const currentTime = Date.now();
  const timeSinceLastSuccess = currentTime - lastSuccessfulConnection;
  
  // If we've had too many errors or it's been too long since last success
  if (connectionErrors >= MAX_ERRORS_BEFORE_RESET || timeSinceLastSuccess > 30 * 60 * 1000) {
    log('[Database] Resetting Supabase connection due to errors or timeout', 'info');
    
    try {
      // Ensure we have valid credentials
      if (!supabaseUrl || !supabaseKey) {
        log('[Database] Cannot reset connection - missing credentials', 'error');
        return false;
      }
      
      // Reset the health check client by creating a new one
      const newHealthCheckClient = createClient(
        supabaseUrl,
        supabaseKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              'x-application-name': 'sdegdaefk-app-healthcheck-reset'
            },
          },
        }
      );
      
      // Replace the existing client
      Object.keys(newHealthCheckClient).forEach(key => {
        // @ts-ignore - Dynamically copying properties
        healthCheckClient[key] = newHealthCheckClient[key];
      });
      
      // Reset error counter
      connectionErrors = 0;
      log('[Database] Supabase health check client has been reset', 'info');
      return true;
    } catch (error) {
      log('[Database] Failed to reset Supabase health check client', 'error');
      console.error('[Database] Reset error:', error);
      return false;
    }
  }
  
  return true;
}

/**
 * Mark a successful database operation to track connectivity health
 */
export function markSuccessfulConnection() {
  lastSuccessfulConnection = Date.now();
  connectionErrors = 0;
}

/**
 * Mark a failed database operation to track connectivity health
 */
export function markFailedConnection() {
  connectionErrors++;
  console.warn(`[Database] Connection error count: ${connectionErrors}/${MAX_ERRORS_BEFORE_RESET}`);
}

// For compatibility with existing code that expects this function
export function setupPoolErrorHandlers() {
  log('[Database] Setting up Supabase error monitoring', 'info');
}

export async function closeConnections() {
  log('[Database] No direct database connections to close - using Supabase', 'info');
  return Promise.resolve();
}