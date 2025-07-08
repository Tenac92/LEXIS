/**
 * Update Beneficiary Payments Table Schema
 * Removes text fields and adds proper foreign key relationships
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function updateBeneficiaryPaymentsSchema() {
  try {
    console.log('Starting beneficiary_payments table schema update...');

    // First, let's see current table structure
    const { data: currentStructure, error: structureError } = await supabase
      .from('beneficiary_payments')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.log('Current table structure error:', structureError);
    } else {
      console.log('Current table has data:', currentStructure.length > 0);
    }

    // Step 1: Add new foreign key columns
    console.log('\n1. Adding new foreign key columns...');
    
    const alterQueries = [
      'ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS unit_id bigint;',
      'ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS expediture_type_id integer;',
      'ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS document_id bigint;',
      'ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS project_id integer;'
    ];

    for (const query of alterQueries) {
      const { error } = await supabase.rpc('execute_sql', { query });
      if (error) {
        console.error('Error adding column:', query, error);
      } else {
        console.log('✓ Added column successfully');
      }
    }

    // Step 2: Remove old text columns and constraints
    console.log('\n2. Removing old columns and constraints...');
    
    const dropQueries = [
      'ALTER TABLE beneficiary_payments DROP CONSTRAINT IF EXISTS beneficiary_payments_beneficiary_id_unit_code_na853_code_ex_key;',
      'ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS unit_code;',
      'ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS na853_code;',
      'ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS expenditure_type;',
      'ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS protocol_number;'
    ];

    for (const query of dropQueries) {
      const { error } = await supabase.rpc('execute_sql', { query });
      if (error) {
        console.error('Error dropping column/constraint:', query, error);
      } else {
        console.log('✓ Removed column/constraint successfully');
      }
    }

    // Step 3: Add foreign key constraints
    console.log('\n3. Adding foreign key constraints...');
    
    const constraintQueries = [
      'ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES "Monada" (id);',
      'ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_expediture_type_id_fkey FOREIGN KEY (expediture_type_id) REFERENCES expediture_types (id);',
      'ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_document_id_fkey FOREIGN KEY (document_id) REFERENCES generated_documents (id);',
      'ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES "Projects" (id);'
    ];

    for (const query of constraintQueries) {
      const { error } = await supabase.rpc('execute_sql', { query });
      if (error) {
        console.error('Error adding constraint:', query, error);
      } else {
        console.log('✓ Added foreign key constraint successfully');
      }
    }

    // Step 4: Verify final structure
    console.log('\n4. Verifying updated table structure...');
    
    const { data: finalStructure, error: finalError } = await supabase
      .from('beneficiary_payments')
      .select('*')
      .limit(1);
    
    if (finalError) {
      console.error('Final verification error:', finalError);
    } else {
      console.log('✓ Table updated successfully');
      console.log('Final structure verified with', finalStructure.length, 'test records');
    }

    console.log('\n🎉 Beneficiary payments table schema update completed!');
    
  } catch (error) {
    console.error('Error updating schema:', error);
  }
}

// Run the migration
updateBeneficiaryPaymentsSchema().then(() => {
  console.log('Migration script completed');
}).catch(console.error);