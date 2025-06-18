/**
 * Populate Project Index Only Script
 * 
 * This script focuses only on populating the project_index table
 * using the successfully imported reference data.
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

async function populateProjectIndex() {
  console.log('=== POPULATING PROJECT INDEX TABLE ===\n');
  
  // Get reference data
  console.log('Fetching reference data...');
  const { data: eventTypes, error: eventError } = await supabase
    .from('event_types')
    .select('id, name');
  
  const { data: expenditureTypes, error: expError } = await supabase
    .from('expediture_types')
    .select('id, expediture_types');
  
  if (eventError) {
    console.error('Error fetching event types:', eventError.message);
    return;
  }
  
  if (expError) {
    console.error('Error fetching expenditure types:', expError.message);
    return;
  }
  
  if (!eventTypes || eventTypes.length === 0) {
    console.error('No event types found');
    return;
  }
  
  if (!expenditureTypes || expenditureTypes.length === 0) {
    console.error('No expenditure types found');
    return;
  }
  
  console.log(`Found ${eventTypes.length} event types and ${expenditureTypes.length} expenditure types`);
  
  // Get default IDs for monada and kallikratis
  const { data: monadaList } = await supabase.from('Monada').select('id').limit(1);
  const defaultMonadaId = monadaList && monadaList.length > 0 ? monadaList[0].id : '1';
  
  // Use a simple default for kallikratis since the table might not be fully populated
  const defaultKallikratisId = 1;
  
  console.log(`Using default Monada ID: ${defaultMonadaId}, Kallikratis ID: ${defaultKallikratisId}`);
  
  // Get all projects
  console.log('Fetching projects...');
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
  let processedProjects = 0;
  
  for (const project of projects) {
    processedProjects++;
    
    if (processedProjects % 10 === 0) {
      console.log(`Progress: ${processedProjects}/${projects.length} projects processed...`);
    }
    
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
          
          if (!eventType) {
            console.log(`Warning: Event type "${eventTypeName}" not found in reference table`);
            continue;
          }
          
          if (!expenditureType) {
            console.log(`Warning: Expenditure type "${expenditureTypeName}" not found in reference table`);
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
            console.error(`Error inserting project ${project.id} (${eventTypeName}, ${expenditureTypeName}):`, insertError.message);
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
  
  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`✓ Successfully inserted: ${insertedCount} project_index records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`📊 Total projects processed: ${projects.length}`);
  
  // Show some sample data
  console.log('\n=== SAMPLE PROJECT INDEX DATA ===');
  const { data: sampleData } = await supabase
    .from('project_index')
    .select('*')
    .limit(5);
  
  if (sampleData && sampleData.length > 0) {
    console.log('Sample records:');
    sampleData.forEach(record => {
      console.log(`  Project ${record.project_id}: Monada ${record.monada_id}, Kallikratis ${record.kallikratis_id}, Event ${record.event_types_id}, Expenditure ${record.expediture_type_id}`);
    });
  }
}

populateProjectIndex().catch(console.error);