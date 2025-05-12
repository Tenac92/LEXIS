/**
 * Debug script to test fetching user data from Supabase
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function getUsers() {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    console.log('Supabase connection initialized.');

    // Fetch all users
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .order('id');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log(`Found ${data.length} users:`);
    data.forEach(user => {
      console.log(`ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });
    
    // Specifically look for users with ID 49
    const user49 = data.find(user => user.id === 49 || user.id === '49');
    if (user49) {
      console.log('\nFound User with ID 49:');
      console.log(user49);
    } else {
      console.log('\nNo user found with ID 49.');
      
      // Look for users with IDs close to 49
      console.log('\nUsers with IDs close to 49:');
      data.filter(user => {
        const id = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        return id >= 45 && id <= 55;
      }).forEach(user => {
        console.log(`ID: ${user.id}, Name: ${user.name}`);
      });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

getUsers();