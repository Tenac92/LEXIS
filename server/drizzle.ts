/**
 * Database Operations Layer
 * Replaces Drizzle ORM with direct Supabase operations
 */

import { supabase } from "./config/db";
import * as schema from "../shared/schema";
import { log } from "./vite";

// Create a Supabase-based database operations layer
// This replaces Drizzle ORM with Supabase calls
export const db = {
  // For logging in development
  logger: process.env.NODE_ENV === 'development',
  
  // Execute a query with optional logging
  async query(tableName: string, operation: string, ...args: any[]): Promise<any> {
    if (this.logger) {
      log(`[Database] ${operation} on ${tableName}`, 'info');
    }
    throw new Error(`Direct query operations are no longer supported. Use supabase client instead.`);
  }
};

// Export a function to execute custom SQL through Supabase
export async function executeSQL(sql: string, params?: any[]): Promise<any> {
  try {
    // Log the query in development mode
    if (process.env.NODE_ENV === 'development') {
      log(`[Database] Executing SQL: ${sql}`, 'info');
      if (params && params.length > 0) {
        log(`[Database] With params: ${JSON.stringify(params)}`, 'info');
      }
    }
    
    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: sql,
      query_params: params || []
    });
    
    if (error) {
      log(`[Database] SQL Error: ${error.message}`, 'error');
      throw error;
    }
    
    return data;
  } catch (err: any) {
    log(`[Database] SQL Error: ${err.message}`, 'error');
    console.error(`[SQL Error] ${err.message}`);
    throw err;
  }
}