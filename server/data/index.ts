/**
 * Database Access Layer
 * Centralizes all database interactions using Supabase exclusively
 */

import { createClient } from '@supabase/supabase-js';
import * as schema from '@shared/schema';
import { log } from '../vite';
import type { Database } from '@shared/schema';

/**
 * Database Configuration
 */
class DatabaseConfig {
  static supabaseUrl = process.env.SUPABASE_URL;
  static supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  static validateConfig() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY/SUPABASE_ANON_KEY environment variables are required');
    }
    
    console.log('[Database] Supabase configuration validated');
  }
}

/**
 * Database Access Layer Class
 * Provides unified access through Supabase
 */
class DatabaseAccess {
  private static instance: DatabaseAccess;
  private supabaseClient!: ReturnType<typeof createClient<Database>>;
  private initialized = false;

  private constructor() {
    this.initialize();
  }
  
  private initialize() {
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
      
      // Initialize Supabase with enhanced configuration
      this.supabaseClient = createClient<Database>(
        DatabaseConfig.supabaseUrl!,
        DatabaseConfig.supabaseKey!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: true,
          },
          global: {
            headers: {
              'x-application-name': 'sdegdaefk-integration'
            },
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );
      
      // Verify Supabase connection works
      const { error } = await this.supabaseClient
        .from('users')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        throw error;
      }
      
      this.initialized = true;
      log('[Database] Successfully initialized Supabase client', 'info');
    } catch (error: any) {
      log(`[Database] Failed to initialize (attempt ${this.connectionAttempts}/${this.MAX_CONNECTION_ATTEMPTS}): ${error.message}`, 'error');
      
      if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
        // Calculate backoff time with exponential increase
        const backoffTimeMs = Math.min(
          30000, // Max 30 seconds
          this.CONNECTION_BACKOFF_BASE_MS * Math.pow(2, this.connectionAttempts - 1)
        );
        
        log(`[Database] Retrying in ${backoffTimeMs}ms...`, 'info');
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, backoffTimeMs));
        await this.initializeWithRetry();
      } else {
        log('[Database] Maximum initialization attempts reached. Database access may be unavailable.', 'error');
        throw new Error(`Failed to initialize database after ${this.MAX_CONNECTION_ATTEMPTS} attempts: ${error.message}`);
      }
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
   * Get Supabase client
   */
  public get supabase(): ReturnType<typeof createClient<Database>> {
    if (!this.initialized) {
      log('[Database] Warning: Accessing Supabase client before initialization is complete', 'warn');
    }
    return this.supabaseClient;
  }

  /**
   * Placeholder for pool for compatibility with existing code
   */
  public get pool(): any {
    return {
      connect: async () => {
        throw new Error('Direct PostgreSQL connections are no longer supported. Use Supabase instead.');
      },
      query: async () => {
        throw new Error('Direct PostgreSQL queries are no longer supported. Use Supabase instead.');
      },
      end: async () => {
        return Promise.resolve();
      }
    };
  }

  /**
   * Placeholder for drizzle for compatibility with existing code
   */
  public get db(): any {
    log('[Database] Warning: Attempting to use Drizzle directly. This is no longer supported.', 'warn');
    return {
      query: () => {
        throw new Error('Direct Drizzle ORM usage is no longer supported. Use Supabase instead.');
      }
    };
  }

  /**
   * Verify database connections are working
   */
  public async verifyConnections(): Promise<{ pg: boolean, supabase: boolean }> {
    const result = {
      pg: false, // Always false now that we only use Supabase
      supabase: false
    };

    try {
      // Verify Supabase connection
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('count(*)', { count: 'exact', head: true });
      
      if (!error) {
        result.supabase = true;
        log('[Database] Supabase connection verified', 'info');
      } else {
        throw error;
      }
    } catch (error) {
      log(`[Database] Supabase connection failed: ${error}`, 'error');
      console.error('[Database] Supabase connection failed:', error);
    }

    return result;
  }

  /**
   * No database connections to close with Supabase
   */
  public async close() {
    log('[Database] No connections to close with Supabase client', 'info');
    return Promise.resolve();
  }
}

// Export singleton instances
export const supabase = DatabaseAccess.getInstance().supabase;
export const pool = DatabaseAccess.getInstance().pool;
export const db = DatabaseAccess.getInstance().db;

// Export utility functions
export const verifyDatabaseConnections = () => 
  DatabaseAccess.getInstance().verifyConnections();

export const closeDatabaseConnections = () =>
  DatabaseAccess.getInstance().close();