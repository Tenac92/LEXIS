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
    }
    // Removed potentially problematic config options
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
  
  while (retriesLeft > 0) {
    try {
      console.log(`[Database] Connection attempt ${retries - retriesLeft + 1}/${retries}`);
      
      // Simplified test - just check that we can connect to Supabase
      const { data, error } = await supabase.from('users').select('id').limit(1);
      
      if (error) {
        console.error('[Database] Query error:', error);
        throw error;
      }
      
      log('[Database] Supabase connection successfully verified', 'info');
      console.log('[Database] Connection test result:', { data });
      
      return true;
    } catch (err: any) {
      lastError = err;
      console.error(`[Database] Connection test failed (${retriesLeft} retries left)`);
      
      // Add detailed error logging
      console.error('[Database] Error object:', err);
      console.error('[Database] Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        status: err.status,
        statusText: err.statusText
      });
      
      if (err.stack) {
        console.error('[Database] Error stack:', err.stack);
      }
      
      // Decrease retries and wait before next attempt with simple backoff
      retriesLeft--;
      const backoffTime = retriesLeft > 0 ? 2000 : 0;
      await sleep(backoffTime);
    }
  }
  
  // If we got here, all retries failed
  console.error('[Database] All connection attempts failed');
  return false;
}

// For compatibility with existing code that expects this function
export function resetConnectionPoolIfNeeded() {
  log('[Database] No connection pool to reset - using Supabase instead', 'info');
  return true;
}

// For compatibility with existing code that expects this function
export function setupPoolErrorHandlers() {
  log('[Database] No pool error handlers to set up - using Supabase instead', 'info');
}

export async function closeConnections() {
  log('[Database] No direct database connections to close - using Supabase', 'info');
  return Promise.resolve();
}