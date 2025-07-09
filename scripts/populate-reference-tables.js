#!/usr/bin/env node
/**
 * Populate Empty Reference Tables
 * This script populates the empty reference tables with proper data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Expenditure Types Data
const expenditureTypes = [
  { id: 1, name: 'Μελέτες', description: 'Δαπάνες για μελέτες', category: 'studies' },
  { id: 2, name: 'Έργα', description: 'Δαπάνες για έργα', category: 'works' },
  { id: 3, name: 'Προμήθειες', description: 'Δαπάνες για προμήθειες', category: 'supplies' },
  { id: 4, name: 'Υπηρεσίες', description: 'Δαπάνες για υπηρεσίες', category: 'services' },
  { id: 5, name: 'Λοιπές δαπάνες', description: 'Άλλες δαπάνες', category: 'other' },
  { id: 6, name: 'Τεχνική υποστήριξη', description: 'Δαπάνες τεχνικής υποστήριξης', category: 'technical_support' },
  { id: 7, name: 'Εξοπλισμός', description: 'Δαπάνες εξοπλισμού', category: 'equipment' },
  { id: 8, name: 'Λειτουργικές δαπάνες', description: 'Λειτουργικές δαπάνες', category: 'operational' }
];

async function populateExpenditureTypes() {
  console.log('🔄 Populating expenditure_types table...');
  
  try {
    // Check if table exists and has data
    const { data: existing, error: checkError } = await supabase
      .from('expenditure_types')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error checking expenditure_types table:', checkError.message);
      return false;
    }
    
    if (existing && existing.length > 0) {
      console.log('ℹ️  expenditure_types table already has data, skipping...');
      return true;
    }
    
    // Insert expenditure types
    const { error } = await supabase
      .from('expenditure_types')
      .insert(expenditureTypes);
    
    if (error) {
      console.error('❌ Error inserting expenditure types:', error.message);
      return false;
    }
    
    console.log('✅ Successfully populated expenditure_types table with 8 records');
    return true;
    
  } catch (error) {
    console.error('❌ Error populating expenditure_types:', error.message);
    return false;
  }
}

async function createExpenditureTypesTable() {
  console.log('🔄 Creating expenditure_types table...');
  
  try {
    // Check if table exists first
    const { data: tableExists } = await supabase
      .from('expenditure_types')
      .select('id')
      .limit(1);
    
    if (tableExists !== null) {
      console.log('ℹ️  expenditure_types table already exists');
      return true;
    }
    
    console.log('✅ Table exists or will be created by schema');
    return true;
    
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return false;
  }
}

async function populateUserPreferences() {
  console.log('🔄 Populating user_preferences table...');
  
  try {
    // Check if table exists and has data
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error checking user_preferences table:', checkError.message);
      return false;
    }
    
    if (existing && existing.length > 0) {
      console.log('ℹ️  user_preferences table already has data, skipping...');
      return true;
    }
    
    // Get some users to create sample preferences
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(5);
    
    if (userError || !users || users.length === 0) {
      console.log('ℹ️  No users found, skipping user preferences');
      return true;
    }
    
    // Create sample preferences for users
    const preferences = [];
    users.forEach(user => {
      preferences.push(
        {
          user_id: user.id,
          preference_type: 'esdian',
          preference_key: 'field1',
          preference_value: 'Προς εκτέλεση',
          usage_count: 1
        },
        {
          user_id: user.id,
          preference_type: 'esdian',
          preference_key: 'field2',
          preference_value: 'Για ενέργεια',
          usage_count: 2
        }
      );
    });
    
    const { error } = await supabase
      .from('user_preferences')
      .insert(preferences);
    
    if (error) {
      console.error('❌ Error inserting user preferences:', error.message);
      return false;
    }
    
    console.log(`✅ Successfully populated user_preferences table with ${preferences.length} records`);
    return true;
    
  } catch (error) {
    console.error('❌ Error populating user_preferences:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting reference table population...\n');
  
  // Step 1: Create and populate expenditure_types
  const tableCreated = await createExpenditureTypesTable();
  if (!tableCreated) {
    console.error('❌ Failed to create expenditure_types table');
    return;
  }
  
  const expenditureSuccess = await populateExpenditureTypes();
  if (!expenditureSuccess) {
    console.error('❌ Failed to populate expenditure_types table');
    return;
  }
  
  // Step 2: Populate user_preferences
  const preferencesSuccess = await populateUserPreferences();
  if (!preferencesSuccess) {
    console.error('❌ Failed to populate user_preferences table');
    return;
  }
  
  console.log('\n🎉 Reference table population completed successfully!');
  
  // Verify the data
  console.log('\n📊 Verification:');
  try {
    const { data: expenditureCount } = await supabase
      .from('expenditure_types')
      .select('*', { count: 'exact', head: true });
    
    const { data: preferencesCount } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ expenditure_types: ${expenditureCount || 0} records`);
    console.log(`✅ user_preferences: ${preferencesCount || 0} records`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

main().catch(console.error);