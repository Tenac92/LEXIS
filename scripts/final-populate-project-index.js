/**
 * Final Project Index Population Script
 * 
 * This script handles missing reference data by creating entries for any
 * event types or expenditure types found in projects but not in reference tables.
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

async function ensureAllReferenceData() {
  console.log('Ensuring all reference data exists...');
  
  // Get all unique event types and expenditure types from projects
  const { data: projects } = await supabase
    .from('Projects')
    .select('event_type, expenditure_type');
  
  if (!projects) {
    console.error('Could not fetch projects');
    return { eventTypes: [], expenditureTypes: [] };
  }
  
  const allEventTypes = new Set();
  const allExpenditureTypes = new Set();
  
  projects.forEach(project => {
    if (Array.isArray(project.event_type)) {
      project.event_type.forEach(et => {
        if (et && et !== 'null' && et.trim() !== '') {
          allEventTypes.add(et.trim());
        }
      });
    }
    
    if (Array.isArray(project.expenditure_type)) {
      project.expenditure_type.forEach(et => {
        if (et && et !== 'null' && et.trim() !== '') {
          allExpenditureTypes.add(et.trim());
        }
      });
    }
  });
  
  console.log(`Found ${allEventTypes.size} unique event types in projects`);
  console.log(`Found ${allExpenditureTypes.size} unique expenditure types in projects`);
  
  // Get existing reference data
  const { data: existingEventTypes } = await supabase.from('event_types').select('id, name');
  const { data: existingExpenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  
  const existingEventNames = new Set(existingEventTypes?.map(et => et.name) || []);
  const existingExpenditureNames = new Set(existingExpenditureTypes?.map(et => et.expediture_types) || []);
  
  // Find missing event types
  const missingEventTypes = Array.from(allEventTypes).filter(et => !existingEventNames.has(et));
  const missingExpenditureTypes = Array.from(allExpenditureTypes).filter(et => !existingExpenditureNames.has(et));
  
  console.log(`Missing event types: ${missingEventTypes.length}`);
  console.log(`Missing expenditure types: ${missingExpenditureTypes.length}`);
  
  // Add missing event types
  let nextEventId = Math.max(...(existingEventTypes?.map(et => et.id) || [0])) + 1;
  for (const eventType of missingEventTypes) {
    const { error } = await supabase
      .from('event_types')
      .insert({ id: nextEventId, name: eventType });
    
    if (error) {
      console.error(`Error adding event type ${eventType}:`, error.message);
    } else {
      console.log(`Added missing event type: ${eventType} (ID: ${nextEventId})`);
    }
    nextEventId++;
  }
  
  // Add missing expenditure types
  let nextExpenditureId = Math.max(...(existingExpenditureTypes?.map(et => et.id) || [0])) + 1;
  for (const expenditureType of missingExpenditureTypes) {
    const { error } = await supabase
      .from('expediture_types')
      .insert({ id: nextExpenditureId, expediture_types: expenditureType });
    
    if (error) {
      console.error(`Error adding expenditure type ${expenditureType}:`, error.message);
    } else {
      console.log(`Added missing expenditure type: ${expenditureType} (ID: ${nextExpenditureId})`);
    }
    nextExpenditureId++;
  }
  
  // Return updated reference data
  const { data: updatedEventTypes } = await supabase.from('event_types').select('id, name');
  const { data: updatedExpenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  
  return {
    eventTypes: updatedEventTypes || [],
    expenditureTypes: updatedExpenditureTypes || []
  };
}

async function populateProjectIndex() {
  console.log('\n=== POPULATING PROJECT INDEX TABLE ===');
  
  // Ensure all reference data exists
  const { eventTypes, expenditureTypes } = await ensureAllReferenceData();
  
  if (eventTypes.length === 0 || expenditureTypes.length === 0) {
    console.error('No reference data available');
    return;
  }
  
  // Get default IDs
  const { data: monadaList } = await supabase.from('Monada').select('id').limit(1);
  const defaultMonadaId = monadaList && monadaList.length > 0 ? monadaList[0].id : '1';
  const defaultKallikratisId = 1;
  
  // Get all projects
  const { data: projects, error: projectsError } = await supabase
    .from('Projects')
    .select('id, event_type, expenditure_type');
  
  if (projectsError) {
    console.error('Error fetching projects:', projectsError.message);
    return;
  }
  
  console.log(`Processing ${projects.length} projects...`);
  
  // Clear existing data
  await supabase.from('project_index').delete().gte('project_id', 0);
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  // Process in batches to avoid timeout
  const batchSize = 20;
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(projects.length/batchSize)}`);
    
    for (const project of batch) {
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
            
            const eventType = eventTypes.find(et => et.name === eventTypeName.trim());
            const expenditureType = expenditureTypes.find(et => et.expediture_types === expenditureTypeName.trim());
            
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
            
            if (!insertError) {
              insertedCount++;
            } else {
              skippedCount++;
            }
          }
        }
        
      } catch (err) {
        skippedCount++;
      }
    }
  }
  
  console.log(`\n=== COMPLETED ===`);
  console.log(`✓ Successfully inserted: ${insertedCount} project_index records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`📊 Total projects: ${projects.length}`);
  
  // Verify results
  const { data: totalRecords, count } = await supabase
    .from('project_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📋 Total records in project_index table: ${count}`);
  
  return { insertedCount, skippedCount, totalCount: count };
}

populateProjectIndex().catch(console.error);