#!/usr/bin/env node

/**
 * Test Direct SQL Execution on Supabase
 * This script tests different methods to execute SQL on Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔧 TESTING DIRECT SQL EXECUTION ON SUPABASE');
console.log('============================================\n');

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSQLExecution() {
  console.log('📊 Method 1: Using Supabase RPC (stored procedure)');
  
  try {
    // Test basic query using .from()
    console.log('🔄 Testing basic table query...');
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, project_title')
      .limit(2);
    
    if (projectsError) {
      console.log('❌ Basic query failed:', projectsError.message);
    } else {
      console.log('✅ Basic query successful:', projects.length, 'records');
    }
  } catch (error) {
    console.log('❌ Basic query error:', error.message);
  }

  console.log('\n📊 Method 2: Using raw SQL via RPC');
  
  try {
    // Try to execute raw SQL using rpc
    const { data: sqlData, error: sqlError } = await supabase
      .rpc('exec_sql', { query: 'SELECT current_database(), version()' });
    
    if (sqlError) {
      console.log('❌ RPC SQL failed:', sqlError.message);
    } else {
      console.log('✅ RPC SQL successful:', sqlData);
    }
  } catch (error) {
    console.log('❌ RPC SQL error:', error.message);
  }

  console.log('\n📊 Method 3: Using PostgREST API directly');
  
  try {
    // Try using the REST API to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        query: 'SELECT current_database() as db, version() as ver'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ REST API SQL successful:', result);
    } else {
      const error = await response.text();
      console.log('❌ REST API SQL failed:', response.status, error);
    }
  } catch (error) {
    console.log('❌ REST API SQL error:', error.message);
  }

  console.log('\n📊 Method 4: Testing table information queries');
  
  try {
    // Get table information using information_schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .limit(5);
    
    if (tablesError) {
      console.log('❌ Schema query failed:', tablesError.message);
    } else {
      console.log('✅ Schema query successful:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name} (${table.table_type})`);
      });
    }
  } catch (error) {
    console.log('❌ Schema query error:', error.message);
  }

  console.log('\n🎯 SUMMARY:');
  console.log('The best approach for SQL execution with Supabase is:');
  console.log('1. Use the Supabase client for standard queries');
  console.log('2. Create stored procedures/functions for complex SQL');
  console.log('3. Use information_schema for metadata queries');
  console.log('4. Direct psql connection may be restricted in Replit environment');
}

testSQLExecution();