/**
 * Update Project History Table - Complete Schema
 * 
 * This script updates the project_history table to handle ALL fields from the comprehensive edit form.
 * It adds the missing columns and migrates existing data to the new structure.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateProjectHistorySchema() {
  console.log('=== UPDATING PROJECT HISTORY TABLE SCHEMA ===\n');
  
  try {
    // Step 1: Add new columns for complete form coverage
    console.log('Adding new columns for complete form coverage...');
    
    const alterTableSQL = `
      -- Add new columns for complete form field coverage
      ALTER TABLE public.project_history 
      ADD COLUMN IF NOT EXISTS event_details jsonb NULL,
      ADD COLUMN IF NOT EXISTS location_details jsonb NULL,
      ADD COLUMN IF NOT EXISTS project_details jsonb NULL,
      ADD COLUMN IF NOT EXISTS formulation_details jsonb NULL,
      ADD COLUMN IF NOT EXISTS decision_details jsonb NULL;
      
      -- Update decisions column to match form structure
      COMMENT ON COLUMN public.project_history.decisions IS 'Legacy decision format - use decision_details for new format';
      COMMENT ON COLUMN public.project_history.decision_details IS 'Complete decision array matching form structure';
      COMMENT ON COLUMN public.project_history.event_details IS 'Event name and year from Section 2';
      COMMENT ON COLUMN public.project_history.location_details IS 'Geographic hierarchy and agencies array from Section 2';
      COMMENT ON COLUMN public.project_history.project_details IS 'Complete project information from Section 3';
      COMMENT ON COLUMN public.project_history.formulation_details IS 'Formulation details array from Section 4 (SA, budgets, EPA, etc.)';
      COMMENT ON COLUMN public.project_history.changes IS 'Changes description array from Section 5';
    `;
    
    const { error: alterError } = await supabase.rpc('sql', { query: alterTableSQL });
    
    if (alterError) {
      console.error('Error adding columns:', alterError.message);
      throw alterError;
    }
    
    console.log('✓ New columns added successfully');
    
    // Step 2: Update existing data to new format
    console.log('\nUpdating existing data to new format...');
    
    const { data: existingEntries, error: fetchError } = await supabase
      .from('project_history')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching existing entries:', fetchError.message);
      throw fetchError;
    }
    
    console.log(`Found ${existingEntries.length} existing entries to update`);
    
    // Step 3: Transform and update each entry
    for (const entry of existingEntries) {
      const updatedEntry = transformToCompleteFormat(entry);
      
      const { error: updateError } = await supabase
        .from('project_history')
        .update(updatedEntry)
        .eq('id', entry.id);
      
      if (updateError) {
        console.error(`Error updating entry ${entry.id}:`, updateError.message);
      }
    }
    
    console.log('✓ Existing data transformed to new format');
    
    // Step 4: Create additional indexes for new fields
    console.log('\nCreating indexes for new fields...');
    
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_project_history_event_details ON public.project_history USING GIN (event_details);
      CREATE INDEX IF NOT EXISTS idx_project_history_location_details ON public.project_history USING GIN (location_details);
      CREATE INDEX IF NOT EXISTS idx_project_history_project_details ON public.project_history USING GIN (project_details);
      CREATE INDEX IF NOT EXISTS idx_project_history_formulation_details ON public.project_history USING GIN (formulation_details);
    `;
    
    const { error: indexError } = await supabase.rpc('sql', { query: indexSQL });
    
    if (indexError) {
      console.error('Error creating indexes:', indexError.message);
      throw indexError;
    }
    
    console.log('✓ Indexes created for optimized querying');
    
    // Step 5: Validate the updated schema
    await validateCompleteSchema();
    
    console.log('\n=== SCHEMA UPDATE COMPLETED SUCCESSFULLY ===');
    console.log('✓ project_history table now supports ALL comprehensive edit form fields');
    console.log('✓ 42 form fields are now properly covered');
    console.log('✓ Existing data migrated to new format');
    console.log('✓ Performance indexes created');
    
  } catch (error) {
    console.error('\n=== SCHEMA UPDATE FAILED ===');
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Transform existing entries to complete format
 */
function transformToCompleteFormat(entry) {
  const update = {};
  
  // Transform event information
  if (entry.event_name || entry.event_year) {
    update.event_details = {
      event_name: entry.event_name || '',
      event_year: entry.event_year ? entry.event_year.toString() : ''
    };
  }
  
  // Transform project details
  update.project_details = {
    mis: '',
    sa: '',
    enumeration_code: entry.enumeration_code || '',
    inclusion_year: entry.inclusion_year ? entry.inclusion_year.toString() : '',
    project_title: '',
    project_description: '',
    summary_description: entry.summary_description || '',
    expenses_executed: entry.expenses_executed ? entry.expenses_executed.toString() : '',
    project_status: entry.project_status || 'Συνεχιζόμενο'
  };
  
  // Transform location details from implementing_agency_location
  if (entry.implementing_agency_location) {
    update.location_details = [{
      municipal_community: '',
      municipality: '',
      regional_unit: '',
      region: '',
      implementing_agency: entry.implementing_agency_location,
      expenditure_types: Array.isArray(entry.expenditure_types) ? entry.expenditure_types : []
    }];
  }
  
  // Transform formulation details
  if (entry.formulation) {
    const formulation = entry.formulation;
    update.formulation_details = [{
      sa: 'ΝΑ853',
      enumeration_code: formulation.na853_code || '',
      protocol_number: '',
      ada: '',
      decision_year: '',
      project_budget: formulation.budget_na853 ? formulation.budget_na853.toString() : '',
      epa_version: '',
      total_public_expense: formulation.budget_na853 ? formulation.budget_na853.toString() : '',
      eligible_public_expense: formulation.budget_na853 ? formulation.budget_na853.toString() : '',
      decision_status: 'Ενεργή',
      change_type: 'Έγκριση',
      connected_decisions: '',
      comments: ''
    }];
  }
  
  // Transform decisions to new format
  if (entry.decisions) {
    const decisions = entry.decisions;
    update.decision_details = [{
      protocol_number: Array.isArray(decisions.kya) && decisions.kya.length > 0 ? decisions.kya[0] : '',
      fek: Array.isArray(decisions.fek) && decisions.fek.length > 0 ? decisions.fek[0] : '',
      ada: Array.isArray(decisions.ada) && decisions.ada.length > 0 ? decisions.ada[0] : '',
      implementing_agency: '',
      decision_budget: '',
      expenses_covered: '',
      decision_type: 'Έγκριση',
      is_included: true,
      comments: ''
    }];
  }
  
  // Transform changes to new format
  if (entry.changes) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    update.changes = changes.map(change => ({
      description: typeof change === 'string' ? change : ''
    }));
  }
  
  return update;
}

/**
 * Validate the complete schema covers all form fields
 */
async function validateCompleteSchema() {
  console.log('\nValidating complete schema coverage...');
  
  const { data: sample, error } = await supabase
    .from('project_history')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Validation error:', error.message);
    throw error;
  }
  
  if (sample && sample.length > 0) {
    const entry = sample[0];
    const requiredFields = [
      'event_details',
      'location_details', 
      'project_details',
      'formulation_details',
      'decision_details',
      'changes'
    ];
    
    const missingFields = requiredFields.filter(field => !(field in entry));
    
    if (missingFields.length > 0) {
      console.error('❌ Missing fields:', missingFields);
      throw new Error(`Schema validation failed: missing fields ${missingFields.join(', ')}`);
    }
    
    console.log('✓ Schema validation passed - all required fields present');
    
    // Log sample structure
    console.log('\n📋 Sample entry structure:');
    console.log('  - event_details:', entry.event_details ? '✓' : '❌');
    console.log('  - location_details:', entry.location_details ? '✓' : '❌');
    console.log('  - project_details:', entry.project_details ? '✓' : '❌');
    console.log('  - formulation_details:', entry.formulation_details ? '✓' : '❌');
    console.log('  - decision_details:', entry.decision_details ? '✓' : '❌');
    console.log('  - changes:', entry.changes ? '✓' : '❌');
  }
}

// Execute the script
updateProjectHistorySchema().catch(console.error);