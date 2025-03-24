/**
 * Database Access Layer
 * Centralizes all database interactions through a common interface
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { createClient } from '@supabase/supabase-js';
import { Pool } from "pg";
import * as schema from "../../shared/schema";
import type { Database } from "../../shared/schema";
import { log } from "../vite";

/**
 * Database Connection Configuration
 */
class DatabaseConfig {
  static postgresUrl = process.env.DATABASE_URL;
  static supabaseUrl = process.env.SUPABASE_URL;
  static supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  static validateConfig() {
    if (!this.postgresUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_ANON_KEY) must be set in environment variables");
    }
  }
}

/**
 * Database Access Layer Class
 * Provides unified access to different database technologies
 */
class DatabaseAccess {
  private static instance: DatabaseAccess;
  private pgPool: Pool;
  private drizzleClient: ReturnType<typeof drizzle>;
  private supabaseClient: ReturnType<typeof createClient<Database>>;
  private initialized = false;

  private constructor() {
    // Validate environment variables
    DatabaseConfig.validateConfig();

    // Initialize PostgreSQL connection
    this.pgPool = new Pool({
      connectionString: DatabaseConfig.postgresUrl,
    });

    // Initialize Drizzle ORM
    this.drizzleClient = drizzle(this.pgPool, { schema });

    // Initialize Supabase client
    this.supabaseClient = createClient<Database>(
      DatabaseConfig.supabaseUrl!,
      DatabaseConfig.supabaseKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    this.initialized = true;
    log("[Database] Access layer initialized", "db");
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseAccess {
    if (!DatabaseAccess.instance) {
      DatabaseAccess.instance = new DatabaseAccess();
    }
    return DatabaseAccess.instance;
  }

  /**
   * Get Drizzle ORM client
   */
  public get db() {
    return this.drizzleClient;
  }

  /**
   * Get Supabase client
   */
  public get supabase() {
    return this.supabaseClient;
  }

  /**
   * Get PostgreSQL pool
   */
  public get pool() {
    return this.pgPool;
  }

  /**
   * Verify database connections are working
   */
  public async verifyConnections(): Promise<{ pg: boolean, supabase: boolean }> {
    const results = { pg: false, supabase: false };

    try {
      // Test PostgreSQL connection
      const client = await this.pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      results.pg = true;
      log("[Database] PostgreSQL connection verified", "db");
    } catch (error) {
      log(`[Database] PostgreSQL connection error: ${error}`, "error");
    }

    try {
      // Test Supabase connection
      const { data, error } = await this.supabaseClient
        .from('Projects')
        .select('mis')
        .limit(1);

      if (error) throw error;
      results.supabase = true;
      log("[Database] Supabase connection verified", "db");
    } catch (error) {
      log(`[Database] Supabase connection error: ${error}`, "error");
    }

    return results;
  }

  /**
   * Close all database connections
   */
  public async close() {
    await this.pgPool.end();
    log("[Database] All connections closed", "db");
  }
}

// Export singleton instance
export const db = DatabaseAccess.getInstance().db;
export const supabase = DatabaseAccess.getInstance().supabase;
export const pool = DatabaseAccess.getInstance().pool;

// Export verification function for health checks
export const verifyDatabaseConnections = () => 
  DatabaseAccess.getInstance().verifyConnections();

// For teardown in tests or graceful shutdown
export const closeDatabaseConnections = () =>
  DatabaseAccess.getInstance().close();

export default {
  db,
  supabase,
  pool,
  verifyDatabaseConnections,
  closeDatabaseConnections
};