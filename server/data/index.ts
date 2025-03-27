/**
 * Database Access Layer
 * Centralizes all database interactions through a common interface
 */

import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from '@shared/schema';
import { log } from '../vite';
import type { Database } from '@shared/schema';

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
  private pgPool!: typeof Pool.prototype; // Using definite assignment assertion
  private drizzleClient!: ReturnType<typeof drizzle>; // Using definite assignment assertion
  private supabaseClient!: ReturnType<typeof createClient<Database>>; // Using definite assignment assertion
  private initialized = false;

  private constructor() {
    this.initialize();
  }
  
  private initialize() {
    // Call our enhanced initialization with retry logic
    this.initializeWithRetry().catch(error => {
      console.error('[Database] Fatal initialization error:', error);
      log(`[Database] Fatal initialization error: ${error}`, 'error');
    });
  }

  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 5;
  private readonly CONNECTION_BACKOFF_BASE_MS = 1000; // 1 second base for exponential backoff
  
  private async initializeWithRetry() {
    this.connectionAttempts++;
    
    try {
      // Validate configuration
      DatabaseConfig.validateConfig();

      // Calculate exponential backoff if this is a retry
      if (this.connectionAttempts > 1) {
        const backoffMs = Math.min(
          30000, // Max 30 seconds
          this.CONNECTION_BACKOFF_BASE_MS * Math.pow(2, this.connectionAttempts - 1)
        );
        
        log(`[Database] Retry attempt ${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS}, waiting ${backoffMs}ms before retry`, 'warn');
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      // Initialize PostgreSQL pool with enhanced error handling and resilience
      this.pgPool = new Pool({
        connectionString: DatabaseConfig.postgresUrl,
        max: 10,
        min: 2, // Keep minimum connections in the pool for faster response
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased timeout for connection acquisition
        // Improve performance with prepared statements and ensure queries don't hang
        statement_timeout: 15000, // 15 seconds
        query_timeout: 20000, // 20 seconds
        allowExitOnIdle: false // Don't allow the app to exit if pool is idle
        // Note: max_retries and retry_strategy don't exist in pg.PoolConfig type
        // We'll handle retries in our own code
      });

      // Setup enhanced connection error handling with better recovery mechanisms
      this.pgPool.on('error', (err: Error & { code?: string }) => {
        log(`[Database] PostgreSQL pool error: ${err.message}`, 'error');
        console.error('[Database] PostgreSQL pool error:', err);
        
        // Handle specific PostgreSQL errors with improved recovery
        if (err.code === '57P01') { // terminating connection due to administrator command
          log('[Database] Attempting to recover from administrative termination...', 'warn');
          // Attempt to create a new client after a small delay
          setTimeout(() => {
            this.pgPool.connect((connectErr, client, release) => {
              if (connectErr) {
                log(`[Database] Recovery failed: ${connectErr.message}`, 'error');
              } else if (client) {
                log('[Database] Successfully recovered from administrative termination', 'info');
                client.query('SELECT 1')
                  .then(() => log('[Database] Test query successful after recovery', 'info'))
                  .catch(queryErr => log(`[Database] Test query failed after recovery: ${queryErr.message}`, 'error'))
                  .finally(() => release());
              } else {
                log('[Database] Recovery warning: Client is undefined', 'warn');
                if (typeof release === 'function') release();
              }
            });
          }, 2000); // Wait 2 seconds before attempting recovery
        } else if (err.code === '08006' || err.code === '08001' || err.code === '08004') {
          // Connection errors - implement custom recovery for critical issues
          log('[Database] Connection error detected, attempting manual recovery...', 'warn');
          
          // For serious connection issues, attempt to reinitialize the pool
          setTimeout(() => {
            try {
              // Only recreate pool if we haven't exceeded max attempts
              if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
                log('[Database] Attempting to reinitialize database connections...', 'info');
                this.initialize(); // Reinitialize connections
              } else {
                log('[Database] Maximum connection retry attempts reached, further retries suspended', 'error');
              }
            } catch (reinitError) {
              log(`[Database] Reinitialization failed: ${reinitError}`, 'error');
            }
          }, 5000); // Allow 5 seconds before attempting reinitialization
        }
      });
      
      // Add connection pool monitoring
      this.pgPool.on('connect', (client) => {
        log('[Database] New database connection established', 'info');
        
        // Reset attempt counter on successful connection
        this.connectionAttempts = 0;
        
        // Add query error handler to individual client
        client.on('error', (err) => {
          log(`[Database] Client query error: ${err.message}`, 'error');
        });
      });
      
      this.pgPool.on('acquire', () => {
        log(`[Database] Connection acquired from pool (${this.pgPool.totalCount} total, ${this.pgPool.idleCount} idle)`, 'debug');
      });
      
      this.pgPool.on('remove', () => {
        log('[Database] Connection removed from pool', 'debug');
      });

      // Initialize Drizzle ORM with enhanced debugging
      this.drizzleClient = drizzle(this.pgPool, { 
        schema,
        // Add query logging in development for easier debugging
        logger: process.env.NODE_ENV === 'development'
        // Note: Removed unsupported options to prevent errors
      });

      // Initialize Supabase (if configured) with better error handling
      if (DatabaseConfig.supabaseUrl && DatabaseConfig.supabaseKey) {
        this.supabaseClient = createClient<Database>(
          DatabaseConfig.supabaseUrl,
          DatabaseConfig.supabaseKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: true,
            },
            // Add global error handling
            global: {
              headers: {
                'x-application-name': 'sdegdaefk-integration'
              },
            },
            // Better network error handling
            realtime: {
              params: {
                eventsPerSecond: 10
              }
            }
          }
        );
      } else {
        log('[Database] Supabase not configured, some features may be limited', 'warn');
        // Create a mock supabase client with basic error handling to prevent null references
        this.supabaseClient = {
          from: () => {
            return {
              select: () => ({ data: [], error: new Error('Supabase not configured') })
            };
          }
        } as unknown as ReturnType<typeof createClient<Database>>;
      }

      this.initialized = true;
      log('[Database] Database connections initialized successfully', 'info');
    } catch (error) {
      log(`[Database] Initialization error: ${error}`, 'error');
      console.error('[Database] Initialization error:', error);
      // Don't throw the error, allow the application to continue with limited functionality
      this.initialized = false;
      
      // Initialize fallback objects to prevent null reference errors
      this.pgPool = new Pool({ connectionString: 'postgres://localhost:5432/fallback' });
      this.drizzleClient = drizzle(this.pgPool, { schema });
      this.supabaseClient = {} as ReturnType<typeof createClient<Database>>;
      
      log('[Database] Initialized with fallback configuration due to error', 'warn');
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