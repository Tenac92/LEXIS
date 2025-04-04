/**
 * Database Configuration
 * Sets up the Supabase client
 */
import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Export a function to check the database connection
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('Projects').select('id').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
}