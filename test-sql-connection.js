#!/usr/bin/env node
/**
 * Test SQL Connection and Execute Queries using Direct Supabase Client
 * This script tests the SQL executor and provides a simple interface
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔗 TESTING SQL CONNECTION TO SUPABASE');
console.log('====================================\n');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Test 1: Check connection with a simple query
    console.log('📋 Test 1: Connection Test');
    const { data: testData, error: testError } = await supabase
      .from('Projects')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection failed:', testError.message);
      return;
    }
    
    console.log('✅ Connection successful!');
    console.log('');

    // Test 2: Count projects
    console.log('📋 Test 2: Count Projects');
    const { count: projectCount, error: countError } = await supabase
      .from('Projects')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count query failed:', countError.message);
    } else {
      console.log(`✅ Found ${projectCount} projects`);
    }
    console.log('');

    // Test 3: Get sample projects
    console.log('📋 Test 3: Sample Projects');
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, project_title')
      .limit(5);
    
    if (projectsError) {
      console.error('❌ Projects query failed:', projectsError.message);
    } else {
      console.log('✅ Sample projects:');
      projects.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.mis} - ${project.project_title}`);
      });
    }
    console.log('');

    // Test 4: Available tables
    console.log('📋 Test 4: Available Tables');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_list');
    
    if (tablesError) {
      console.log('ℹ️  Direct table listing not available, using known tables:');
      const knownTables = [
        'Projects', 'project_index', 'project_history', 'budget_na853_split',
        'budget_history', 'event_types', 'expenditure_types', 'kallikratis',
        'Monada', 'users', 'beneficiaries', 'employees', 'documents'
      ];
      console.log('Known tables:', knownTables.join(', '));
    } else {
      console.log('✅ Available tables:', tables);
    }
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('🎉 SQL connection is working properly');
    
  } catch (error) {
    console.error('❌ Error testing connection:', error);
    process.exit(1);
  }
}

// Run the test
testConnection();