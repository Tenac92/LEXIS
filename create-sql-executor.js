#!/usr/bin/env node

/**
 * Create SQL Executor Function for Supabase
 * This script creates a stored function in Supabase to execute arbitrary SQL
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔧 CREATING SQL EXECUTOR FUNCTION IN SUPABASE');
console.log('==============================================\n');

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSQLExecutor() {
  console.log('📝 Step 1: Creating SQL executor function...');
  
  try {
    // First, let's create a stored function that can execute dynamic SQL
    const sqlFunction = `
      CREATE OR REPLACE FUNCTION public.execute_dynamic_sql(sql_query text)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result jsonb;
        rec record;
        results jsonb[] := '{}';
      BEGIN
        -- Execute the query and collect results
        FOR rec IN EXECUTE sql_query LOOP
          results := array_append(results, to_jsonb(rec));
        END LOOP;
        
        -- Return results as JSONB array
        RETURN array_to_json(results)::jsonb;
      EXCEPTION
        WHEN OTHERS THEN
          -- Return error information
          RETURN jsonb_build_object(
            'error', true,
            'message', SQLERRM,
            'detail', SQLSTATE
          );
      END;
      $$;
    `;

    // Try to execute via direct connection using the Node.js pg library
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const client = await pool.connect();
    
    console.log('🔄 Executing function creation...');
    await client.query(sqlFunction);
    
    console.log('✅ SQL executor function created successfully!');
    
    // Test the function
    console.log('🧪 Testing the function...');
    const testResult = await client.query(
      "SELECT public.execute_dynamic_sql('SELECT current_database() as db, version() as ver LIMIT 1') as result"
    );
    
    console.log('✅ Test successful:', JSON.stringify(testResult.rows[0], null, 2));
    
    client.release();
    await pool.end();
    
    console.log('\n🎯 SUCCESS: SQL executor is now available!');
    console.log('You can now use: SELECT public.execute_dynamic_sql(\'YOUR_SQL_HERE\')');
    
  } catch (error) {
    console.log('❌ Failed to create via pg library:', error.message);
    
    // Fallback: Try using Supabase SQL editor approach
    console.log('\n📝 Fallback: Manual SQL function creation needed');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    console.log(`
CREATE OR REPLACE FUNCTION public.execute_dynamic_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  rec record;
  results jsonb[] := '{}';
BEGIN
  -- Execute the query and collect results
  FOR rec IN EXECUTE sql_query LOOP
    results := array_append(results, to_jsonb(rec));
  END LOOP;
  
  -- Return results as JSONB array
  RETURN array_to_json(results)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'error', true,
      'message', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;
    `);
    console.log('='.repeat(60));
  }
}

createSQLExecutor();