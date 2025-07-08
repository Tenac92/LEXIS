import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const { data, error } = await supabase
      .from('beneficiary_payments')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Connection successful, but table query failed:', error.message);
    } else {
      console.log('✓ Connection successful! Table structure test passed');
      console.log('Sample data:', data);
    }
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();