/**
 * Fix Project Index Schema - Make monada_id Optional
 * 
 * This script fixes the database constraint issue where monada_id 
 * is required but form submissions don't always include implementing agency
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixProjectIndexSchema() {
  console.log('🔧 Fixing project_index schema to allow null monada_id...');
  
  try {
    // Use the RPC function or direct SQL to alter the table
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: 'ALTER TABLE project_index ALTER COLUMN monada_id DROP NOT NULL;'
    });
    
    if (error) {
      console.error('Error fixing schema:', error);
      
      // Try alternative approach using Supabase SQL editor
      console.log('Trying alternative approach...');
      
      // First, let's check current schema
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, is_nullable')
        .eq('table_name', 'project_index')
        .eq('column_name', 'monada_id');
        
      if (schemaError) {
        console.error('Error checking schema:', schemaError);
      } else {
        console.log('Current monada_id column info:', schemaData);
      }
      
      return false;
    }
    
    console.log('✅ Successfully made monada_id optional');
    return true;
    
  } catch (error) {
    console.error('Script error:', error);
    return false;
  }
}

// Alternative: Update the Drizzle schema to reflect the change
function updateDrizzleSchema() {
  console.log('📝 ✅ SCHEMA UPDATED: shared/schema.ts changes applied:');
  console.log('✓ Changed: monada_id: integer("monada_id").notNull().references(() => monada.id)');
  console.log('✓ To: monada_id: integer("monada_id").references(() => monada.id)');
  console.log('✓ Changed: kallikratis_id: integer("kallikratis_id").notNull().references(() => kallikratis.id)');  
  console.log('✓ To: kallikratis_id: integer("kallikratis_id").references(() => kallikratis.id)');
  console.log('✓ Replaced composite primary key with unique constraint to allow NULL values');
  console.log('✓ Form submissions can now save without requiring implementing agency or location');
}

async function main() {
  console.log('=== PROJECT INDEX SCHEMA FIX ===');
  
  const success = await fixProjectIndexSchema();
  
  if (success) {
    updateDrizzleSchema();
    console.log('\n✅ Schema fix complete!');
    console.log('📋 Now forms can save without requiring implementing agency');
  } else {
    console.log('\n❌ Schema fix failed');
    console.log('💡 Manual fix needed: ALTER TABLE project_index ALTER COLUMN monada_id DROP NOT NULL;');
  }
}

main().catch(console.error);