/**
 * Simple script to test Supabase connection
 * Run with: npx tsx server/scripts/test-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  
  // Gather configuration
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials');
    console.error('SUPABASE_URL:', supabaseUrl ? 'Provided' : 'Missing');
    console.error('SUPABASE_KEY:', supabaseKey ? 'Provided' : 'Missing');
    return;
  }
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseKey.substring(0, 10) + '...');
  
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    
    // Test simple query
    console.log('Attempting to connect...');
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    console.log('Connection successful!', data);
    
    // Try specific database operations
    console.log('Testing users table existence...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (usersError) {
      console.error('Error accessing users table:', usersError);
    } else {
      console.log('Users table exists:', users);
    }
    
  } catch (err) {
    console.error('Uncaught error during connection test:', err);
    process.exit(1);
  }
}

// Run the test
testSupabaseConnection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});