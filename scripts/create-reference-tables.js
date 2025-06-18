/**
 * Create Reference Tables Script
 * 
 * This script creates and populates the reference tables needed for project_index:
 * - event_types
 * - expediture_types
 * - kallikratis (if needed)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function extractUniqueValues() {
  console.log('Extracting unique values from Projects table...');
  
  try {
    // Get all projects to extract unique event_type and expenditure_type values
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('event_type, expenditure_type');
    
    if (error) throw error;
    
    const eventTypes = new Set();
    const expenditureTypes = new Set();
    
    projects.forEach(project => {
      // Handle event_type array
      if (Array.isArray(project.event_type)) {
        project.event_type.forEach(type => {
          if (type && type !== 'null') {
            eventTypes.add(type);
          }
        });
      }
      
      // Handle expenditure_type array
      if (Array.isArray(project.expenditure_type)) {
        project.expenditure_type.forEach(type => {
          if (type && type !== 'null') {
            expenditureTypes.add(type);
          }
        });
      }
    });
    
    console.log(`Found ${eventTypes.size} unique event types:`);
    Array.from(eventTypes).forEach(type => console.log(`  - ${type}`));
    
    console.log(`\nFound ${expenditureTypes.size} unique expenditure types:`);
    Array.from(expenditureTypes).forEach(type => console.log(`  - ${type}`));
    
    return {
      eventTypes: Array.from(eventTypes),
      expenditureTypes: Array.from(expenditureTypes)
    };
    
  } catch (err) {
    console.error('Error extracting values:', err.message);
    return { eventTypes: [], expenditureTypes: [] };
  }
}

async function createEventTypesTable(eventTypes) {
  console.log('\nCreating event_types table...');
  
  try {
    // First, try to create the table
    const { error: createError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS event_types (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    
    if (createError) {
      console.log('Table might already exist:', createError.message);
    } else {
      console.log('✓ event_types table created');
    }
    
    // Insert the unique event types
    for (const eventType of eventTypes) {
      const { error: insertError } = await supabase
        .from('event_types')
        .upsert({ name: eventType }, { onConflict: 'name' });
      
      if (insertError) {
        console.error(`Error inserting ${eventType}:`, insertError.message);
      } else {
        console.log(`✓ Inserted event type: ${eventType}`);
      }
    }
    
  } catch (err) {
    console.error('Error creating event_types table:', err.message);
  }
}

async function createExpenditureTypesTable(expenditureTypes) {
  console.log('\nCreating expediture_types table...');
  
  try {
    // First, try to create the table
    const { error: createError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS expediture_types (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    
    if (createError) {
      console.log('Table might already exist:', createError.message);
    } else {
      console.log('✓ expediture_types table created');
    }
    
    // Insert the unique expenditure types
    for (const expenditureType of expenditureTypes) {
      const { error: insertError } = await supabase
        .from('expediture_types')
        .upsert({ name: expenditureType }, { onConflict: 'name' });
      
      if (insertError) {
        console.error(`Error inserting ${expenditureType}:`, insertError.message);
      } else {
        console.log(`✓ Inserted expenditure type: ${expenditureType}`);
      }
    }
    
  } catch (err) {
    console.error('Error creating expediture_types table:', err.message);
  }
}

async function createKallikratisTable() {
  console.log('\nCreating kallikratis table...');
  
  try {
    // Create a basic kallikratis table with some common Greek municipalities
    const { error: createError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS kallikratis (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          code TEXT,
          region TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    
    if (createError) {
      console.log('Table might already exist:', createError.message);
    } else {
      console.log('✓ kallikratis table created');
    }
    
    // Insert some basic municipalities
    const municipalities = [
      { name: 'ΑΘΗΝΑ', code: '1', region: 'ΑΤΤΙΚΗ' },
      { name: 'ΘΕΣΣΑΛΟΝΙΚΗ', code: '2', region: 'ΚΕΝΤΡΙΚΗ ΜΑΚΕΔΟΝΙΑ' },
      { name: 'ΠΑΤΡΑ', code: '3', region: 'ΔΥΤΙΚΗ ΕΛΛΑΔΑ' },
      { name: 'ΗΡΑΚΛΕΙΟ', code: '4', region: 'ΚΡΗΤΗ' },
      { name: 'ΛΑΡΙΣΑ', code: '5', region: 'ΘΕΣΣΑΛΙΑ' }
    ];
    
    for (const municipality of municipalities) {
      const { error: insertError } = await supabase
        .from('kallikratis')
        .upsert(municipality, { onConflict: 'name' });
      
      if (insertError) {
        console.error(`Error inserting ${municipality.name}:`, insertError.message);
      } else {
        console.log(`✓ Inserted municipality: ${municipality.name}`);
      }
    }
    
  } catch (err) {
    console.error('Error creating kallikratis table:', err.message);
  }
}

async function main() {
  console.log('=== CREATING REFERENCE TABLES ===\n');
  
  // Extract unique values from existing data
  const { eventTypes, expenditureTypes } = await extractUniqueValues();
  
  if (eventTypes.length === 0 || expenditureTypes.length === 0) {
    console.error('No data found to create reference tables');
    return;
  }
  
  // Create and populate reference tables
  await createEventTypesTable(eventTypes);
  await createExpenditureTypesTable(expenditureTypes);
  await createKallikratisTable();
  
  console.log('\n=== REFERENCE TABLES CREATED ===');
  console.log('You can now run the populate-project-index.js script to populate the project_index table.');
}

main().catch(console.error);