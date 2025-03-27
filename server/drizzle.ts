import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema.unified";

// TODO: Refactor - There are multiple database connection mechanisms:
// - Direct PostgreSQL connection here using pg Pool
// - Supabase client in db.ts and config/db.ts
// Consider consolidating database access through a single interface

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });