import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function populateFormulations() {
  try {
    // Get project ID for MIS 5174076
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis, na853, na271, e069, budget_na853, budget_na271, budget_e069')
      .eq('mis', 5174076)
      .single();
    
    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return;
    }
    
    console.log('Found project:', project);
    
    // Check if formulations already exist
    const { data: existingFormulations, error: checkError } = await supabase
      .from('project_formulations')
      .select('*')
      .eq('project_id', project.id);
    
    if (checkError) {
      console.error('Error checking formulations:', checkError);
      return;
    }
    
    if (existingFormulations && existingFormulations.length > 0) {
      console.log('Formulations already exist:', existingFormulations.length);
      return;
    }
    
    // Create formulations based on SA codes
    const formulations = [];
    let sequence = 1;
    
    if (project.na853) {
      formulations.push({
        project_id: project.id,
        decision_id: null, // No linked decision yet
        formulation_sequence: sequence++,
        sa_type: 'ΝΑ853',
        enumeration_code: project.na853,
        protocol_number: `PROT-${project.mis}-NA853`,
        ada: `ADA-${project.mis}-NA853`,
        decision_year: 2024,
        project_budget: project.budget_na853 || 500000,
        total_public_expense: (project.budget_na853 || 500000) * 0.9,
        eligible_public_expense: (project.budget_na853 || 500000) * 0.8,
        epa_version: '1.0',
        decision_status: 'Ενεργή',
        change_type: 'Έγκριση',
        connected_decision_ids: [],
        comments: 'ΣΑ ΝΑ853 για το έργο',
        is_active: true
      });
    }
    
    if (project.na271) {
      formulations.push({
        project_id: project.id,
        decision_id: null,
        formulation_sequence: sequence++,
        sa_type: 'ΝΑ271',
        enumeration_code: project.na271,
        protocol_number: `PROT-${project.mis}-NA271`,
        ada: `ADA-${project.mis}-NA271`,
        decision_year: 2024,
        project_budget: project.budget_na271 || 300000,
        total_public_expense: (project.budget_na271 || 300000) * 0.9,
        eligible_public_expense: (project.budget_na271 || 300000) * 0.8,
        epa_version: '1.0',
        decision_status: 'Ενεργή',
        change_type: 'Έγκριση',
        connected_decision_ids: [],
        comments: 'ΣΑ ΝΑ271 για το έργο',
        is_active: true
      });
    }
    
    if (project.e069) {
      formulations.push({
        project_id: project.id,
        decision_id: null,
        formulation_sequence: sequence++,
        sa_type: 'E069',
        enumeration_code: project.e069,
        protocol_number: `PROT-${project.mis}-E069`,
        ada: `ADA-${project.mis}-E069`,
        decision_year: 2024,
        project_budget: project.budget_e069 || 100000,
        total_public_expense: (project.budget_e069 || 100000) * 0.9,
        eligible_public_expense: (project.budget_e069 || 100000) * 0.8,
        epa_version: '1.0',
        decision_status: 'Ενεργή',
        change_type: 'Έγκριση',
        connected_decision_ids: [],
        comments: 'ΣΑ E069 για το έργο',
        is_active: true
      });
    }
    
    if (formulations.length === 0) {
      console.log('No SA codes found, creating default formulation');
      formulations.push({
        project_id: project.id,
        decision_id: null,
        formulation_sequence: 1,
        sa_type: 'ΝΑ853',
        enumeration_code: '2024ΝΑ85300018',
        protocol_number: `91238/2024`,
        ada: `ΨΤΚΞ46ΝΠΙΘ-4ΗΛ`,
        decision_year: 2024,
        project_budget: 500000,
        total_public_expense: 450000,
        eligible_public_expense: 400000,
        epa_version: '1.0',
        decision_status: 'Ενεργή',
        change_type: 'Έγκριση',
        connected_decision_ids: [],
        comments: 'Στοιχεία κατάρτισης έργου',
        is_active: true
      });
    }
    
    // Insert formulations
    const { data: insertedFormulations, error: insertError } = await supabase
      .from('project_formulations')
      .insert(formulations)
      .select();
    
    if (insertError) {
      console.error('Error inserting formulations:', insertError);
      return;
    }
    
    console.log(`Successfully created ${insertedFormulations.length} formulations for project MIS 5174076`);
    console.log('Formulations:', insertedFormulations);
    
    // Verify by fetching them
    const { data: verifyFormulations, error: verifyError } = await supabase
      .from('project_formulations')
      .select('*')
      .eq('project_id', project.id);
    
    if (verifyError) {
      console.error('Error verifying formulations:', verifyError);
      return;
    }
    
    console.log('Verified formulations in database:', verifyFormulations.length);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

populateFormulations();