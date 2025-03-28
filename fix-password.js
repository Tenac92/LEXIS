/**
 * User Management Tool
 * Updates a user's details in the Supabase database including password and email
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in the .env file');
  process.exit(1);
}

// User details to update
const config = {
  // Current email to identify the user
  currentEmail: 'kkiriakou92@gmail.com',
  
  // New details to set (comment out any fields you don't want to change)
  updates: {
    // newEmail: 'new-email@example.com',
    password: 'Admin123!',
    // name: 'New Name',
    // role: 'admin', // or 'user', 'manager'
  }
};

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUserDetails() {
  console.log('👤 User Management Tool');
  console.log('=======================');
  console.log(`\nUpdating details for user: ${config.currentEmail}`);
  
  try {
    // Prepare updates object
    const updates = {};
    
    // Process password if it exists
    if (config.updates.password) {
      updates.password = await bcrypt.hash(config.updates.password, 10);
      console.log('✅ Password hashed successfully');
    }
    
    // Add other fields to update
    if (config.updates.newEmail) {
      updates.email = config.updates.newEmail;
      console.log(`✅ Email will be updated to: ${config.updates.newEmail}`);
    }
    
    if (config.updates.name) {
      updates.name = config.updates.name;
      console.log(`✅ Name will be updated to: ${config.updates.name}`);
    }
    
    if (config.updates.role) {
      updates.role = config.updates.role;
      console.log(`✅ Role will be updated to: ${config.updates.role}`);
    }
    
    // Perform the update
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', config.currentEmail);
    
    if (error) {
      console.error('❌ Error updating user details:', error.message);
      return;
    }
    
    console.log('✅ User details updated successfully');
    
    // Show test command using appropriate email
    const loginEmail = config.updates.newEmail || config.currentEmail;
    
    console.log('\nYou can now test the login with:');
    console.log(`
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "${loginEmail}", "password": "${config.updates.password || '<current-password>'}"}'
    `);
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

updateUserDetails();