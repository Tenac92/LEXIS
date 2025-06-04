/**
 * Create Beneficiary Table Script
 * Creates the legacy Beneficiary table with correct structure
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createBeneficiaryTable() {
  console.log('Creating Beneficiary table with correct structure...');
  
  try {
    // Create the legacy Beneficiary table with expected columns
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "Beneficiary" (
        id SERIAL PRIMARY KEY,
        "a / a" INTEGER,
        region TEXT,
        adeia INTEGER,
        surname TEXT,
        name TEXT,
        fathername TEXT,
        freetext TEXT,
        afm INTEGER,
        date TEXT,
        monada TEXT,
        cengsur1 TEXT,
        cengname1 TEXT,
        cengsur2 TEXT,
        cengname2 TEXT,
        onlinefoldernumber TEXT,
        project INTEGER,
        oikonomika JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    // Execute the SQL using a direct query
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.error('Error creating table:', error);
      // Try alternative approach without RPC
      console.log('Trying alternative approach...');
      
      // Since RPC might not work, let's use Supabase client directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql: createTableSQL })
      });
      
      if (!response.ok) {
        console.error('HTTP error:', response.status, response.statusText);
        
        // Manual table creation approach
        console.log('Creating table manually using individual operations...');
        
        // Try to create using Supabase schema methods
        const { error: createError } = await supabase
          .from('Beneficiary')
          .insert([])
          .limit(0);
          
        if (createError && createError.code === '42P01') {
          console.log('Table does not exist, this is expected. We need database admin access to create it.');
          console.log('Table creation SQL:', createTableSQL);
          return false;
        }
      } else {
        console.log('✓ Table created successfully via HTTP');
        return true;
      }
    } else {
      console.log('✓ Table created successfully via RPC');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

// Run creation
createBeneficiaryTable()
  .then(success => {
    if (success) {
      console.log('Beneficiary table is ready!');
    } else {
      console.log('Could not create table - may need manual database setup');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });