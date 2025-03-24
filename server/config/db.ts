/**
 * Database Configuration Module
 * Centralizes database connection parameters and configuration
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { log } from '../vite';
import type { Database } from '@shared/schema';

const { Pool } = pg;

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
  connectionTimeoutMillis: 5000,
};

// Export pool instance for reuse across the application
export const pool = new Pool(poolConfig);

// Initialize connection error handling
pool.on('error', (err) => {
  log(`[Database] PostgreSQL pool error: ${err.message}`, 'error');
  console.error('[Database] PostgreSQL pool error:', err);
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

// Test database connection
export async function testConnection() {
  try {
    // Test PostgreSQL connection
    const pgClient = await pool.connect();
    const pgResult = await pgClient.query('SELECT 1 AS pg_connection_test');
    pgClient.release();
    log('[Database] PostgreSQL connection successful', 'info');
    
    // Test Supabase connection if configured
    if (supabaseUrl && supabaseKey) {
      const { data: supabaseData, error: supabaseError } = await supabase
        .from('users')
        .select('count(*)', { count: 'exact' })
        .limit(1);
      
      if (supabaseError) {
        throw new Error(`Supabase connection error: ${supabaseError.message}`);
      }
      
      log('[Database] Supabase connection successful', 'info');
    }
    
    return true;
  } catch (error) {
    log(`[Database] Connection test failed: ${error}`, 'error');
    console.error('[Database] Connection test failed:', error);
    return false;
  }
}

// Close all database connections
export async function closeConnections() {
  await pool.end();
  log('[Database] All database connections closed', 'info');
}