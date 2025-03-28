import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { pool } from "./config/db"; // Use the robust pool from config/db.ts

// Consolidated database access using enhanced pool from config/db
// with error recovery and connection management

export const db = drizzle(pool, { 
  schema,
  // Add logger in development mode for easier debugging
  logger: process.env.NODE_ENV === 'development'
});