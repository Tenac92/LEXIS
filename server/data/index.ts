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
  // Use any type to avoid type errors during initialization
  private supabaseClient: any;
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
      
      // Initialize Supabase with enhanced configuration and more resilient settings
      this.supabaseClient = createClient<Database>(
        DatabaseConfig.supabaseUrl!,
        DatabaseConfig.supabaseKey!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false, // Changed to false to avoid token refresh issues
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
      
      // Verify Supabase connection works with a simpler query and longer timeout
      const fetchPromise = this.supabaseClient
        .from('users')
        .select('id')
        .limit(1);
        
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), 10000);
      });
      
      // Race the fetch against the timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (result.error) {
        throw result.error;
      }
      
      this.initialized = true;
      log('[Database] Successfully initialized Supabase client', 'info');
      console.log('[Database] Connection verified with data:', result.data);
      
      // Reset connection attempts counter on success
      this.connectionAttempts = 0;
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
        // Instead of throwing, just mark as uninitialized but continue
        this.initialized = false;
        console.error(`[Database] Failed to initialize after ${this.MAX_CONNECTION_ATTEMPTS} attempts:`, error);
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
  public get supabase(): any {
    if (!this.initialized) {
      log('[Database] Warning: Accessing Supabase client before initialization is complete', 'warn');
      
      // Try to reinitialize if we're not in the middle of retrying
      if (this.connectionAttempts === 0) {
        log('[Database] Attempting to reinitialize Supabase client', 'info');
        this.initialize();
      }
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

// Export singleton instance getter (lazy access)
export const getDatabaseAccess = () => DatabaseAccess.getInstance();

// Export lazy accessors to avoid initialization warnings
export const getSupabase = () => DatabaseAccess.getInstance().supabase;
export const getPool = () => DatabaseAccess.getInstance().pool;
export const getDb = () => DatabaseAccess.getInstance().db;

// Backward compatibility: export instances directly (but warn about initialization)
// These will trigger the warning if accessed before init, but at least won't break imports
let _supabaseInstance: any = null;
let _poolInstance: any = null;
let _dbInstance: any = null;

Object.defineProperty(exports, 'supabase', {
  get() {
    if (!_supabaseInstance) {
      _supabaseInstance = DatabaseAccess.getInstance().supabase;
    }
    return _supabaseInstance;
  }
});

Object.defineProperty(exports, 'pool', {
  get() {
    if (!_poolInstance) {
      _poolInstance = DatabaseAccess.getInstance().pool;
    }
    return _poolInstance;
  }
});

Object.defineProperty(exports, 'db', {
  get() {
    if (!_dbInstance) {
      _dbInstance = DatabaseAccess.getInstance().db;
    }
    return _dbInstance;
  }
});

// Export utility functions
export const verifyDatabaseConnections = () => 
  DatabaseAccess.getInstance().verifyConnections();

export const closeDatabaseConnections = () =>
  DatabaseAccess.getInstance().close();