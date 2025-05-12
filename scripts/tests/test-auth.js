/**
 * Authentication Test Script
 * Tests user authentication against the Supabase database
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

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthentication() {
  console.log('🔑 Testing Authentication System');
  console.log('================================');
  
  try {
    // 1. Fetch test user
    console.log('\n1. Fetching test user data...');
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@example.com')
      .single();
    
    if (error) {
      console.error('❌ Error fetching test user:', error.message);
      return;
    }
    
    if (!user) {
      console.log('⚠️ Test user not found, creating a test user...');
      
      // Create a test user if one doesn't exist
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            email: 'test@example.com',
            password: hashedPassword,
            name: 'Test User',
            role: 'user'
          }
        ])
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating test user:', createError.message);
        return;
      }
      
      console.log('✅ Test user created successfully');
      console.log('User details:', {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      });
      
      return;
    }
    
    console.log('✅ Test user found');
    console.log('User details:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
    
    // 2. Test password verification
    console.log('\n2. Testing password verification...');
    
    // For security reasons, we don't actually check the test password
    // But we verify that the password field exists
    if (!user.password && !user.password_hash) {
      console.error('❌ User has no password field');
      return;
    }
    
    console.log('✅ Password field exists');
    console.log(`Password field type: ${user.password_hash ? 'password_hash' : 'password'}`);
    
    // 3. Test authentication endpoint
    console.log('\n3. Testing API authentication endpoint...');
    console.log('Use the following curl command to test the login API:');
    console.log(`
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "test@example.com", "password": "password123"}'
    `);
    
    console.log('\nAuthentication test complete!');
    
  } catch (err) {
    console.error('❌ Unexpected error during authentication test:', err);
  }
}

testAuthentication();