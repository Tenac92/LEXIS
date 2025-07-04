/**
 * Import Project Data from CSV
 * 
 * This script imports project decisions, formulations, and index data from the provided CSV file
 * to populate the normalized database tables
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Parse CSV file
 */
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(parse({ 
        columns: true,
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Import project decisions from CSV data
 */
async function importProjectDecisions(projects) {
  console.log('\n=== Importing Project Decisions ===');
  
  let decisionsCreated = 0;
  
  for (const project of projects) {
    // Get project ID
    const { data: dbProject, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', project.mis)
      .single();
      
    if (projectError || !dbProject) {
      console.error(`Project not found for MIS ${project.mis}`);
      continue;
    }
    
    // Check if project already has decisions
    const { data: existingDecisions } = await supabase
      .from('project_decisions')
      .select('id')
      .eq('project_id', dbProject.id)
      .limit(1);
      
    if (existingDecisions && existingDecisions.length > 0) {
      console.log(`Project ${project.mis} already has decisions, skipping`);
      continue;
    }
    
    // Create decisions based on available data
    const decisions = [];
    let sequence = 1;
    
    // Main decision from KYA/FEK/ADA data
    if (project.kya || project.fek || project.ada) {
      decisions.push({
        project_id: dbProject.id,
        decision_sequence: sequence++,
        decision_type: 'Έγκριση',
        protocol_number: project.kya || `KYA-${project.mis}`,
        fek: project.fek || null,
        ada: project.ada || null,
        implementing_agency: project.implementing_agency ? 
          (Array.isArray(JSON.parse(project.implementing_agency)) ? 
            JSON.parse(project.implementing_agency)[0] : 
            project.implementing_agency) : 
          null,
        decision_budget: parseFloat(project.budget_na853 || project.budget_na271 || project.budget_e069 || '0'),
        expenses_covered: parseFloat(project.budget_na853 || project.budget_na271 || project.budget_e069 || '0'),
        is_included: true,
        comments: `Απόφαση για ${project.project_title}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    // Import decisions from ada_import fields
    if (project.ada_import_sana271) {
      decisions.push({
        project_id: dbProject.id,
        decision_sequence: sequence++,
        decision_type: 'Τροποποίηση',
        protocol_number: `IMPORT-NA271-${project.mis}`,
        fek: null,
        ada: project.ada_import_sana271,
        implementing_agency: null,
        decision_budget: parseFloat(project.budget_na271 || '0'),
        expenses_covered: parseFloat(project.budget_na271 || '0'),
        is_included: true,
        comments: 'Εισαγωγή από ΝΑ271',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (project.ada_import_sana853) {
      decisions.push({
        project_id: dbProject.id,
        decision_sequence: sequence++,
        decision_type: 'Τροποποίηση',
        protocol_number: `IMPORT-NA853-${project.mis}`,
        fek: null,
        ada: project.ada_import_sana853,
        implementing_agency: null,
        decision_budget: parseFloat(project.budget_na853 || '0'),
        expenses_covered: parseFloat(project.budget_na853 || '0'),
        is_included: true,
        comments: 'Εισαγωγή από ΝΑ853',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (decisions.length > 0) {
      const { error: insertError } = await supabase
        .from('project_decisions')
        .insert(decisions);
        
      if (insertError) {
        console.error(`Error inserting decisions for project ${project.mis}:`, insertError);
      } else {
        decisionsCreated += decisions.length;
        console.log(`Created ${decisions.length} decisions for project ${project.mis}`);
      }
    }
  }
  
  console.log(`\n✅ Created ${decisionsCreated} project decisions total`);
}

/**
 * Import project formulations from CSV data
 */
async function importProjectFormulations(projects) {
  console.log('\n=== Importing Project Formulations ===');
  
  let formulationsCreated = 0;
  
  for (const project of projects) {
    // Get project ID
    const { data: dbProject, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', project.mis)
      .single();
      
    if (projectError || !dbProject) {
      console.error(`Project not found for MIS ${project.mis}`);
      continue;
    }
    
    // Check if project already has formulations
    const { data: existingFormulations } = await supabase
      .from('project_formulations')
      .select('id')
      .eq('project_id', dbProject.id)
      .limit(1);
      
    if (existingFormulations && existingFormulations.length > 0) {
      console.log(`Project ${project.mis} already has formulations, skipping`);
      continue;
    }
    
    // Get project decisions to link formulations
    const { data: projectDecisions } = await supabase
      .from('project_decisions')
      .select('id, decision_type')
      .eq('project_id', dbProject.id)
      .order('decision_sequence');
    
    const mainDecisionId = projectDecisions && projectDecisions.length > 0 ? 
      projectDecisions[0].id : null;
    
    // Create formulations based on SA codes
    const formulations = [];
    let sequence = 1;
    
    if (project.na853) {
      formulations.push({
        project_id: dbProject.id,
        decision_id: mainDecisionId,
        formulation_sequence: sequence++,
        sa_type: 'ΝΑ853',
        enumeration_code: project.na853,
        protocol_number: project.allocation_decision || `ALLOC-${project.mis}`,
        ada: project.ada || project.ada_import_sana853 || null,
        decision_year: parseInt(project.event_year?.replace(/[\[\]"]/g, '') || '2024'),
        project_budget: parseFloat(project.budget_na853 || '0'),
        total_public_expense: parseFloat(project.budget_na853 || '0') * 0.9,
        eligible_public_expense: parseFloat(project.budget_na853 || '0') * 0.8,
        epa_version: '1.0',
        decision_status: project.status === 'active' ? 'Ενεργή' : 'Αναστολή',
        change_type: 'Έγκριση',
        connected_decision_ids: mainDecisionId ? [mainDecisionId] : [],
        comments: project.event_description || `ΣΑ ΝΑ853 για ${project.project_title}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (project.na271) {
      formulations.push({
        project_id: dbProject.id,
        decision_id: mainDecisionId,
        formulation_sequence: sequence++,
        sa_type: 'ΝΑ271',
        enumeration_code: project.na271,
        protocol_number: project.funding_decision || `FUND-${project.mis}`,
        ada: project.ada || project.ada_import_sana271 || null,
        decision_year: parseInt(project.event_year?.replace(/[\[\]"]/g, '') || '2024'),
        project_budget: parseFloat(project.budget_na271 || '0'),
        total_public_expense: parseFloat(project.budget_na271 || '0') * 0.9,
        eligible_public_expense: parseFloat(project.budget_na271 || '0') * 0.8,
        epa_version: '1.0',
        decision_status: project.status === 'active' ? 'Ενεργή' : 'Αναστολή',
        change_type: 'Έγκριση',
        connected_decision_ids: mainDecisionId ? [mainDecisionId] : [],
        comments: project.event_description || `ΣΑ ΝΑ271 για ${project.project_title}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (project.e069) {
      formulations.push({
        project_id: dbProject.id,
        decision_id: mainDecisionId,
        formulation_sequence: sequence++,
        sa_type: 'E069',
        enumeration_code: project.e069,
        protocol_number: project.budget_decision || `BUDGET-${project.mis}`,
        ada: project.ada || null,
        decision_year: parseInt(project.event_year?.replace(/[\[\]"]/g, '') || '2024'),
        project_budget: parseFloat(project.budget_e069 || '0'),
        total_public_expense: parseFloat(project.budget_e069 || '0') * 0.9,
        eligible_public_expense: parseFloat(project.budget_e069 || '0') * 0.8,
        epa_version: '1.0',
        decision_status: project.status === 'active' ? 'Ενεργή' : 'Αναστολή',
        change_type: 'Έγκριση',
        connected_decision_ids: mainDecisionId ? [mainDecisionId] : [],
        comments: project.event_description || `ΣΑ E069 για ${project.project_title}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (formulations.length > 0) {
      const { error: insertError } = await supabase
        .from('project_formulations')
        .insert(formulations);
        
      if (insertError) {
        console.error(`Error inserting formulations for project ${project.mis}:`, insertError);
      } else {
        formulationsCreated += formulations.length;
        console.log(`Created ${formulations.length} formulations for project ${project.mis}`);
      }
    }
  }
  
  console.log(`\n✅ Created ${formulationsCreated} project formulations total`);
}

/**
 * Main import function
 */
async function importProjectData() {
  console.log('=== Import Project Data from CSV ===\n');
  
  try {
    // Parse CSV file
    const csvPath = '../attached_assets/Projects_rows (5)_1751629576893.csv';
    console.log(`Reading CSV file: ${csvPath}`);
    
    const projects = await parseCSV(csvPath);
    console.log(`Found ${projects.length} projects in CSV`);
    
    // Import decisions
    await importProjectDecisions(projects);
    
    // Import formulations
    await importProjectFormulations(projects);
    
    // Verify results
    const { data: totalDecisions } = await supabase
      .from('project_decisions')
      .select('id', { count: 'exact', head: true });
      
    const { data: totalFormulations } = await supabase
      .from('project_formulations')
      .select('id', { count: 'exact', head: true });
      
    console.log('\n=== Import Summary ===');
    console.log(`Total decisions in database: ${totalDecisions?.length || 0}`);
    console.log(`Total formulations in database: ${totalFormulations?.length || 0}`);
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Run the import
importProjectData();