/**
 * Create and Populate Project Index Script
 * 
 * This script creates the necessary reference tables and populates the project_index table
 * using the actual CSV data provided by the user.
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

async function createEventTypesTable() {
  console.log('Creating event_types table...');
  
  try {
    // First try to select from the table to see if it exists
    const { data: existingData, error: selectError } = await supabase
      .from('event_types')
      .select('id')
      .limit(1);
    
    if (selectError && selectError.message.includes('does not exist')) {
      console.log('Table does not exist, creating it...');
      // Create table using raw SQL
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE public.event_types (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
          );
        `
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.error('Error creating event_types table:', createError.message);
        return false;
      }
    }
    
    console.log('event_types table ready');
    return true;
  } catch (err) {
    console.error('Error with event_types table:', err.message);
    return false;
  }
}

async function createExpenditureTypesTable() {
  console.log('Creating expediture_types table...');
  
  try {
    const { data: existingData, error: selectError } = await supabase
      .from('expediture_types')
      .select('id')
      .limit(1);
    
    if (selectError && selectError.message.includes('does not exist')) {
      console.log('Table does not exist, creating it...');
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE public.expediture_types (
            id INTEGER PRIMARY KEY,
            expediture_types TEXT NOT NULL,
            expediture_types_minor TEXT
          );
        `
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.error('Error creating expediture_types table:', createError.message);
        return false;
      }
    }
    
    console.log('expediture_types table ready');
    return true;
  } catch (err) {
    console.error('Error with expediture_types table:', err.message);
    return false;
  }
}

async function createKallikratisTable() {
  console.log('Creating kallikratis table...');
  
  try {
    const { data: existingData, error: selectError } = await supabase
      .from('kallikratis')
      .select('id')
      .limit(1);
    
    if (selectError && selectError.message.includes('does not exist')) {
      console.log('Table does not exist, creating it...');
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE public.kallikratis (
            id INTEGER PRIMARY KEY,
            onoma_dimou_koinotitas TEXT,
            kodikos_koinotitas TEXT,
            eidos_koinotitas TEXT,
            kodikos_dimotikis_enotitas TEXT,
            onoma_dimotikis_enotitas TEXT,
            kodikos_neou_ota TEXT,
            eidos_neou_ota TEXT,
            onoma_neou_ota TEXT,
            kodikos_perifereiakis_enotitas TEXT,
            perifereiaki_enotita TEXT,
            kodikos_perifereias TEXT,
            perifereia TEXT,
            code TEXT
          );
        `
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.error('Error creating kallikratis table:', createError.message);
        return false;
      }
    }
    
    console.log('kallikratis table ready');
    return true;
  } catch (err) {
    console.error('Error with kallikratis table:', err.message);
    return false;
  }
}

async function importData() {
  console.log('\n=== IMPORTING REFERENCE DATA ===');
  
  // Import event_types
  try {
    const eventTypesCSV = fs.readFileSync('attached_assets/event_types_rows_1750226960629.csv', 'utf-8');
    const eventTypesRecords = parse(eventTypesCSV, { columns: true, skip_empty_lines: true });
    
    for (const record of eventTypesRecords) {
      const { error } = await supabase
        .from('event_types')
        .upsert({ 
          id: parseInt(record.id), 
          name: record.name 
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting event type ${record.name}:`, error.message);
      } else {
        console.log(`✓ Event type: ${record.name}`);
      }
    }
    console.log(`Imported ${eventTypesRecords.length} event types`);
  } catch (err) {
    console.error('Error importing event types:', err.message);
  }
  
  // Import expenditure_types
  try {
    const expenditureCSV = fs.readFileSync('attached_assets/expediture_types_rows_1750226960630.csv', 'utf-8');
    const expenditureRecords = parse(expenditureCSV, { columns: true, skip_empty_lines: true });
    
    for (const record of expenditureRecords) {
      const { error } = await supabase
        .from('expediture_types')
        .upsert({ 
          id: parseInt(record.id), 
          expediture_types: record.expediture_types.trim(),
          expediture_types_minor: record.expediture_types_minor || null
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting expenditure type ${record.expediture_types}:`, error.message);
      } else {
        console.log(`✓ Expenditure type: ${record.expediture_types.trim()}`);
      }
    }
    console.log(`Imported ${expenditureRecords.length} expenditure types`);
  } catch (err) {
    console.error('Error importing expenditure types:', err.message);
  }
  
  // Import kallikratis (first 50 records for performance)
  try {
    const kallikratisCSV = fs.readFileSync('attached_assets/kallikratis_rows (1)_1750226960631.csv', 'utf-8');
    const kallikratisRecords = parse(kallikratisCSV, { columns: true, skip_empty_lines: true });
    const limitedRecords = kallikratisRecords.slice(0, 50);
    
    for (const record of limitedRecords) {
      const { error } = await supabase
        .from('kallikratis')
        .upsert({ 
          id: parseInt(record.id),
          onoma_dimou_koinotitas: record.onoma_dimou_koinotitas,
          kodikos_koinotitas: record.kodikos_koinotitas,
          eidos_koinotitas: record.eidos_koinotitas,
          kodikos_dimotikis_enotitas: record.kodikos_dimotikis_enotitas,
          onoma_dimotikis_enotitas: record.onoma_dimotikis_enotitas,
          kodikos_neou_ota: record.kodikos_neou_ota,
          eidos_neou_ota: record.eidos_neou_ota,
          onoma_neou_ota: record.onoma_neou_ota,
          kodikos_perifereiakis_enotitas: record.kodikos_perifereiakis_enotitas,
          perifereiaki_enotita: record.perifereiaki_enotita,
          kodikos_perifereias: record.kodikos_perifereias,
          perifereia: record.perifereia,
          code: record.code
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`Error inserting kallikratis ${record.onoma_dimou_koinotitas}:`, error.message);
      } else {
        console.log(`✓ Kallikratis: ${record.onoma_dimou_koinotitas}`);
      }
    }
    console.log(`Imported ${limitedRecords.length} kallikratis records (from ${kallikratisRecords.length} total)`);
  } catch (err) {
    console.error('Error importing kallikratis:', err.message);
  }
}

async function populateProjectIndex() {
  console.log('\n=== POPULATING PROJECT INDEX TABLE ===');
  
  // Check if project_index table exists
  const { data: existingIndex, error: indexError } = await supabase
    .from('project_index')
    .select('project_id')
    .limit(1);
  
  if (indexError && indexError.message.includes('does not exist')) {
    console.log('project_index table does not exist. Please create it first using the SQL you provided.');
    return;
  }
  
  // Get reference data
  const { data: eventTypes } = await supabase.from('event_types').select('id, name');
  const { data: expenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  const { data: monadaList } = await supabase.from('Monada').select('id').limit(1);
  const { data: kallikratisList } = await supabase.from('kallikratis').select('id').limit(1);
  
  if (!eventTypes || !expenditureTypes) {
    console.error('Missing reference data for event_types or expenditure_types');
    return;
  }
  
  // Use default IDs for monada and kallikratis
  const defaultMonadaId = monadaList && monadaList.length > 0 ? monadaList[0].id : '1';
  const defaultKallikratisId = kallikratisList && kallikratisList.length > 0 ? kallikratisList[0].id : 1;
  
  // Get all projects
  const { data: projects, error: projectsError } = await supabase
    .from('Projects')
    .select('id, event_type, expenditure_type');
  
  if (projectsError) {
    console.error('Error fetching projects:', projectsError.message);
    return;
  }
  
  console.log(`Processing ${projects.length} projects...`);
  
  // Clear existing project_index data
  console.log('Clearing existing project_index data...');
  const { error: deleteError } = await supabase
    .from('project_index')
    .delete()
    .gte('project_id', 0);
  
  if (deleteError) {
    console.log('Warning: Could not clear existing data:', deleteError.message);
  }
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const project of projects) {
    try {
      const eventTypeArray = Array.isArray(project.event_type) ? project.event_type : [];
      const expenditureTypeArray = Array.isArray(project.expenditure_type) ? project.expenditure_type : [];
      
      const validEventTypes = eventTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      const validExpenditureTypes = expenditureTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      
      if (validEventTypes.length === 0 || validExpenditureTypes.length === 0) {
        skippedCount++;
        continue;
      }
      
      // Create entries for each combination
      for (const eventTypeName of validEventTypes) {
        for (const expenditureTypeName of validExpenditureTypes) {
          
          const eventType = eventTypes.find(et => et.name === eventTypeName);
          const expenditureType = expenditureTypes.find(et => et.expediture_types === expenditureTypeName);
          
          if (!eventType || !expenditureType) {
            continue;
          }
          
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
          }
        }
      }
      
    } catch (err) {
      console.error(`Error processing project ${project.id}:`, err.message);
      skippedCount++;
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✓ Successfully inserted: ${insertedCount} project_index records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`Total projects processed: ${projects.length}`);
}

async function main() {
  console.log('=== CREATING REFERENCE TABLES AND POPULATING PROJECT INDEX ===\n');
  
  // Create tables if they don't exist
  await createEventTypesTable();
  await createExpenditureTypesTable();
  await createKallikratisTable();
  
  // Import data
  await importData();
  
  // Populate project_index
  await populateProjectIndex();
  
  console.log('\n=== COMPLETED ===');
}

main().catch(console.error);