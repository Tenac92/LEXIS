/**
 * Check Beneficiary Schema Script
 * Gets the exact column structure of the beneficiaries table
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBeneficiarySchema() {
  console.log('Checking beneficiaries table schema...');
  
  try {
    // Try to get one record to see actual structure
    const { data: sample, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error fetching sample:', error);
    } else {
      if (sample && sample.length > 0) {
        console.log('Sample record structure:');
        console.log(Object.keys(sample[0]));
        console.log('Sample data:', sample[0]);
      } else {
        console.log('Table exists but is empty');
      }
    }
    
    // Also try to get count
    const { count, error: countError } = await supabase
      .from('beneficiaries')
      .select('*', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`Total records in beneficiaries: ${count}`);
    }
    
    // Try different possible column names that might exist
    const possibleColumns = ['monada', 'unit', 'unit_name', 'department', 'organization'];
    
    for (const col of possibleColumns) {
      try {
        const { data, error } = await supabase
          .from('beneficiaries')
          .select(col)
          .limit(1);
          
        if (!error) {
          console.log(`✓ Column "${col}" exists`);
        }
      } catch (err) {
        console.log(`✗ Column "${col}" does not exist`);
      }
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

// Run check
checkBeneficiarySchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error);
    process.exit(1);
  });