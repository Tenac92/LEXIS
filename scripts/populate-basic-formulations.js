/**
 * Populate Basic Formulations from Projects Data
 * 
 * This script creates basic formulation entries for projects that don't have them
 * using data from the Projects table (na853, na271, e069 fields)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create basic formulations from project data
 */
async function populateBasicFormulations() {
  console.log('=== Populating Basic Formulations ===\n');
  
  try {
    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, na853, na271, e069, project_title, event_description')
      .order('id');
      
    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return;
    }
    
    console.log(`Found ${projects.length} projects to process`);
    
    let formulations = [];
    let sequence = 1;
    
    for (const project of projects) {
      // Check if project already has formulations
      const { data: existingFormulations, error: checkError } = await supabase
        .from('project_formulations')
        .select('id')
        .eq('project_id', project.id)
        .limit(1);
        
      if (checkError) {
        console.error(`Error checking formulations for project ${project.mis}:`, checkError);
        continue;
      }
      
      if (existingFormulations && existingFormulations.length > 0) {
        console.log(`Project ${project.mis} already has formulations, skipping`);
        continue;
      }
      
      console.log(`Creating formulations for project ${project.mis} (${project.project_title})`);
      
      // Create formulations based on available SA codes
      let formulationSequence = 1;
      
      if (project.na853) {
        formulations.push({
          project_id: project.id,
          formulation_sequence: formulationSequence++,
          sa_type: 'ΝΑ853',
          enumeration_code: project.na853,
          protocol_number: null,
          ada: null,
          decision_year: 2024, // Default year
          project_budget: '0.00',
          total_public_expense: '0.00',
          eligible_public_expense: '0.00',
          epa_version: '1.0',
          decision_status: 'Ενεργή',
          change_type: 'Έγκριση',
          connected_decision_ids: [],
          comments: `Αυτόματη δημιουργία από ${project.project_title}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      if (project.na271) {
        formulations.push({
          project_id: project.id,
          formulation_sequence: formulationSequence++,
          sa_type: 'ΝΑ271',
          enumeration_code: project.na271,
          protocol_number: null,
          ada: null,
          decision_year: 2024,
          project_budget: '0.00',
          total_public_expense: '0.00',
          eligible_public_expense: '0.00',
          epa_version: '1.0',
          decision_status: 'Ενεργή',
          change_type: 'Έγκριση',
          connected_decision_ids: [],
          comments: `Αυτόματη δημιουργία από ${project.project_title}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      if (project.e069) {
        formulations.push({
          project_id: project.id,
          formulation_sequence: formulationSequence++,
          sa_type: 'E069',
          enumeration_code: project.e069,
          protocol_number: null,
          ada: null,
          decision_year: 2024,
          project_budget: '0.00',
          total_public_expense: '0.00',
          eligible_public_expense: '0.00',
          epa_version: '1.0',
          decision_status: 'Ενεργή',
          change_type: 'Έγκριση',
          connected_decision_ids: [],
          comments: `Αυτόματη δημιουργία από ${project.project_title}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    console.log(`\nInserting ${formulations.length} formulations...`);
    
    // Insert formulations in batches
    const batchSize = 50;
    for (let i = 0; i < formulations.length; i += batchSize) {
      const batch = formulations.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('project_formulations')
        .insert(batch);
        
      if (insertError) {
        console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        return;
      }
      
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(formulations.length/batchSize)}`);
    }
    
    console.log(`\n✅ Successfully populated ${formulations.length} formulations for projects`);
    
    // Verify results
    const { data: totalFormulations, error: countError } = await supabase
      .from('project_formulations')
      .select('id', { count: 'exact' });
      
    if (!countError) {
      console.log(`Total formulations in database: ${totalFormulations.length}`);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

populateBasicFormulations();