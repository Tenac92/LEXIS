/**
 * List Users Tool
 * Enhanced script to list all users in the Supabase database with detailed information
 */

import { createClient } from '@supabase/supabase-js';
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

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  console.log('🔍 User Management Listing Tool');
  console.log('==============================');
  
  try {
    // Get all users with complete information
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️ No users found in the database');
      
      // Offer to create a test user
      console.log('\nWould you like to create a test user?');
      console.log('Run the following command:');
      console.log('node test-auth.js');
      
      return;
    }
    
    console.log(`✅ Found ${users.length} users in the database\n`);
    
    // Print basic user list in a table format
    console.log('User List:');
    console.log('----------------------------------------------------------');
    console.log('ID | Email               | Name              | Role       ');
    console.log('----------------------------------------------------------');
    
    users.forEach(user => {
      const id = user.id.toString().padEnd(3);
      const email = user.email.padEnd(20);
      const name = (user.name || '').padEnd(18);
      const role = (user.role || '').padEnd(10);
      
      console.log(`${id}| ${email}| ${name}| ${role}`);
    });
    
    console.log('----------------------------------------------------------');
    
    // Detailed user information
    console.log('\n📊 Detailed User Information:');
    users.forEach((user, index) => {
      console.log(`\n👤 User #${index + 1}: ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Units: ${user.units ? JSON.stringify(user.units) : 'None'}`);
      console.log(`   Department: ${user.department || 'None'}`);
      console.log(`   Telephone: ${user.telephone || 'None'}`);
      console.log(`   Created: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}`);
      console.log(`   Updated: ${user.updated_at ? new Date(user.updated_at).toLocaleString() : 'Never'}`);
      console.log(`   Password field: ${user.password ? '✅ Present' : '❌ Missing'}`);
    });
    
    // Summary statistics
    console.log('\n📈 User Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Admin users: ${users.filter(u => u.role === 'admin').length}`);
    console.log(`   Regular users: ${users.filter(u => u.role === 'user').length}`);
    console.log(`   Users with units: ${users.filter(u => u.units && u.units.length > 0).length}`);
    console.log(`   Users with departments: ${users.filter(u => u.department).length}`);
    
    // Tool information
    console.log('\n🔧 User Management Tools:');
    console.log('   To update a user\'s password or other details:');
    console.log('   1. Edit fix-password.js to update the configuration');
    console.log('   2. Run: node fix-password.js');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

listUsers();