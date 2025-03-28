/**
 * Test Budget History Connection
 * 
 * This script tests if we can connect to Supabase and retrieve data
 * from the budget_history table.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBudgetHistoryConnection() {
  console.log('Supabase connection test starting...');
  console.log(`Connecting to Supabase URL: ${supabaseUrl}`);
  
  try {
    // First, test the connection by listing all tables in the database
    const { data: tableList, error: tableError } = await supabase
      .from('budget_history')
      .select('*')
      .limit(10);
    
    console.log('Response from Supabase:', tableList ? 'Data received' : 'No data');
    
    if (tableError) {
      console.error('Error fetching tables from Supabase:', tableError);
      
      // Try with full schema qualification
      console.log('Trying with full schema qualification...');
      const { data: tableListQualified, error: tableErrorQualified } = await supabase
        .from('public.budget_history')
        .select('*')
        .limit(10);
        
      if (tableErrorQualified) {
        console.error('Error with schema qualification:', tableErrorQualified);
      } else {
        console.log('Qualified table data:', tableListQualified);
      }
      
      return;
    }
    
    console.log('Budget history records:');
    console.log(JSON.stringify(tableList, null, 2));
    
    // If we get here, the connection was successful
    console.log(`Successfully retrieved ${tableList.length} budget history records from Supabase.`);
  } catch (e) {
    console.error('Unexpected error during Supabase connection test:', e);
  }
}

testBudgetHistoryConnection()
  .catch(error => {
    console.error('Fatal error:', error);
  });