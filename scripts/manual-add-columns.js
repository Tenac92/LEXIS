/**
 * Manually add geographic_level and geographic_code columns
 * by attempting a direct insert with the new columns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testAndAddColumns() {
  try {
    console.log('Testing insertion with geographic columns...');
    
    // Try to insert a test entry with the new column
    const testEntry = {
      project_id: 1,
      monada_id: 1,
      kallikratis_id: 1,
      event_types_id: 10,
      expediture_type_id: 1,
      geographic_code: 900101
    };
    
    console.log('Attempting test insert:', testEntry);
    
    const { data, error } = await supabase
      .from('project_index')
      .insert(testEntry)
      .select();
    
    if (error) {
      if (error.code === '42703') {
        console.log('Geographic columns do not exist. Please add them manually in Supabase Dashboard:');
        console.log('1. Go to Table Editor > project_index');
        console.log('2. Add column: geographic_level (text, default: municipality)');
        console.log('3. Add column: geographic_code (int8, nullable)');
        console.log('');
        console.log('SQL commands:');
        console.log('ALTER TABLE project_index ADD COLUMN geographic_level text NOT NULL DEFAULT \'municipality\';');
        console.log('ALTER TABLE project_index ADD COLUMN geographic_code bigint;');
      } else {
        console.log('Other error during test insert:', error);
      }
    } else {
      console.log('SUCCESS! Geographic columns exist and working. Test entry created:', data);
      
      // Clean up test entry
      const { error: deleteError } = await supabase
        .from('project_index')
        .delete()
        .match({ 
          project_id: 1,
          monada_id: 1,
          kallikratis_id: 1,
          event_types_id: 10,
          expediture_type_id: 1
        });
      
      if (deleteError) {
        console.log('Note: Could not clean up test entry:', deleteError);
      } else {
        console.log('Test entry cleaned up successfully');
      }
    }
    
  } catch (e) {
    console.log('Caught error:', e);
  }
}

testAndAddColumns().then(() => process.exit(0));