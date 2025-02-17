import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import pg from 'pg';
import { Database } from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Supabase environment variables are required');
}

console.log('[Database] Environment variables verified');

// Create Supabase client for auth
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
);

// Create PostgreSQL pool with error handling
export let pool: pg.Pool;
export let db: ReturnType<typeof drizzle>;

try {
  console.log('[Database] Initializing PostgreSQL connection pool');

  pool = new pg.Pool({
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
  const queryClient = postgres(process.env.DATABASE_URL!);
  db = drizzle(queryClient);

  console.log('[Database] Database configuration complete');

} catch (error) {
  console.error('[Database] Fatal error during database initialization:', error);
  process.exit(1);
}