import { createClient } from '@supabase/supabase-js';
import { Pool } from '@neondatabase/serverless';
import type { Database } from '@shared/schema';
import * as schema from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Keep the pool for session store
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}