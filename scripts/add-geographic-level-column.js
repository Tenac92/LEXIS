/**
 * Add geographic_level column to project_index table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addGeographicLevelColumn() {
  try {
    console.log('Adding geographic_level column to project_index table...');
    
    // First, check if the column already exists
    const { data: columns, error: checkError } = await supabase
      .rpc('get_table_columns', { table_name: 'project_index' });
    
    if (checkError) {
      console.log('Could not check existing columns, proceeding with column addition...');
    } else if (columns && columns.some(col => col.column_name === 'geographic_level')) {
      console.log('Column geographic_level already exists in project_index table');
      return;
    }
    
    // Add the column using raw SQL
    const { error } = await supabase
      .rpc('execute_sql', {
        sql: `ALTER TABLE project_index ADD COLUMN IF NOT EXISTS geographic_level text NOT NULL DEFAULT 'municipality';`
      });
    
    if (error) {
      console.error('Error adding column:', error);
      
      // Try alternative approach - direct query
      const { error: altError } = await supabase
        .from('project_index')
        .select('geographic_level')
        .limit(1);
      
      if (altError && altError.code === '42703') {
        // Column doesn't exist, need to add it manually
        console.log('Column does not exist. Manual database modification required.');
        console.log('Please run this SQL command in your Supabase SQL editor:');
        console.log('ALTER TABLE project_index ADD COLUMN geographic_level text NOT NULL DEFAULT \'municipality\';');
        return;
      }
    } else {
      console.log('Successfully added geographic_level column to project_index table');
    }
    
  } catch (error) {
    console.error('Error in addGeographicLevelColumn:', error);
  }
}

// Run the script
addGeographicLevelColumn().then(() => {
  console.log('Script completed');
  process.exit(0);
});