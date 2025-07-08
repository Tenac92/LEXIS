#!/usr/bin/env node

/**
 * Fix User Unit ID Script
 * This script checks and fixes the unit_id field for users
 */

import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixUserUnitId() {
  try {
    console.log('🔍 Checking user 79 unit_id in database...');
    
    // Check current user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, unit_id')
      .eq('id', 79)
      .single();
      
    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }
    
    console.log('📊 Current user data:', userData);
    console.log('📊 Current unit_id:', userData.unit_id);
    console.log('📊 unit_id type:', typeof userData.unit_id);
    console.log('📊 unit_id is array:', Array.isArray(userData.unit_id));
    
    // Check if unit_id is null or empty
    if (!userData.unit_id || (Array.isArray(userData.unit_id) && userData.unit_id.length === 0)) {
      console.log('🔧 Fixing unit_id for user 79 - setting to [2]');
      
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ unit_id: [2] })
        .eq('id', 79)
        .select();
        
      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        return;
      }
      
      console.log('✅ Successfully updated user unit_id:', updateData);
    } else {
      console.log('✅ User already has unit_id:', userData.unit_id);
    }
    
    // Check other users too
    console.log('\n🔍 Checking all users unit_id status...');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, name, email, unit_id')
      .order('id');
      
    if (allUsersError) {
      console.error('❌ Error fetching all users:', allUsersError);
      return;
    }
    
    console.log('\n📊 All users unit_id status:');
    allUsers.forEach(user => {
      console.log(`ID ${user.id}: ${user.name} - unit_id: ${JSON.stringify(user.unit_id)}`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check and fix
checkAndFixUserUnitId();