/**
 * Check Table Schemas Script
 * 
 * This script checks the actual column structure of existing tables
 * to ensure proper data import.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSchema(tableName) {
  console.log(`\nChecking schema for table: ${tableName}`);
  
  try {
    // Try to get column information using information_schema
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.error(`Error getting schema for ${tableName}:`, error.message);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log(`Columns for ${tableName}:`);
      data.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      return data;
    } else {
      console.log(`No columns found for ${tableName} - table might not exist`);
      return null;
    }
  } catch (err) {
    console.error(`Error checking ${tableName}:`, err.message);
    return null;
  }
}

async function checkAllTables() {
  console.log('=== CHECKING TABLE SCHEMAS ===');
  
  const tables = ['event_types', 'expediture_types', 'Monada', 'kallikratis', 'project_index'];
  
  for (const table of tables) {
    await checkTableSchema(table);
  }
  
  // Also check what tables actually exist
  console.log('\n=== CHECKING EXISTING TABLES ===');
  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('event_types', 'expediture_types', 'Monada', 'kallikratis', 'project_index')
        ORDER BY table_name;
      `
    });
    
    if (error) {
      console.error('Error checking existing tables:', error.message);
    } else if (data && data.length > 0) {
      console.log('Existing tables:');
      data.forEach(table => console.log(`  - ${table.table_name}`));
    } else {
      console.log('No matching tables found');
    }
  } catch (err) {
    console.error('Error checking existing tables:', err.message);
  }
}

checkAllTables().catch(console.error);