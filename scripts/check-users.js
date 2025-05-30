/**
 * Check existing users in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    console.log('Checking existing users...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, units')
      .limit(10);
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log('Found users:', users?.length || 0);
    
    if (users && users.length > 0) {
      users.forEach(user => {
        console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Units: ${JSON.stringify(user.units)}`);
      });
    } else {
      console.log('No users found in database');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUsers();