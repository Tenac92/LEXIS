/**
 * Simple Supabase Connection Test (ES Modules version)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
    return false;
  }
  
  console.log(`Using Supabase URL: ${supabaseUrl}`);
  console.log(`Using Supabase Key: ${supabaseKey.substring(0, 8)}...`);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  
  try {
    // Test database access
    console.log('Testing database access...');
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error accessing database:', error.message);
      return false;
    }
    
    console.log('Successfully connected to database!');
    console.log(`Found ${data.length} users`);
    return true;
  } catch (err) {
    console.error('Exception during Supabase test:', err.message);
    return false;
  }
}

// Run the test
testConnection().then(success => {
  if (success) {
    console.log('✅ Supabase connection test PASSED');
  } else {
    console.log('❌ Supabase connection test FAILED');
    process.exit(1);
  }
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});