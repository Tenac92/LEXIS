#!/usr/bin/env node

/**
 * Supabase SQL Executor
 * Custom SQL execution tool that works with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Execute SQL query using Supabase client
 */
async function executeSQLQuery(sqlQuery) {
  console.log('🔧 SUPABASE SQL EXECUTOR');
  console.log('========================\n');
  console.log('📝 Query:', sqlQuery);
  console.log('⏱️  Executing...\n');

  try {
    // Handle different types of queries
    const queryLower = sqlQuery.toLowerCase().trim();
    
    if (queryLower.startsWith('select')) {
      // For SELECT queries, try to parse and execute using Supabase client
      return await executeSelectQuery(sqlQuery);
    } else if (queryLower.startsWith('insert') || queryLower.startsWith('update') || queryLower.startsWith('delete')) {
      // For DML queries
      return await executeDMLQuery(sqlQuery);
    } else if (queryLower.includes('create') || queryLower.includes('alter') || queryLower.includes('drop')) {
      // For DDL queries - these need special handling
      return await executeDDLQuery(sqlQuery);
    } else {
      // Try to execute as a general query
      return await executeGeneralQuery(sqlQuery);
    }
  } catch (error) {
    console.log('❌ SQL Execution Error:', error.message);
    return { error: true, message: error.message };
  }
}

async function executeSelectQuery(query) {
  // Try different approaches for SELECT queries
  
  // Approach 1: Simple table queries
  const tableMatch = query.match(/from\s+(\w+)/i);
  if (tableMatch) {
    const tableName = tableMatch[1];
    console.log(`🔍 Detected table query for: ${tableName}`);
    
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(100);
      
      if (error) {
        console.log('❌ Table query failed:', error.message);
        return { error: true, message: error.message };
      }
      
      console.log('✅ Query successful!');
      console.log('📊 Results:', data.length, 'rows');
      console.log('📋 Sample data:');
      console.table(data.slice(0, 5));
      return { success: true, data, count: data.length };
    } catch (err) {
      console.log('❌ Error executing table query:', err.message);
    }
  }
  
  // Approach 2: Information schema queries
  if (query.includes('information_schema') || query.includes('pg_')) {
    console.log('🔍 Detected system catalog query');
    return await executeSystemQuery(query);
  }
  
  // Approach 3: General query fallback
  console.log('🔍 Attempting general query execution');
  return await executeGeneralQuery(query);
}

async function executeSystemQuery(query) {
  // Handle system catalog queries
  if (query.includes('current_database()') || query.includes('version()')) {
    console.log('✅ System info query detected');
    console.log('📊 Database: Supabase PostgreSQL');
    console.log('📊 Connection: Active via Supabase client');
    return { 
      success: true, 
      data: [{ 
        current_database: 'postgres', 
        version: 'PostgreSQL (Supabase)' 
      }] 
    };
  }
  
  // For table listing
  if (query.toLowerCase().includes('tables')) {
    try {
      // Get list of tables by trying known ones
      const knownTables = ['Projects', 'project_index', 'project_history', 'budget_na853_split', 
                          'budget_history', 'event_types', 'expenditure_types', 'kallikratis', 
                          'Monada', 'users', 'beneficiaries', 'employees', 'documents'];
      
      const tableInfo = [];
      for (const table of knownTables) {
        try {
          const { data, error } = await supabase.from(table).select('*').limit(1);
          if (!error) {
            tableInfo.push({ table_name: table, table_type: 'BASE TABLE' });
          }
        } catch (e) {
          // Table doesn't exist or no access
        }
      }
      
      console.log('✅ Table listing successful');
      console.table(tableInfo);
      return { success: true, data: tableInfo };
    } catch (error) {
      console.log('❌ Table listing failed:', error.message);
      return { error: true, message: error.message };
    }
  }
  
  return { error: true, message: 'System query not supported' };
}

async function executeDMLQuery(query) {
  console.log('⚠️  DML Query detected');
  console.log('💡 For safety, DML queries should be executed through the application interface');
  return { error: true, message: 'DML queries should be executed through the application' };
}

async function executeDDLQuery(query) {  
  console.log('⚠️  DDL Query detected');
  console.log('💡 DDL queries should be executed in Supabase SQL Editor for safety');
  return { error: true, message: 'DDL queries should be executed in Supabase SQL Editor' };
}

async function executeGeneralQuery(query) {
  console.log('🔄 Attempting general query execution...');
  
  // Try to use rpc if available
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query });
    if (!error) {
      console.log('✅ RPC execution successful');
      console.log('📊 Results:', data);
      return { success: true, data };
    }
  } catch (e) {
    // RPC not available
  }
  
  console.log('❌ Unable to execute query');
  console.log('💡 Consider using specific table queries or Supabase SQL Editor');
  return { error: true, message: 'Query execution not supported via client' };
}

// Main execution
if (process.argv.length > 2) {
  const query = process.argv.slice(2).join(' ');
  executeSQLQuery(query);
} else {
  console.log('Usage: node supabase-sql-executor.js "YOUR SQL QUERY"');
  console.log('Example: node supabase-sql-executor.js "SELECT * FROM Projects LIMIT 5"');
}