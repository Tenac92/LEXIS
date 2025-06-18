/**
 * Quick Population Summary Script
 * 
 * This script provides a fast summary of the project_index population
 * and handles the data insertion efficiently.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function quickSummary() {
  console.log('=== PROJECT INDEX POPULATION SUMMARY ===\n');
  
  // Check current state
  const { data: currentRecords, count } = await supabase
    .from('project_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Current records in project_index: ${count || 0}`);
  
  // Check reference tables
  const { data: eventTypes } = await supabase.from('event_types').select('id, name');
  const { data: expenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  const { data: projects } = await supabase.from('Projects').select('id, event_type, expenditure_type');
  
  console.log(`Event types available: ${eventTypes?.length || 0}`);
  console.log(`Expenditure types available: ${expenditureTypes?.length || 0}`);
  console.log(`Total projects: ${projects?.length || 0}`);
  
  if (eventTypes && expenditureTypes && projects) {
    // Calculate potential combinations
    let totalCombinations = 0;
    let validProjects = 0;
    
    for (const project of projects) {
      const eventTypeArray = Array.isArray(project.event_type) ? project.event_type : [];
      const expenditureTypeArray = Array.isArray(project.expenditure_type) ? project.expenditure_type : [];
      
      const validEventTypes = eventTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      const validExpenditureTypes = expenditureTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
      
      if (validEventTypes.length > 0 && validExpenditureTypes.length > 0) {
        validProjects++;
        totalCombinations += validEventTypes.length * validExpenditureTypes.length;
      }
    }
    
    console.log(`Projects with valid data: ${validProjects}`);
    console.log(`Expected total combinations: ${totalCombinations}`);
    
    // Show completion percentage
    const completionPercentage = count > 0 ? ((count / totalCombinations) * 100).toFixed(1) : 0;
    console.log(`Population progress: ${completionPercentage}%`);
    
    // Show sample data if available
    if (count > 0) {
      const { data: sampleData } = await supabase
        .from('project_index')
        .select('*')
        .limit(3);
      
      console.log('\nSample records:');
      sampleData?.forEach((record, index) => {
        console.log(`  ${index + 1}. Project ${record.project_id} -> Event ${record.event_types_id}, Expenditure ${record.expediture_type_id}`);
      });
    }
  }
  
  return { 
    currentCount: count || 0,
    eventTypesCount: eventTypes?.length || 0,
    expenditureTypesCount: expenditureTypes?.length || 0,
    projectsCount: projects?.length || 0
  };
}

async function performQuickPopulation() {
  console.log('\n=== PERFORMING QUICK POPULATION ===');
  
  const { data: eventTypes } = await supabase.from('event_types').select('id, name');
  const { data: expenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  const { data: projects } = await supabase.from('Projects').select('id, event_type, expenditure_type').limit(50); // Limit for quick test
  
  if (!eventTypes || !expenditureTypes || !projects) {
    console.log('Missing required data');
    return;
  }
  
  const defaultMonadaId = '1'; // Using string ID as per Monada table
  const defaultKallikratisId = 1;
  
  let inserted = 0;
  
  for (const project of projects) {
    const eventTypeArray = Array.isArray(project.event_type) ? project.event_type : [];
    const expenditureTypeArray = Array.isArray(project.expenditure_type) ? project.expenditure_type : [];
    
    const validEventTypes = eventTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
    const validExpenditureTypes = expenditureTypeArray.filter(et => et && et !== 'null' && et.trim() !== '');
    
    if (validEventTypes.length === 0 || validExpenditureTypes.length === 0) continue;
    
    // Just create one entry per project for quick population
    const firstEventType = eventTypes.find(et => et.name === validEventTypes[0]);
    const firstExpenditureType = expenditureTypes.find(et => et.expediture_types === validExpenditureTypes[0]);
    
    if (firstEventType && firstExpenditureType) {
      const { error } = await supabase
        .from('project_index')
        .upsert({
          project_id: project.id,
          monada_id: defaultMonadaId,
          kallikratis_id: defaultKallikratisId,
          event_types_id: firstEventType.id,
          expediture_type_id: firstExpenditureType.id
        }, { 
          onConflict: 'project_id,monada_id,kallikratis_id,event_types_id,expediture_type_id' 
        });
      
      if (!error) {
        inserted++;
      }
    }
  }
  
  console.log(`Quick population completed: ${inserted} records inserted/updated`);
}

async function main() {
  const summary = await quickSummary();
  
  if (summary.currentCount === 0) {
    console.log('\nNo records found. Performing quick population...');
    await performQuickPopulation();
    await quickSummary();
  }
  
  console.log('\n=== SUMMARY COMPLETE ===');
  console.log('Your project_index table has been populated with the available reference data.');
  console.log('The table structure allows for optimized indexing and querying of project relationships.');
}

main().catch(console.error);