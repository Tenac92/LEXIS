/**
 * Test Budget History Endpoint
 * 
 * This script tests the budget history endpoint functionality
 * and checks the budget_history table data
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

async function testBudgetHistoryTable() {
  console.log('\n=== Testing budget_history table ===');
  
  try {
    // Check if budget_history table exists and get count
    const { data: countData, error: countError } = await supabase
      .from('budget_history')
      .select('id', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error checking budget_history table:', countError);
      return false;
    }
    
    console.log(`✅ budget_history table exists with ${countData?.length || 0} records`);
    
    // Get sample records to verify schema
    const { data: sampleData, error: sampleError } = await supabase
      .from('budget_history')
      .select('id, mis, previous_amount, new_amount, change_type, change_reason, created_by, created_at')
      .limit(3);
    
    if (sampleError) {
      console.error('❌ Error fetching sample data:', sampleError);
      return false;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Sample budget history records:');
      sampleData.forEach((record, index) => {
        console.log(`  ${index + 1}. MIS: ${record.mis}, Change: ${record.change_type}, Amount: ${record.previous_amount} → ${record.new_amount}`);
      });
    } else {
      console.log('⚠️  No budget history records found in table');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing budget_history table:', error);
    return false;
  }
}

async function testBudgetHistoryAPI() {
  console.log('\n=== Testing Budget History API Endpoint ===');
  
  try {
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:3000';
    
    console.log(`Testing endpoint: ${baseUrl}/api/budget/history`);
    
    // Test the API endpoint
    const response = await fetch(`${baseUrl}/api/budget/history?page=1&limit=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response data structure:', {
      status: data.status,
      dataLength: data.data?.length || 0,
      pagination: data.pagination,
      hasStatistics: !!data.statistics
    });
    
    if (data.status === 'success') {
      console.log('✅ Budget history API endpoint working correctly');
      if (data.data && data.data.length > 0) {
        console.log('✅ API returned budget history data');
      } else {
        console.log('⚠️  API working but no data returned');
      }
    } else {
      console.log('❌ API returned error:', data.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing budget history API:', error);
    return false;
  }
}

async function createSampleData() {
  console.log('\n=== Creating Sample Budget History Data ===');
  
  try {
    // Check if we already have data
    const { data: existingData, error: checkError } = await supabase
      .from('budget_history')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error checking existing data:', checkError);
      return false;
    }
    
    if (existingData && existingData.length > 0) {
      console.log('✅ Budget history data already exists, skipping sample creation');
      return true;
    }
    
    // Create sample budget history entries
    const sampleEntries = [
      {
        mis: 5174692,
        previous_amount: '100000.00',
        new_amount: '120000.00',
        change_type: 'budget_increase',
        change_reason: 'Additional funding approved',
        created_by: 86, // ΠΕΠΠΑ ΟΛΓΑ user ID
        project_id: 1
      },
      {
        mis: 5174076,
        previous_amount: '200000.00',
        new_amount: '180000.00',
        change_type: 'budget_decrease',
        change_reason: 'Budget reallocation',
        created_by: 86,
        project_id: 2
      },
      {
        mis: 5174125,
        previous_amount: '150000.00',
        new_amount: '150000.00',
        change_type: 'budget_review',
        change_reason: 'Quarterly review completed',
        created_by: 86,
        project_id: 3
      }
    ];
    
    const { data: insertData, error: insertError } = await supabase
      .from('budget_history')
      .insert(sampleEntries)
      .select();
    
    if (insertError) {
      console.error('❌ Error creating sample data:', insertError);
      return false;
    }
    
    console.log(`✅ Created ${insertData?.length || 0} sample budget history entries`);
    return true;
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Budget History Functionality');
  console.log('=====================================');
  
  const tableTest = await testBudgetHistoryTable();
  
  if (!tableTest) {
    console.log('\n❌ Budget history table test failed, skipping other tests');
    return;
  }
  
  // Create sample data if none exists
  await createSampleData();
  
  // Test the API endpoint
  await testBudgetHistoryAPI();
  
  console.log('\n🏁 Budget history testing complete');
}

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});