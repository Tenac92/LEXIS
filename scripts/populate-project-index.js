/**
 * Populate Project Index Table Script
 * 
 * This script populates the project_index table by extracting data from the
 * existing Projects table JSONB fields and matching them with the referenced tables.
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

async function checkTablesExist() {
  console.log('Checking if required tables exist...');
  
  const tables = ['Projects', 'Monada', 'kallikratis', 'event_types', 'expediture_types', 'project_index'];
  const existingTables = [];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error) {
        existingTables.push(table);
        console.log(`✓ Table ${table} exists`);
      } else {
        console.log(`✗ Table ${table} not found: ${error.message}`);
      }
    } catch (err) {
      console.log(`✗ Table ${table} not accessible: ${err.message}`);
    }
  }
  
  return existingTables;
}

async function analyzeProjectsData() {
  console.log('\nAnalyzing Projects table structure...');
  
  try {
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('id, event_type, expenditure_type')
      .limit(5);
    
    if (error) throw error;
    
    console.log('Sample Projects data:');
    projects.forEach((project, index) => {
      console.log(`Project ${project.id}:`);
      console.log(`  event_type: ${JSON.stringify(project.event_type)}`);
      console.log(`  expenditure_type: ${JSON.stringify(project.expenditure_type)}`);
      if (index < projects.length - 1) console.log('---');
    });
    
    return projects;
  } catch (err) {
    console.error('Error analyzing Projects table:', err.message);
    return [];
  }
}

async function getReferenceTables() {
  console.log('\nFetching reference table data...');
  
  const references = {
    monada: [],
    kallikratis: [],
    event_types: [],
    expediture_types: []
  };
  
  try {
    // Get Monada data
    const { data: monadaData, error: monadaError } = await supabase
      .from('Monada')
      .select('id, unit, unit_name');
    
    if (!monadaError) {
      references.monada = monadaData;
      console.log(`✓ Found ${monadaData.length} Monada records`);
    } else {
      console.log(`✗ Error fetching Monada: ${monadaError.message}`);
    }
    
    // Get kallikratis data
    const { data: kallikratisData, error: kallikratisError } = await supabase
      .from('kallikratis')
      .select('id, name');
    
    if (!kallikratisError) {
      references.kallikratis = kallikratisData;
      console.log(`✓ Found ${kallikratisData.length} kallikratis records`);
    } else {
      console.log(`✗ Error fetching kallikratis: ${kallikratisError.message}`);
    }
    
    // Get event_types data
    const { data: eventTypesData, error: eventTypesError } = await supabase
      .from('event_types')
      .select('id, name');
    
    if (!eventTypesError) {
      references.event_types = eventTypesData;
      console.log(`✓ Found ${eventTypesData.length} event_types records`);
    } else {
      console.log(`✗ Error fetching event_types: ${eventTypesError.message}`);
    }
    
    // Get expediture_types data
    const { data: expeditureTypesData, error: expeditureTypesError } = await supabase
      .from('expediture_types')
      .select('id, name');
    
    if (!expeditureTypesError) {
      references.expediture_types = expeditureTypesData;
      console.log(`✓ Found ${expeditureTypesData.length} expediture_types records`);
    } else {
      console.log(`✗ Error fetching expediture_types: ${expeditureTypesError.message}`);
    }
    
  } catch (err) {
    console.error('Error fetching reference tables:', err.message);
  }
  
  return references;
}

async function populateProjectIndex() {
  console.log('\n=== POPULATING PROJECT INDEX TABLE ===\n');
  
  // Check if tables exist
  const existingTables = await checkTablesExist();
  
  if (!existingTables.includes('project_index')) {
    console.log('\n❌ project_index table not found. Please create it first.');
    return;
  }
  
  if (!existingTables.includes('Projects')) {
    console.log('\n❌ Projects table not found. Cannot proceed.');
    return;
  }
  
  // Analyze current data
  await analyzeProjectsData();
  
  // Get reference tables
  const references = await getReferenceTables();
  
  // Get all projects
  console.log('\nFetching all projects...');
  const { data: allProjects, error: projectsError } = await supabase
    .from('Projects')
    .select('id, event_type, expenditure_type');
  
  if (projectsError) {
    console.error('Error fetching projects:', projectsError.message);
    return;
  }
  
  console.log(`Found ${allProjects.length} projects to process`);
  
  // Process each project
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const project of allProjects) {
    try {
      // Parse event_type and expenditure_type arrays
      const eventTypes = Array.isArray(project.event_type) ? project.event_type : [];
      const expenditureTypes = Array.isArray(project.expenditure_type) ? project.expenditure_type : [];
      
      // For now, we'll create entries for all combinations
      // You may need to adjust this logic based on your specific requirements
      
      // Default values if references are missing
      const defaultMonadaId = references.monada.length > 0 ? references.monada[0].id : 1;
      const defaultKallikratisId = references.kallikratis.length > 0 ? references.kallikratis[0].id : 1;
      
      // Create entries for each combination of event_type and expenditure_type
      for (const eventType of eventTypes.length > 0 ? eventTypes : [null]) {
        for (const expenditureType of expenditureTypes.length > 0 ? expenditureTypes : [null]) {
          
          // Find matching IDs in reference tables
          const eventTypeId = references.event_types.find(et => et.name === eventType)?.id;
          const expenditureTypeId = references.expediture_types.find(et => et.name === expenditureType)?.id;
          
          // Skip if we can't find matching references
          if (!eventTypeId || !expenditureTypeId) {
            console.log(`Skipping project ${project.id}: Missing references for event_type "${eventType}" or expenditure_type "${expenditureType}"`);
            skippedCount++;
            continue;
          }
          
          // Insert into project_index
          const { error: insertError } = await supabase
            .from('project_index')
            .insert({
              project_id: project.id,
              monada_id: defaultMonadaId,
              kallikratis_id: defaultKallikratisId,
              event_types_id: eventTypeId,
              expediture_type_id: expenditureTypeId
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
  console.log(`✓ Inserted: ${insertedCount} records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`Total processed: ${allProjects.length} projects`);
}

// Run the script
populateProjectIndex().catch(console.error);