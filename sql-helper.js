#!/usr/bin/env node
/**
 * Simple SQL Helper for Direct Queries
 * Executes single SQL commands against Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSingleQuery(query) {
  const startTime = Date.now();
  
  try {
    const queryLower = query.toLowerCase().trim();
    
    // Handle COUNT queries
    if (queryLower.includes('select count(')) {
      const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        console.log(`Count: ${count}`);
        console.log(`Execution time: ${Date.now() - startTime}ms`);
        return;
      }
    }
    
    // Handle SELECT queries
    if (queryLower.startsWith('select')) {
      const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        
        // Parse SELECT fields
        const selectMatch = query.match(/select\s+(.*?)\s+from/i);
        const fields = selectMatch ? selectMatch[1].trim() : '*';
        
        // Parse LIMIT
        const limitMatch = query.match(/limit\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1]) : 10;
        
        let supabaseQuery = supabase.from(tableName);
        
        if (fields === '*') {
          supabaseQuery = supabaseQuery.select('*');
        } else {
          supabaseQuery = supabaseQuery.select(fields);
        }
        
        supabaseQuery = supabaseQuery.limit(limit);
        
        const { data, error } = await supabaseQuery;
        
        if (error) throw error;
        
        console.log(`Results: ${data.length} rows`);
        console.log(`Execution time: ${Date.now() - startTime}ms`);
        console.log('');
        
        if (data.length > 0) {
          console.table(data);
        }
        
        return;
      }
    }
    
    console.log('❌ Unsupported query type');
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
}

// Get query from command line arguments
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node sql-helper.js "SELECT * FROM Projects LIMIT 5"');
  console.log('Examples:');
  console.log('  node sql-helper.js "SELECT count(*) FROM Projects"');
  console.log('  node sql-helper.js "SELECT * FROM users LIMIT 10"');
  console.log('  node sql-helper.js "SELECT id, project_title FROM Projects LIMIT 5"');
  process.exit(1);
}

executeSingleQuery(query);