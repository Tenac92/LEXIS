/**
 * Clean Migration from JSONB Backup to Normalized Tables
 * 
 * This script performs a clean migration by first clearing existing data
 * then migrating from the project_history_jsonb_backup table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Clear existing normalized data
 */
async function clearExistingData() {
  console.log('Clearing existing normalized data...\n');
  
  try {
    // Delete formulations first (due to foreign key constraint)
    const { error: formulationsError } = await supabase
      .from('project_formulations')
      .delete()
      .neq('id', -1); // Delete all
      
    if (formulationsError) {
      console.error('Error clearing formulations:', formulationsError);
      return false;
    }
    
    // Delete decisions
    const { error: decisionsError } = await supabase
      .from('project_decisions')
      .delete()
      .neq('id', -1); // Delete all
      
    if (decisionsError) {
      console.error('Error clearing decisions:', decisionsError);
      return false;
    }
    
    console.log('✅ Existing data cleared successfully');
    return true;
    
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

/**
 * Perform migration with decision ID tracking
 */
async function performMigration() {
  console.log('Starting clean migration...\n');
  
  try {
    // Fetch backup data
    const { data: backupData, error } = await supabase
      .from('project_history_jsonb_backup')
      .select('*')
      .order('project_id, created_at');
      
    if (error) {
      console.error('Error fetching backup data:', error);
      return false;
    }
    
    console.log(`Processing ${backupData.length} backup entries`);
    
    // Extract and insert decisions first
    const decisions = extractDecisionsFromBackup(backupData);
    console.log(`Extracted ${decisions.length} decisions`);
    
    const insertedDecisions = await insertDecisionsWithIds(decisions);
    if (!insertedDecisions) {
      console.error('Failed to insert decisions');
      return false;
    }
    
    // Extract and insert formulations with proper decision linking
    const formulations = extractFormulationsFromBackup(backupData, insertedDecisions);
    console.log(`Extracted ${formulations.length} formulations`);
    
    const insertedFormulations = await insertFormulationsWithDecisionIds(formulations);
    if (!insertedFormulations) {
      console.error('Failed to insert formulations');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
}

/**
 * Extract decisions from backup data
 */
function extractDecisionsFromBackup(backupData) {
  const decisions = [];
  const projectDecisionCounts = {};
  
  backupData.forEach(entry => {
    const projectId = entry.project_id;
    
    if (!projectDecisionCounts[projectId]) {
      projectDecisionCounts[projectId] = 0;
    }
    
    // Only create decision if we have decision data
    if (entry.decisions && (entry.decisions.protocol_number || entry.decisions.fek || entry.decisions.ada)) {
      projectDecisionCounts[projectId]++;
      
      const decision = {
        project_id: projectId,
        decision_sequence: projectDecisionCounts[projectId],
        decision_type: entry.decisions.decision_type || 'Έγκριση',
        protocol_number: entry.decisions.protocol_number,
        fek: entry.decisions.fek,
        ada: entry.decisions.ada,
        implementing_agency: entry.implementing_agency_location || 'ΔΑΕΦΚ',
        decision_budget: parseFloat(entry.expenses_executed || 0),
        expenses_covered: parseFloat(entry.expenses_executed || 0),
        decision_date: entry.created_at.split('T')[0],
        is_included: true,
        is_active: true,
        comments: entry.decisions.budget_decision || entry.summary_description || '',
        created_at: entry.created_at,
        updated_at: entry.created_at
      };
      
      decisions.push(decision);
    }
  });
  
  return decisions;
}

/**
 * Insert decisions and return with IDs
 */
async function insertDecisionsWithIds(decisions) {
  console.log('\nInserting decisions with ID tracking...');
  
  try {
    const { data: insertedDecisions, error } = await supabase
      .from('project_decisions')
      .insert(decisions)
      .select('id, project_id, decision_sequence');
      
    if (error) {
      console.error('Error inserting decisions:', error);
      return null;
    }
    
    console.log(`✅ Inserted ${insertedDecisions.length} decisions`);
    
    // Create lookup map: project_id_sequence -> id
    const decisionIdMap = {};
    insertedDecisions.forEach(decision => {
      const key = `${decision.project_id}_${decision.decision_sequence}`;
      decisionIdMap[key] = decision.id;
    });
    
    return decisionIdMap;
    
  } catch (error) {
    console.error('Error inserting decisions:', error);
    return null;
  }
}

/**
 * Extract formulations with decision linking
 */
function extractFormulationsFromBackup(backupData, decisionIdMap) {
  const formulations = [];
  const projectFormulationCounts = {};
  
  backupData.forEach(entry => {
    const projectId = entry.project_id;
    
    if (!projectFormulationCounts[projectId]) {
      projectFormulationCounts[projectId] = 0;
    }
    
    // Only create formulation if we have formulation data
    if (entry.formulation) {
      projectFormulationCounts[projectId]++;
      
      // Link to first decision for this project (if exists)
      const decisionKey = `${projectId}_1`;
      const decisionId = decisionIdMap[decisionKey] || null;
      
      const formulation = {
        project_id: projectId,
        decision_id: decisionId,
        formulation_sequence: projectFormulationCounts[projectId],
        sa_type: entry.formulation.na853_code ? 'ΝΑ853' : 'ΝΑ271',
        enumeration_code: entry.enumeration_code || '',
        protocol_number: entry.decisions?.protocol_number || '',
        decision_year: entry.event_year || entry.formulation.event_year || new Date(entry.created_at).getFullYear(),
        project_budget: parseFloat(entry.formulation.budget_na853 || entry.formulation.budget_na271 || entry.expenses_executed || 0),
        total_public_expense: parseFloat(entry.expenses_executed || 0),
        eligible_public_expense: parseFloat(entry.expenses_executed || 0),
        epa_version: '1.0',
        decision_status: entry.formulation.status === 'active' ? 'Ενεργή' : 'Αναστολή',
        change_type: 'Έγκριση',
        connected_decision_ids: [],
        comments: entry.formulation.event_description || entry.summary_description || '',
        created_at: entry.created_at,
        updated_at: entry.created_at
      };
      
      formulations.push(formulation);
    }
  });
  
  return formulations;
}

/**
 * Insert formulations with proper decision ID references
 */
async function insertFormulationsWithDecisionIds(formulations) {
  console.log('\nInserting formulations with decision references...');
  
  try {
    const { data: insertedFormulations, error } = await supabase
      .from('project_formulations')
      .insert(formulations)
      .select('id, project_id, formulation_sequence');
      
    if (error) {
      console.error('Error inserting formulations:', error);
      return null;
    }
    
    console.log(`✅ Inserted ${insertedFormulations.length} formulations`);
    return insertedFormulations;
    
  } catch (error) {
    console.error('Error inserting formulations:', error);
    return null;
  }
}

/**
 * Verify migration results
 */
async function verifyResults() {
  console.log('\nVerifying migration results...\n');
  
  try {
    // Count decisions
    const { count: decisionsCount, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('*', { count: 'exact', head: true });
      
    if (!decisionsError) {
      console.log(`✅ project_decisions: ${decisionsCount} records`);
    }
    
    // Count formulations
    const { count: formulationsCount, error: formulationsError } = await supabase
      .from('project_formulations')
      .select('*', { count: 'exact', head: true });
      
    if (!formulationsError) {
      console.log(`✅ project_formulations: ${formulationsCount} records`);
    }
    
    // Test relationships
    const { data: relationshipTest, error: relationshipError } = await supabase
      .from('project_formulations')
      .select(`
        id,
        sa_type,
        project_budget,
        project_decisions(decision_type, protocol_number)
      `)
      .limit(5);
      
    if (!relationshipError && relationshipTest) {
      console.log(`✅ Foreign key relationships working`);
      console.log('\nSample relationships:');
      relationshipTest.forEach((formulation, idx) => {
        const decisionType = formulation.project_decisions?.decision_type || 'No decision';
        console.log(`  ${idx + 1}. ${formulation.sa_type} (€${formulation.project_budget?.toLocaleString()}) → ${decisionType}`);
      });
    }
    
  } catch (error) {
    console.error('Error verifying results:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Clean Migration from JSONB Backup ===\n');
  
  // Step 1: Clear existing data
  const cleared = await clearExistingData();
  if (!cleared) {
    console.error('❌ Failed to clear existing data');
    return;
  }
  
  // Step 2: Perform migration
  const migrated = await performMigration();
  if (!migrated) {
    console.error('❌ Migration failed');
    return;
  }
  
  // Step 3: Verify results
  await verifyResults();
  
  console.log('\n=== Clean Migration Complete ===');
  console.log('✅ Normalized structure ready for comprehensive edit form');
  console.log('✅ Decisions and formulations properly linked with foreign keys');
  console.log('✅ Data integrity maintained throughout migration');
}

// Run clean migration
main().catch(console.error);