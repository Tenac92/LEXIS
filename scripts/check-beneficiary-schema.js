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
    
    // Check both tables to see which one has data
    console.log('\n=== Checking Beneficiary (legacy) table ===');
    try {
      const { count: legacyCount } = await supabase
        .from('Beneficiary')
        .select('*', { count: 'exact', head: true });
      console.log(`Legacy Beneficiary table records: ${legacyCount}`);
      
      if (legacyCount > 0) {
        const { data: legacySample } = await supabase
          .from('Beneficiary')
          .select('*')
          .limit(1);
        if (legacySample && legacySample.length > 0) {
          console.log('Legacy table structure:', Object.keys(legacySample[0]));
        }
      }
    } catch (error) {
      console.log('Error checking legacy table:', error.message);
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