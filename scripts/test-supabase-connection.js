/**
 * Test Supabase Connection Script
 * 
 * This script tests the Supabase connection and checks if we can access
 * the database with the current credentials before running the main script.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('=== TESTING SUPABASE CONNECTION ===\n');
  
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Environment variables check:');
  console.log(`✓ SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}`);
  console.log(`✓ SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}`);
  console.log(`✓ SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'Set' : 'Missing'}\n`);
  
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL is missing');
    return false;
  }
  
  // Test with anon key first
  if (supabaseAnonKey) {
    console.log('Testing connection with ANON key...');
    try {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await anonClient.from('Projects').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.log(`⚠️  Anon key connection error: ${error.message}`);
      } else {
        console.log('✅ Anon key connection successful');
      }
    } catch (err) {
      console.log(`⚠️  Anon key connection failed: ${err.message}`);
    }
  }
  
  // Test with service key
  if (supabaseServiceKey) {
    console.log('Testing connection with SERVICE key...');
    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      
      // Test basic read access
      const { data: projects, error: projectsError } = await serviceClient
        .from('Projects')
        .select('id, na853, event_description')
        .limit(1);
      
      if (projectsError) {
        console.log(`⚠️  Service key read error: ${projectsError.message}`);
      } else {
        console.log('✅ Service key read access successful');
        console.log(`   Found ${projects.length} project(s)`);
      }
      
      // Test table existence
      const { data: tables, error: tablesError } = await serviceClient.rpc('exec', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('Projects', 'project_history', 'event_types', 'expediture_types', 'Monada', 'kallikratis')
          ORDER BY table_name;
        `
      });
      
      if (tablesError) {
        console.log(`⚠️  Table check error: ${tablesError.message}`);
      } else {
        console.log('✅ Table existence check:');
        tables.forEach(table => console.log(`   - ${table.table_name}`));
      }
      
      return true;
    } catch (err) {
      console.log(`❌ Service key connection failed: ${err.message}`);
      return false;
    }
  }
  
  console.log('\n=== CONNECTION TEST COMPLETE ===');
  return supabaseServiceKey ? true : false;
}

testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Connection test passed! You can now run the main script.');
    console.log('Run: node scripts/create-and-populate-project-history.js');
  } else {
    console.log('\n❌ Connection test failed. Please check your credentials.');
    console.log('\nYou need to set either:');
    console.log('1. SUPABASE_SERVICE_ROLE_KEY for admin operations, or');
    console.log('2. SUPABASE_ANON_KEY for basic operations');
  }
}).catch(console.error);