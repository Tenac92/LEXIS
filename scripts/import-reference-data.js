/**
 * Import Reference Data Script
 * 
 * This script imports the actual reference data from the CSV exports
 * into the corresponding tables, then populates the project_index table.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importEventTypes() {
  console.log('Importing event_types data...');
  
  try {
    const csvContent = fs.readFileSync('attached_assets/event_types_rows_1750226960629.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    for (const record of records) {
      const { error } = await supabase
        .from('event_types')
        .upsert({ 
          id: parseInt(record.id), 
          name: record.name 
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting event type ${record.name}:`, error.message);
      } else {
        console.log(`✓ Imported event type: ${record.name} (ID: ${record.id})`);
      }
    }
    
    console.log(`Event types import completed: ${records.length} records processed`);
    return records;
  } catch (err) {
    console.error('Error importing event types:', err.message);
    return [];
  }
}

async function importExpenditureTypes() {
  console.log('\nImporting expediture_types data...');
  
  try {
    const csvContent = fs.readFileSync('attached_assets/expediture_types_rows_1750226960630.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    for (const record of records) {
      const { error } = await supabase
        .from('expediture_types')
        .upsert({ 
          id: parseInt(record.id), 
          name: record.expediture_types.trim()
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting expenditure type ${record.expediture_types}:`, error.message);
      } else {
        console.log(`✓ Imported expenditure type: ${record.expediture_types.trim()} (ID: ${record.id})`);
      }
    }
    
    console.log(`Expenditure types import completed: ${records.length} records processed`);
    return records;
  } catch (err) {
    console.error('Error importing expenditure types:', err.message);
    return [];
  }
}

async function importMonadaData() {
  console.log('\nImporting Monada data...');
  
  try {
    const csvContent = fs.readFileSync('attached_assets/Monada_rows (2)_1750226960630.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    for (const record of records) {
      // Parse the JSON fields if they exist
      let unitName, address, director;
      try {
        unitName = record.unit_name ? JSON.parse(record.unit_name) : null;
      } catch (e) {
        unitName = record.unit_name;
      }
      
      try {
        address = record.address ? JSON.parse(record.address) : null;
      } catch (e) {
        address = record.address;
      }
      
      try {
        director = record.director ? JSON.parse(record.director) : null;
      } catch (e) {
        director = record.director;
      }
      
      const { error } = await supabase
        .from('Monada')
        .upsert({ 
          id: record.id,
          unit: record.unit,
          unit_name: unitName,
          parts: record.parts ? JSON.parse(record.parts) : null,
          email: record.email,
          manager: director, // Using director as manager
          address: address
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting Monada ${record.unit}:`, error.message);
      } else {
        console.log(`✓ Imported Monada: ${record.unit} (ID: ${record.id})`);
      }
    }
    
    console.log(`Monada import completed: ${records.length} records processed`);
    return records;
  } catch (err) {
    console.error('Error importing Monada data:', err.message);
    return [];
  }
}

async function importKallikratisData() {
  console.log('\nImporting kallikratis data (first 100 records)...');
  
  try {
    const csvContent = fs.readFileSync('attached_assets/kallikratis_rows (1)_1750226960631.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    // Import first 100 records to avoid overwhelming the database
    const limitedRecords = records.slice(0, 100);
    
    for (const record of limitedRecords) {
      const { error } = await supabase
        .from('kallikratis')
        .upsert({ 
          id: parseInt(record.id),
          name: record.onoma_dimou_koinotitas,
          code: record.code,
          region: record.perifereia
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting kallikratis ${record.onoma_dimou_koinotitas}:`, error.message);
      } else {
        console.log(`✓ Imported kallikratis: ${record.onoma_dimou_koinotitas} (ID: ${record.id})`);
      }
    }
    
    console.log(`Kallikratis import completed: ${limitedRecords.length} records processed (limited from ${records.length} total)`);
    return limitedRecords;
  } catch (err) {
    console.error('Error importing kallikratis data:', err.message);
    return [];
  }
}

async function populateProjectIndex() {
  console.log('\n=== POPULATING PROJECT INDEX TABLE ===');
  
  // Get all projects with their event_type and expenditure_type data
  const { data: projects, error: projectsError } = await supabase
    .from('Projects')
    .select('id, event_type, expenditure_type');
  
  if (projectsError) {
    console.error('Error fetching projects:', projectsError.message);
    return;
  }
  
  console.log(`Processing ${projects.length} projects...`);
  
  // Get reference data for lookups
  const { data: eventTypes } = await supabase.from('event_types').select('id, name');
  const { data: expenditureTypes } = await supabase.from('expediture_types').select('id, name');
  const { data: monadaList } = await supabase.from('Monada').select('id').limit(1);
  const { data: kallikratisList } = await supabase.from('kallikratis').select('id').limit(1);
  
  if (!eventTypes || !expenditureTypes || !monadaList || !kallikratisList) {
    console.error('Missing reference data. Please ensure all reference tables are populated.');
    return;
  }
  
  // Use first available IDs as defaults
  const defaultMonadaId = monadaList[0]?.id || 1;
  const defaultKallikratisId = kallikratisList[0]?.id || 1;
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  // Clear existing project_index data
  console.log('Clearing existing project_index data...');
  await supabase.from('project_index').delete().gte('project_id', 0);
  
  for (const project of projects) {
    try {
      // Parse event_type and expenditure_type arrays
      const eventTypeArray = Array.isArray(project.event_type) ? project.event_type : [];
      const expenditureTypeArray = Array.isArray(project.expenditure_type) ? project.expenditure_type : [];
      
      // Handle cases where arrays are empty or contain null values
      const validEventTypes = eventTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      const validExpenditureTypes = expenditureTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      
      // If no valid types, skip this project or use defaults
      if (validEventTypes.length === 0 || validExpenditureTypes.length === 0) {
        console.log(`Skipping project ${project.id}: No valid event types or expenditure types`);
        skippedCount++;
        continue;
      }
      
      // Create entries for each combination of event_type and expenditure_type
      for (const eventTypeName of validEventTypes) {
        for (const expenditureTypeName of validExpenditureTypes) {
          
          // Find matching IDs in reference tables
          const eventType = eventTypes.find(et => et.name === eventTypeName);
          const expenditureType = expenditureTypes.find(et => et.name === expenditureTypeName);
          
          if (!eventType || !expenditureType) {
            console.log(`Skipping combination for project ${project.id}: Missing reference for "${eventTypeName}" or "${expenditureTypeName}"`);
            continue;
          }
          
          // Insert into project_index
          const { error: insertError } = await supabase
            .from('project_index')
            .insert({
              project_id: project.id,
              monada_id: defaultMonadaId,
              kallikratis_id: defaultKallikratisId,
              event_types_id: eventType.id,
              expediture_type_id: expenditureType.id
            });
          
          if (insertError) {
            console.error(`Error inserting project ${project.id}:`, insertError.message);
            skippedCount++;
          } else {
            insertedCount++;
            console.log(`✓ Inserted: Project ${project.id} - ${eventTypeName} - ${expenditureTypeName}`);
          }
        }
      }
      
    } catch (err) {
      console.error(`Error processing project ${project.id}:`, err.message);
      skippedCount++;
    }
  }
  
  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`✓ Successfully inserted: ${insertedCount} project_index records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`Total projects processed: ${projects.length}`);
}

async function main() {
  console.log('=== IMPORTING REFERENCE DATA AND POPULATING PROJECT INDEX ===\n');
  
  // Import all reference data
  await importEventTypes();
  await importExpenditureTypes();
  await importMonadaData();
  await importKallikratisData();
  
  // Now populate the project_index table
  await populateProjectIndex();
  
  console.log('\n=== ALL OPERATIONS COMPLETED ===');
}

main().catch(console.error);