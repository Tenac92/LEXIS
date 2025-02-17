import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Pool } from 'pg';

// Verify required environment variables
const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY
};

// Check all required environment variables
Object.entries(requiredEnvVars).forEach(([name, value]) => {
  if (!value) {
    console.error(`[Database] Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

console.log('[Database] Environment variables verified');

// Create Supabase client for auth
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Create PostgreSQL pool with error handling
try {
  console.log('[Database] Initializing PostgreSQL connection pool');

  export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Test database connection
  pool.connect()
    .then(client => {
      console.log('[Database] Successfully connected to PostgreSQL');
      client.release();
    })
    .catch(err => {
      console.error('[Database] Failed to connect to PostgreSQL:', err);
      throw err;
    });

  // Create Drizzle instance
  const queryClient = postgres(process.env.DATABASE_URL);
  export const db = drizzle(queryClient);

  console.log('[Database] Database configuration complete');

} catch (error) {
  console.error('[Database] Fatal error during database initialization:', error);
  process.exit(1);
}