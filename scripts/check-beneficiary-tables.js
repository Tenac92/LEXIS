/**
 * Check Beneficiary Tables Script
 * Identifies which beneficiary tables exist in the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBeneficiaryTables() {
  console.log('Checking beneficiary tables in database...');
  
  try {
    // Check for different possible table names
    const tablesToCheck = [
      'Beneficiary',
      'beneficiaries', 
      'beneficiary',
      'Beneficiaries'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        console.log(`\nChecking table: ${tableName}`);
        
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
          
        if (!error) {
          console.log(`✓ Table "${tableName}" exists with ${count} records`);
          
          // Get sample structure
          const { data: sample } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
            
          if (sample && sample.length > 0) {
            console.log('Sample structure:', Object.keys(sample[0]));
          }
        }
      } catch (tableError) {
        console.log(`✗ Table "${tableName}" does not exist or is inaccessible`);
      }
    }
    
    // Also check general table list
    console.log('\nChecking all tables...');
    const { data: tables, error: listError } = await supabase
      .rpc('exec_sql', { 
        sql: `SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name LIKE '%beneficiar%'
              ORDER BY table_name;` 
      });
      
    if (!listError && tables) {
      console.log('Found beneficiary-related tables:', tables);
    } else {
      console.log('Could not list tables:', listError?.message);
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

// Run check
checkBeneficiaryTables()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error);
    process.exit(1);
  });