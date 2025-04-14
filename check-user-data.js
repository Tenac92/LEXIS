/**
 * Check user data in database
 * This script checks if the user with id 82 has the descr field set
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUserData() {
  try {
    console.log('Checking user data for user 82...');
    
    // Get user data
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, department, telephone, descr')
      .eq('id', 82)
      .single();
    
    if (error) {
      console.error('Error fetching user data:', error);
      return;
    }
    
    console.log('User data:', data);
    
    // Check if descr field exists
    if (data.descr === undefined) {
      console.log('descr field does not exist in users table');
    } else if (data.descr === null) {
      console.log('descr field is null for user 82');
    } else {
      console.log('descr field value for user 82:', data.descr);
    }

    // Check schema to see if the column exists
    const { data: columns, error: schemaError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.error('Error fetching schema:', schemaError);
      return;
    }
    
    console.log('Users table columns:', Object.keys(columns[0]));
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkUserData();