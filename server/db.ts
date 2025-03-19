import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not found. Make sure the database is provisioned.');
}

// Create postgres client
const client = postgres(process.env.DATABASE_URL, { max: 1 });
export const db = drizzle(client, { schema });

// Test database connection
console.log('[Database] Initializing database connection...');
client.connect()
  .then(() => {
    console.log('[Database] Successfully connected to PostgreSQL');
  })
  .catch(error => {
    console.error('[Database] Failed to connect to PostgreSQL:', error);
    throw error;
  });