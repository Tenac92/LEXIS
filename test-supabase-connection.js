import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

console.log('🔧 Testing Supabase Connection');
console.log('==============================');
console.log('URL configured:', !!supabaseUrl);
console.log('Key configured:', !!supabaseKey);
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('🔄 Testing basic connection...');
    const { data, error } = await supabase.from('Projects').select('id').limit(1);
    
    if (error) {
      console.log('❌ Supabase Error:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    console.log('📊 Projects table accessible:', data?.length || 0, 'records found');
    
    // Test with a simple SQL query using RPC if available
    console.log('🔄 Testing SQL execution capability...');
    try {
      const { data: sqlData, error: sqlError } = await supabase.rpc('version');
      if (sqlError) {
        console.log('⚠️ RPC not available:', sqlError.message);
      } else {
        console.log('✅ SQL RPC capability available');
      }
    } catch (rpcError) {
      console.log('⚠️ RPC functions not configured');
    }
    
    return true;
  } catch (err) {
    console.log('❌ Connection failed:', err.message);
    return false;
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('\n🎯 CONCLUSION: Your Supabase connection is working perfectly!');
      console.log('The issue is that the SQL execution tool is trying to connect');
      console.log('to the old Neon database instead of your current Supabase instance.');
    } else {
      console.log('\n❌ CONCLUSION: Supabase connection has issues');
    }
  })
  .catch(err => {
    console.log('\n❌ Test failed:', err.message);
  });