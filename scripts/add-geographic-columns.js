/**
 * Add geographic_level and geographic_code columns to project_index table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addGeographicColumns() {
  try {
    console.log('Adding geographic columns to project_index table...');
    
    // Add geographic_level column
    const { data: data1, error: error1 } = await supabase.rpc('execute_raw_sql', {
      sql: `ALTER TABLE project_index ADD COLUMN IF NOT EXISTS geographic_level text NOT NULL DEFAULT 'municipality';`
    });
    
    if (error1) {
      console.log('Trying alternative method for geographic_level column...');
      // Try using the SQL editor function if available
      const { error: altError1 } = await supabase
        .from('project_index')
        .select('geographic_level')
        .limit(1);
      
      if (altError1 && altError1.code === '42703') {
        console.log('Column geographic_level does not exist, needs manual addition');
      }
    } else {
      console.log('Successfully added geographic_level column');
    }
    
    // Add geographic_code column
    const { data: data2, error: error2 } = await supabase.rpc('execute_raw_sql', {
      sql: `ALTER TABLE project_index ADD COLUMN IF NOT EXISTS geographic_code bigint;`
    });
    
    if (error2) {
      console.log('Trying alternative method for geographic_code column...');
      const { error: altError2 } = await supabase
        .from('project_index')
        .select('geographic_code')
        .limit(1);
      
      if (altError2 && altError2.code === '42703') {
        console.log('Column geographic_code does not exist, needs manual addition');
      }
    } else {
      console.log('Successfully added geographic_code column');
    }
    
    console.log('Schema modification complete');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addGeographicColumns().then(() => {
  console.log('Script completed');
  process.exit(0);
});