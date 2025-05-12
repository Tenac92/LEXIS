/**
 * Test Budget History Connection to Supabase
 * 
 * This script tests if the budget_history table exists and contains data in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Initialize dotenv to load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment');
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBudgetHistory() {
  console.log('Testing budget_history table access...');
  
  try {
    // Test 1: Check if budget_history table exists by attempting to count entries
    const { count, error: countError } = await supabase
      .from('budget_history')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error checking budget_history table:', countError);
      
      // Check if this is a "not found" error which would indicate the table doesn't exist
      if (countError.code === 'PGRST204' || countError.message.includes('relation') || countError.message.includes('not found')) {
        console.error('The budget_history table does not appear to exist in the database');
      }
      return;
    }
    
    console.log(`Budget history table exists with ${count} entries`);
    
    // Test 2: Try to fetch a few records from budget_history
    const { data, error } = await supabase
      .from('budget_history')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error('Error fetching data from budget_history:', error);
      return;
    }
    
    console.log('Sample budget history data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Test 3: Check SQL insert from the user
    const sampleData = `INSERT INTO "public"."budget_history" ("id", "mis", "previous_amount", "new_amount", "change_type", "change_reason", "document_id", "created_by", "created_at", "updated_at") VALUES ('1', '5168550', '200000', '19000', 'epda', null, null, null, '2025-03-26 08:05:23.577718+00', '2025-03-26 08:05:23.577718+00');`;
    console.log('User provided sample data:');
    console.log(sampleData);
    
    // Look for specific MIS from the sample data
    const { data: misData, error: misError } = await supabase
      .from('budget_history')
      .select('*')
      .eq('mis', '5168550');
    
    if (misError) {
      console.error('Error searching for MIS 5168550:', misError);
    } else {
      console.log(`Found ${misData.length} entries for MIS 5168550`);
      if (misData.length > 0) {
        console.log('First entry:');
        console.log(JSON.stringify(misData[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Unexpected error during budget history test:', error);
  }
}

// Execute the test
testBudgetHistory()
  .then(() => {
    console.log('Test completed');
  })
  .catch(err => {
    console.error('Fatal error:', err);
  });