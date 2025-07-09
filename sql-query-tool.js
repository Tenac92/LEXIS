#!/usr/bin/env node
/**
 * SQL Query Tool for Supabase
 * A command-line utility to execute SQL queries against the Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 SUPABASE SQL QUERY TOOL');
console.log('==========================');
console.log('');
console.log('Available commands:');
console.log('  - Type SQL queries (SELECT, COUNT)');
console.log('  - Type "tables" to list all tables');
console.log('  - Type "help" for examples');
console.log('  - Type "exit" to quit');
console.log('');

async function executeQuery(query) {
  const startTime = Date.now();
  const queryLower = query.toLowerCase().trim();
  
  try {
    if (queryLower === 'help') {
      console.log('Example queries:');
      console.log('  SELECT * FROM Projects LIMIT 5');
      console.log('  SELECT count(*) FROM Projects');
      console.log('  SELECT id, project_title FROM Projects WHERE mis = \'5174085\'');
      console.log('  SELECT * FROM users LIMIT 10');
      console.log('  SELECT * FROM Monada');
      console.log('');
      return;
    }
    
    if (queryLower === 'tables') {
      const knownTables = [
        'Projects', 'project_index', 'project_history', 'budget_na853_split',
        'budget_history', 'event_types', 'expenditure_types', 'kallikratis',
        'Monada', 'users', 'beneficiaries', 'employees', 'documents'
      ];
      
      console.log('📋 Available tables:');
      knownTables.forEach(table => console.log(`  - ${table}`));
      console.log('');
      return;
    }
    
    // Handle COUNT queries
    if (queryLower.includes('select count(')) {
      const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        console.log(`📊 Result: ${count} rows`);
        console.log(`⏱️  Execution time: ${Date.now() - startTime}ms`);
        console.log('');
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
        const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
        
        // Parse WHERE clause (basic)
        const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
        
        let supabaseQuery = supabase.from(tableName);
        
        if (fields === '*') {
          supabaseQuery = supabaseQuery.select('*');
        } else {
          supabaseQuery = supabaseQuery.select(fields);
        }
        
        // Basic WHERE clause support
        if (whereMatch) {
          const whereClause = whereMatch[1].trim();
          // Simple parsing for column = 'value' patterns
          const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]([^'"]+)['"]/);
          if (eqMatch) {
            supabaseQuery = supabaseQuery.eq(eqMatch[1], eqMatch[2]);
          }
        }
        
        supabaseQuery = supabaseQuery.limit(limit);
        
        const { data, error } = await supabaseQuery;
        
        if (error) throw error;
        
        console.log(`📊 Result: ${data.length} rows`);
        console.log(`⏱️  Execution time: ${Date.now() - startTime}ms`);
        console.log('');
        
        if (data.length > 0) {
          // Display results in table format
          console.table(data);
        } else {
          console.log('No results found.');
        }
        
        console.log('');
        return;
      }
    }
    
    // System queries
    if (queryLower.includes('current_database') || queryLower.includes('version')) {
      console.log('📊 System Information:');
      console.log('  Database: Supabase PostgreSQL');
      console.log('  Version: PostgreSQL via Supabase');
      console.log('  Status: Connected');
      console.log(`  Timestamp: ${new Date().toISOString()}`);
      console.log(`⏱️  Execution time: ${Date.now() - startTime}ms`);
      console.log('');
      return;
    }
    
    console.log('❌ Unsupported query type');
    console.log('Supported: SELECT, COUNT, system queries');
    console.log('');
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.log('');
  }
}

function askQuestion() {
  rl.question('SQL> ', async (query) => {
    if (query.toLowerCase().trim() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }
    
    if (query.trim()) {
      await executeQuery(query);
    }
    
    askQuestion();
  });
}

// Start the interactive session
askQuestion();