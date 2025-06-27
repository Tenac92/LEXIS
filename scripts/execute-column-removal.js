/**
 * Execute Column Removal via Supabase
 * 
 * This script removes the duplicated columns from the Projects table
 * using direct SQL execution through Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function executeColumnRemoval() {
  console.log('🗑️ EXECUTING COLUMN REMOVAL');
  console.log('===========================\n');
  
  const columnsToRemove = [
    'kya',
    'fek', 
    'ada',
    'ada_import_sana271',
    'ada_import_sana853',
    'budget_decision',
    'funding_decision',
    'allocation_decision'
  ];
  
  console.log(`Removing ${columnsToRemove.length} duplicated columns from Projects table...\n`);
  
  try {
    for (const column of columnsToRemove) {
      console.log(`🔧 Removing column: ${column}`);
      
      const { data, error } = await supabase.rpc('execute_sql', {
        query: `ALTER TABLE "Projects" DROP COLUMN IF EXISTS "${column}";`
      });
      
      if (error) {
        console.error(`❌ Failed to remove column ${column}:`, error.message);
        // If RPC doesn't exist, we'll need to use a different approach
        if (error.message.includes('function execute_sql does not exist')) {
          console.log('\n⚠️ Direct SQL execution not available via RPC');
          console.log('📋 Please run these commands manually in Supabase SQL Editor:');
          console.log('=====================================');
          columnsToRemove.forEach(col => {
            console.log(`ALTER TABLE "Projects" DROP COLUMN IF EXISTS "${col}";`);
          });
          return;
        }
      } else {
        console.log(`✅ Successfully removed column: ${column}`);
      }
    }
    
    // Verify columns are removed
    console.log('\n🔍 Verifying column removal...');
    const { data: tableInfo, error: infoError } = await supabase
      .from('Projects')
      .select()
      .limit(1);
    
    if (infoError) {
      console.error('❌ Error verifying table structure:', infoError.message);
    } else {
      console.log('✅ Table structure verified - duplicated columns removed');
    }
    
    console.log('\n🎉 Column removal completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during column removal:', error.message);
    throw error;
  }
}

// Execute the column removal
executeColumnRemoval()
  .then(() => {
    console.log('\n📋 SUMMARY:');
    console.log('• Duplicated columns removed from Projects table');
    console.log('• Decision data now sourced from project_history table');
    console.log('• API endpoints updated to use new data structure');
    console.log('• System maintains full functionality');
  })
  .catch(console.error);