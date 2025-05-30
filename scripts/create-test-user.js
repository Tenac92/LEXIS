/**
 * Create Test User Script
 * Creates a test user directly in the database for authentication testing
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create test user
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email: 'admin@example.com',
          password: hashedPassword,
          name: 'Admin User',
          role: 'admin',
          units: ['UNIT_A'],
          department: 'Administration'
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating test user:', error);
      return;
    }
    
    console.log('✅ Test user created successfully!');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role: admin');
    console.log('🏢 Units: UNIT_A');
    
    // Test login
    console.log('\n🧪 Testing login...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      }),
    });
    
    if (loginResponse.ok) {
      console.log('✅ Login test successful!');
    } else {
      console.log('❌ Login test failed:', await loginResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createTestUser();