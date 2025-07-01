/**
 * Migrate Project History from JSONB Backup to Normalized Tables
 * 
 * This script migrates data from the project_history_jsonb_backup table
 * to the new normalized project_decisions and project_formulations tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Analyze existing JSONB backup data
 */
async function analyzeJSONBBackup() {
  console.log('Analyzing project_history_jsonb_backup data...\n');
  
  try {
    const { data: backupData, error } = await supabase
      .from('project_history_jsonb_backup')
      .select('*')
      .order('project_id, created_at');
      
    if (error) {
      console.error('Error fetching backup data:', error);
      return null;
    }
    
    console.log(`Found ${backupData.length} backup entries`);
    
    // Analyze JSONB structure
    console.log('\nAnalyzing JSONB structure:');
    console.log('===========================');
    
    backupData.slice(0, 3).forEach((entry, idx) => {
      console.log(`\nEntry ${idx + 1} - Project ${entry.project_id}:`);
      console.log(`  Change Type: ${entry.change_type}`);
      console.log(`  Has formulation_metadata: ${!!entry.formulation_metadata}`);
      
      if (entry.formulation_metadata) {
        const metadata = entry.formulation_metadata;
        console.log(`  - decision_details: ${metadata.decision_details?.length || 0} items`);
        console.log(`  - formulation_details: ${metadata.formulation_details?.length || 0} items`);
        
        if (metadata.decision_details?.length > 0) {
          console.log(`    Decision sample: ${metadata.decision_details[0].decision_type}`);
        }
        
        if (metadata.formulation_details?.length > 0) {
          console.log(`    Formulation sample: ${metadata.formulation_details[0].sa_type}`);
        }
      }
      
      // Legacy fields
      console.log(`  Legacy fields: FEK=${entry.fek}, Protocol=${entry.protocol_number}`);
    });
    
    return backupData;
    
  } catch (error) {
    console.error('Error analyzing backup data:', error);
    return null;
  }
}

/**
 * Extract decisions from JSONB backup
 */
function extractDecisions(backupData) {
  console.log('\nExtracting decisions from JSONB backup...\n');
  
  const decisions = [];
  const projectDecisionCounts = {};
  
  backupData.forEach(entry => {
    const projectId = entry.project_id;
    
    // Initialize decision sequence for this project
    if (!projectDecisionCounts[projectId]) {
      projectDecisionCounts[projectId] = 0;
    }
    
    // Extract from JSONB decisions structure
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
    } else if (entry.protocol_number || entry.fek || entry.ada) {
      // Create decision from legacy fields
      projectDecisionCounts[projectId]++;
      
      const decision = {
        project_id: projectId,
        decision_sequence: projectDecisionCounts[projectId],
        decision_type: entry.change_type === 'APPROVAL' ? 'Έγκριση' : 'Τροποποίηση',
        protocol_number: entry.protocol_number,
        fek: entry.fek,
        ada: entry.ada,
        implementing_agency: entry.implementing_agency_location || 'ΔΑΕΦΚ',
        decision_budget: parseFloat(entry.expenses_executed || 0),
        expenses_covered: parseFloat(entry.expenses_executed || 0),
        decision_date: entry.created_at.split('T')[0],
        is_included: true,
        is_active: true,
        comments: entry.change_description || '',
        created_at: entry.created_at,
        updated_at: entry.created_at
      };
      
      decisions.push(decision);
    }
  });
  
  console.log(`Extracted ${decisions.length} decisions from backup data`);
  console.log(`Spanning ${Object.keys(projectDecisionCounts).length} projects`);
  
  return decisions;
}

/**
 * Extract formulations from JSONB backup
 */
function extractFormulations(backupData, decisions) {
  console.log('\nExtracting formulations from JSONB backup...\n');
  
  const formulations = [];
  const projectFormulationCounts = {};
  
  // Create lookup for decision IDs by project and sequence
  const decisionLookup = {};
  decisions.forEach((decision, idx) => {
    const key = `${decision.project_id}_${decision.decision_sequence}`;
    decisionLookup[key] = idx + 1; // Assuming sequential IDs starting from 1
  });
  
  backupData.forEach(entry => {
    const projectId = entry.project_id;
    
    // Initialize formulation sequence for this project
    if (!projectFormulationCounts[projectId]) {
      projectFormulationCounts[projectId] = 0;
    }
    
    // Extract from JSONB formulation structure
    if (entry.formulation) {
      projectFormulationCounts[projectId]++;
      
      // Try to link to a decision
      const decisionKey = `${projectId}_1`; // Link to first decision for now
      const decisionId = decisionLookup[decisionKey] || null;
      
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
  
  console.log(`Extracted ${formulations.length} formulations from backup data`);
  console.log(`Spanning ${Object.keys(projectFormulationCounts).length} projects`);
  
  return formulations;
}

/**
 * Insert decisions into normalized table
 */
async function insertDecisions(decisions) {
  console.log('\nInserting decisions into project_decisions table...\n');
  
  try {
    // Insert in batches of 50
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < decisions.length; i += batchSize) {
      const batch = decisions.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('project_decisions')
        .insert(batch)
        .select();
        
      if (error) {
        console.error(`Error inserting decision batch ${i}-${i + batchSize}:`, error);
        continue;
      }
      
      totalInserted += data.length;
      console.log(`Inserted decision batch: ${data.length} decisions`);
    }
    
    console.log(`✅ Total decisions inserted: ${totalInserted}`);
    return totalInserted;
    
  } catch (error) {
    console.error('Error inserting decisions:', error);
    return 0;
  }
}

/**
 * Insert formulations into normalized table
 */
async function insertFormulations(formulations) {
  console.log('\nInserting formulations into project_formulations table...\n');
  
  try {
    // Insert in batches of 50
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < formulations.length; i += batchSize) {
      const batch = formulations.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('project_formulations')
        .insert(batch)
        .select();
        
      if (error) {
        console.error(`Error inserting formulation batch ${i}-${i + batchSize}:`, error);
        continue;
      }
      
      totalInserted += data.length;
      console.log(`Inserted formulation batch: ${data.length} formulations`);
    }
    
    console.log(`✅ Total formulations inserted: ${totalInserted}`);
    return totalInserted;
    
  } catch (error) {
    console.error('Error inserting formulations:', error);
    return 0;
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('\nVerifying migration results...\n');
  
  try {
    // Count decisions
    const { data: decisionsCount, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('*', { count: 'exact', head: true });
      
    if (decisionsError) {
      console.error('Error counting decisions:', decisionsError);
    } else {
      console.log(`✅ project_decisions table: ${decisionsCount.length} records`);
    }
    
    // Count formulations
    const { data: formulationsCount, error: formulationsError } = await supabase
      .from('project_formulations')
      .select('*', { count: 'exact', head: true });
      
    if (formulationsError) {
      console.error('Error counting formulations:', formulationsError);
    } else {
      console.log(`✅ project_formulations table: ${formulationsCount.length} records`);
    }
    
    // Test relationships
    const { data: joinTest, error: joinError } = await supabase
      .from('project_formulations')
      .select(`
        *,
        project_decisions(decision_type, protocol_number)
      `)
      .limit(5);
      
    if (joinError) {
      console.error('Error testing relationships:', joinError);
    } else {
      console.log(`✅ Foreign key relationships working: ${joinTest.length} sample records`);
      joinTest.forEach((formulation, idx) => {
        console.log(`  ${idx + 1}. Formulation ${formulation.sa_type} → Decision ${formulation.project_decisions?.decision_type}`);
      });
    }
    
  } catch (error) {
    console.error('Error verifying migration:', error);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('=== JSONB Backup to Normalized Tables Migration ===\n');
  
  // Step 1: Analyze backup data
  const backupData = await analyzeJSONBBackup();
  if (!backupData) {
    console.error('Failed to load backup data');
    return;
  }
  
  // Step 2: Extract decisions and formulations
  const decisions = extractDecisions(backupData);
  const formulations = extractFormulations(backupData, decisions);
  
  console.log('\n=== Migration Summary ===');
  console.log(`Source: ${backupData.length} JSONB backup entries`);
  console.log(`Target: ${decisions.length} decisions + ${formulations.length} formulations`);
  
  // Step 3: Insert into normalized tables
  const decisionsInserted = await insertDecisions(decisions);
  const formulationsInserted = await insertFormulations(formulations);
  
  // Step 4: Verify results
  await verifyMigration();
  
  console.log('\n=== Migration Complete ===');
  console.log(`✅ Decisions migrated: ${decisionsInserted}`);
  console.log(`✅ Formulations migrated: ${formulationsInserted}`);
  console.log('✅ Normalized structure is ready for use');
}

// Run migration
main().catch(console.error);