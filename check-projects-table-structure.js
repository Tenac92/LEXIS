/**
 * Check Projects Table Structure
 * Get the actual structure of the Projects table to fix schema issues
 */

import { createClient } from '@supabase/supabase-js';

async function checkProjectsTableStructure() {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Testing Projects table structure...');
    
    // Try to get one record to see available columns
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying Projects table:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n=== Projects Table Columns ===');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        console.log(`- ${col}: ${typeof data[0][col]} (${data[0][col] === null ? 'NULL' : 'has value'})`);
      });
      
      console.log('\n=== Sample Data ===');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No data found in Projects table');
    }

    // Check if problematic columns exist by trying to select them
    console.log('\n=== Testing Problematic Columns ===');
    const problematicColumns = ['ada', 'kya', 'fek', 'ada_import_sana271', 'ada_import_sana853'];
    
    for (const col of problematicColumns) {
      try {
        const { data: testData, error: testError } = await supabase
          .from('Projects')
          .select(col)
          .limit(1);
        
        if (testError) {
          console.log(`❌ Column '${col}' does NOT exist: ${testError.message}`);
        } else {
          console.log(`✅ Column '${col}' exists`);
        }
      } catch (e) {
        console.log(`❌ Column '${col}' does NOT exist: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error checking Projects table structure:', error);
  }
}

checkProjectsTableStructure();