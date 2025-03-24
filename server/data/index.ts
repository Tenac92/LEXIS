/**
 * Database Access Layer
 * Centralizes all database interactions through a common interface
 */

import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from '@shared/schema.unified';
import { log } from '../vite';
import type { Database } from '@shared/schema.unified';

/**
 * Database Connection Configuration
 */
class DatabaseConfig {
  static postgresUrl = process.env.DATABASE_URL;
  static supabaseUrl = process.env.SUPABASE_URL;
  static supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  static validateConfig() {
    if (!this.postgresUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    if (this.supabaseUrl && !this.supabaseKey) {
      throw new Error('SUPABASE_KEY or SUPABASE_ANON_KEY environment variable is required when SUPABASE_URL is provided');
    }
    
    console.log('[Database] Configuration validated');
  }
}

/**
 * Database Access Layer Class
 * Provides unified access to different database technologies
 */
class DatabaseAccess {
  private static instance: DatabaseAccess;
  private pgPool!: Pool; // Using definite assignment assertion
  private drizzleClient!: ReturnType<typeof drizzle>; // Using definite assignment assertion
  private supabaseClient!: ReturnType<typeof createClient<Database>>; // Using definite assignment assertion
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Validate configuration
      DatabaseConfig.validateConfig();

      // Initialize PostgreSQL pool
      this.pgPool = new Pool({
        connectionString: DatabaseConfig.postgresUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Setup connection error handling
      this.pgPool.on('error', (err) => {
        log(`[Database] PostgreSQL pool error: ${err.message}`, 'error');
        console.error('[Database] PostgreSQL pool error:', err);
      });

      // Initialize Drizzle ORM
      this.drizzleClient = drizzle(this.pgPool, { schema });

      // Initialize Supabase (if configured)
      if (DatabaseConfig.supabaseUrl && DatabaseConfig.supabaseKey) {
        this.supabaseClient = createClient<Database>(
          DatabaseConfig.supabaseUrl,
          DatabaseConfig.supabaseKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: true,
            },
          }
        );
      } else {
        log('[Database] Supabase not configured, some features may be limited', 'warn');
        // Create a mock supabase client to prevent null references
        this.supabaseClient = {} as ReturnType<typeof createClient<Database>>;
      }

      this.initialized = true;
      log('[Database] Database connections initialized successfully', 'info');
    } catch (error) {
      log(`[Database] Initialization error: ${error}`, 'error');
      console.error('[Database] Initialization error:', error);
      throw error;
    }
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
    if (!this.initialized) {
      this.initialize();
    }
    return this.drizzleClient;
  }

  /**
   * Get Supabase client
   */
  public get supabase() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.supabaseClient;
  }

  /**
   * Get PostgreSQL pool
   */
  public get pool() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.pgPool;
  }

  /**
   * Verify database connections are working
   */
  public async verifyConnections(): Promise<{ pg: boolean, supabase: boolean }> {
    const result = {
      pg: false,
      supabase: false
    };

    try {
      // Verify PostgreSQL connection
      const pgClient = await this.pgPool.connect();
      await pgClient.query('SELECT 1');
      pgClient.release();
      result.pg = true;
      log('[Database] PostgreSQL connection verified', 'info');
    } catch (error) {
      log(`[Database] PostgreSQL connection failed: ${error}`, 'error');
      console.error('[Database] PostgreSQL connection failed:', error);
    }

    try {
      // Verify Supabase connection (if configured)
      if (DatabaseConfig.supabaseUrl && DatabaseConfig.supabaseKey) {
        const { data, error } = await this.supabaseClient.from('users').select('count(*)', { count: 'exact' }).limit(1);
        if (!error) {
          result.supabase = true;
          log('[Database] Supabase connection verified', 'info');
        } else {
          throw error;
        }
      } else {
        log('[Database] Supabase not configured, skipping verification', 'warn');
      }
    } catch (error) {
      log(`[Database] Supabase connection failed: ${error}`, 'error');
      console.error('[Database] Supabase connection failed:', error);
    }

    return result;
  }

  /**
   * Close all database connections
   */
  public async close() {
    if (this.pgPool) {
      await this.pgPool.end();
      log('[Database] PostgreSQL pool closed', 'info');
    }
  }
}

// Export singleton instances
export const db = DatabaseAccess.getInstance().db;
export const supabase = DatabaseAccess.getInstance().supabase;
export const pool = DatabaseAccess.getInstance().pool;

// Export utility functions
export const verifyDatabaseConnections = () => 
  DatabaseAccess.getInstance().verifyConnections();

export const closeDatabaseConnections = () =>
  DatabaseAccess.getInstance().close();