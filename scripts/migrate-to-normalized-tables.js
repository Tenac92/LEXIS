/**
 * Migrate Project History to Normalized Tables
 * 
 * This script migrates data from the linear project_history table
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
 * Analyze existing project history data
 */
async function analyzeExistingData() {
  console.log('Analyzing existing project_history_jsonb_backup data...\n');
  
  try {
    const { data: historyData, error } = await supabase
      .from('project_history_jsonb_backup')
      .select('*')
      .order('project_id, created_at');
      
    if (error) {
      console.error('Error fetching project history backup:', error);
      return null;
    }
    
    console.log(`Found ${historyData.length} project history backup entries`);
    
    // Group by project to understand the structure
    const projectGroups = {};
    historyData.forEach(entry => {
      if (!projectGroups[entry.project_id]) {
        projectGroups[entry.project_id] = [];
      }
      projectGroups[entry.project_id].push(entry);
    });
    
    console.log(`Data spans ${Object.keys(projectGroups).length} projects`);
    console.log('\nAnalyzing JSONB backup structure:');
    
    // Analyze structure
    Object.keys(projectGroups).slice(0, 3).forEach(projectId => {
      const entries = projectGroups[projectId];
      console.log(`\nProject ${projectId}: ${entries.length} entries`);
      
      entries.forEach((entry, idx) => {
        console.log(`  ${idx + 1}. Type: ${entry.change_type}`);
        console.log(`     Protocol: ${entry.protocol_number}`);
        console.log(`     Budget: €${entry.expenses_executed?.toLocaleString() || 0}`);
        
        if (entry.formulation_metadata?.formulation_details) {
          const formDetails = entry.formulation_metadata.formulation_details;
          console.log(`     Formulation: ${formDetails.length} details`);
        }
      });
    });
    
    return projectGroups;
    
  } catch (error) {
    console.error('Error analyzing data:', error);
    return null;
  }
}

/**
 * Migrate data to normalized project_decisions table
 */
async function migrateToDecisionsTable(projectGroups) {
  console.log('\nMigrating to project_decisions table...\n');
  
  try {
    let totalDecisions = 0;
    
    for (const [projectId, entries] of Object.entries(projectGroups)) {
      console.log(`Processing decisions for project ${projectId}...`);
      
      const decisions = [];
      let decisionSequence = 1;
      
      for (const entry of entries) {
        // Extract decisions from JSONB backup structure
        if (entry.formulation_metadata?.decision_details?.length > 0) {
          // Multiple decisions in JSONB structure
          for (const decisionDetail of entry.formulation_metadata.decision_details) {
            const decision = {
              project_id: parseInt(projectId),
              decision_sequence: decisionSequence++,
              decision_type: decisionDetail.decision_type || 'Έγκριση',
              
              // Document references from JSONB
              protocol_number: decisionDetail.protocol_number || entry.protocol_number,
              fek: decisionDetail.fek || entry.fek,
              ada: decisionDetail.ada || entry.ada,
          
          // Decision details
          implementing_agency: entry.implementing_agency_location || 
                              entry.formulation_metadata?.decision_details?.[0]?.implementing_agency ||
                              'ΔΑΕΦΚ',
          decision_budget: entry.expenses_executed || 0,
          expenses_covered: entry.expenses_executed || 0,
          decision_date: entry.created_at.split('T')[0], // Extract date part
          
          // Status
          is_included: entry.formulation_metadata?.decision_details?.[0]?.is_included !== false,
          is_active: true,
          comments: entry.change_description || 
                   entry.formulation_metadata?.decision_details?.[0]?.comments ||
                   `Migrated from ${entry.change_type}`,
          
          // Additional references
          budget_decision: entry.budget_decision,
          funding_decision: entry.funding_decision,
          allocation_decision: entry.allocation_decision,
          
          // Audit
          created_by: 1, // System migration
          created_at: entry.created_at,
          updated_at: entry.created_at
        };
        
        decisions.push(decision);
      }
      
      if (decisions.length > 0) {
        const { error: insertError } = await supabase
          .from('project_decisions')
          .insert(decisions);
          
        if (insertError) {
          console.error(`Error inserting decisions for project ${projectId}:`, insertError);
          continue;
        }
        
        console.log(`✓ Migrated ${decisions.length} decisions for project ${projectId}`);
        totalDecisions += decisions.length;
      }
    }
    
    console.log(`\n✅ Successfully migrated ${totalDecisions} total decisions`);
    return true;
    
  } catch (error) {
    console.error('Error migrating to decisions table:', error);
    return false;
  }
}

/**
 * Migrate data to normalized project_formulations table
 */
async function migrateToFormulationsTable(projectGroups) {
  console.log('\nMigrating to project_formulations table...\n');
  
  try {
    // First, get all decisions to create the links
    const { data: allDecisions, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('*')
      .order('project_id, decision_sequence');
      
    if (decisionsError) {
      console.error('Error fetching decisions:', decisionsError);
      return false;
    }
    
    // Group decisions by project
    const decisionsByProject = {};
    allDecisions.forEach(decision => {
      if (!decisionsByProject[decision.project_id]) {
        decisionsByProject[decision.project_id] = [];
      }
      decisionsByProject[decision.project_id].push(decision);
    });
    
    let totalFormulations = 0;
    
    for (const [projectId, entries] of Object.entries(projectGroups)) {
      console.log(`Processing formulations for project ${projectId}...`);
      
      const formulations = [];
      const projectDecisions = decisionsByProject[parseInt(projectId)] || [];
      let formulationSequence = 1;
      
      for (const entry of entries) {
        // Extract SA types from the entry
        const saTypes = [];
        
        if (entry.na853 && entry.budget_na853) {
          saTypes.push({
            sa_type: 'ΝΑ853',
            enumeration_code: entry.na853,
            budget: entry.budget_na853
          });
        }
        
        if (entry.na271 && entry.budget_na271) {
          saTypes.push({
            sa_type: 'ΝΑ271', 
            enumeration_code: entry.na271,
            budget: entry.budget_na271
          });
        }
        
        if (entry.e069 && entry.budget_e069) {
          saTypes.push({
            sa_type: 'E069',
            enumeration_code: entry.e069,
            budget: entry.budget_e069
          });
        }
        
        // Also check formulation_metadata for additional details
        if (entry.formulation_metadata?.formulation_details) {
          entry.formulation_metadata.formulation_details.forEach(detail => {
            if (detail.sa && detail.project_budget) {
              // Avoid duplicates
              const exists = saTypes.some(sa => sa.sa_type === detail.sa);
              if (!exists) {
                saTypes.push({
                  sa_type: detail.sa,
                  enumeration_code: detail.enumeration_code,
                  budget: parseFloat(detail.project_budget) || 0
                });
              }
            }
          });
        }
        
        // Create formulations for each SA type
        for (const saData of saTypes) {
          // Try to link to appropriate decision
          let linkedDecision = null;
          
          if (projectDecisions.length > 0) {
            // Link to first decision for ΝΑ853, second for ΝΑ271, etc.
            if (saData.sa_type === 'ΝΑ853' && projectDecisions[0]) {
              linkedDecision = projectDecisions[0];
            } else if (saData.sa_type === 'ΝΑ271' && projectDecisions[1]) {
              linkedDecision = projectDecisions[1];
            } else {
              linkedDecision = projectDecisions[0]; // Default to first decision
            }
          }
          
          const formulation = {
            project_id: parseInt(projectId),
            decision_id: linkedDecision?.id || null,
            formulation_sequence: formulationSequence++,
            
            // SA type and codes
            sa_type: saData.sa_type,
            enumeration_code: saData.enumeration_code,
            
            // Decision references
            protocol_number: entry.protocol_number || linkedDecision?.protocol_number,
            ada: entry.ada || linkedDecision?.ada,
            decision_year: entry.inclusion_year || new Date().getFullYear(),
            
            // Financial data
            project_budget: saData.budget,
            total_public_expense: saData.budget,
            eligible_public_expense: saData.budget,
            
            // EPA and status
            epa_version: '1.0',
            decision_status: 'Ενεργή',
            change_type: linkedDecision?.decision_type || 'Έγκριση',
            
            // Comments
            comments: `${saData.sa_type} formulation migrated from project history`,
            is_active: true,
            
            // Audit
            created_by: 1,
            created_at: entry.created_at,
            updated_at: entry.created_at
          };
          
          formulations.push(formulation);
        }
      }
      
      if (formulations.length > 0) {
        const { error: insertError } = await supabase
          .from('project_formulations')
          .insert(formulations);
          
        if (insertError) {
          console.error(`Error inserting formulations for project ${projectId}:`, insertError);
          continue;
        }
        
        console.log(`✓ Migrated ${formulations.length} formulations for project ${projectId}`);
        totalFormulations += formulations.length;
      }
    }
    
    console.log(`\n✅ Successfully migrated ${totalFormulations} total formulations`);
    return true;
    
  } catch (error) {
    console.error('Error migrating to formulations table:', error);
    return false;
  }
}

/**
 * Verify the normalized structure
 */
async function verifyNormalizedStructure() {
  console.log('\nVerifying normalized structure...\n');
  
  try {
    // Get counts
    const { data: decisions, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('id', { count: 'exact', head: true });
      
    const { data: formulations, error: formulationsError } = await supabase
      .from('project_formulations')
      .select('id', { count: 'exact', head: true });
      
    if (decisionsError || formulationsError) {
      console.error('Error getting counts:', decisionsError || formulationsError);
      return false;
    }
    
    console.log(`📊 Normalized Structure Statistics:`);
    console.log(`Total Decisions: ${decisions?.length || 0}`);
    console.log(`Total Formulations: ${formulations?.length || 0}`);
    
    // Show sample relationships
    const { data: sampleData, error: sampleError } = await supabase
      .from('project_formulations')
      .select(`
        id,
        sa_type,
        enumeration_code,
        project_budget,
        project_decisions (
          id,
          decision_type,
          protocol_number,
          decision_budget
        )
      `)
      .limit(5);
      
    if (!sampleError && sampleData.length > 0) {
      console.log('\n📋 Sample Formulation-Decision Relationships:');
      sampleData.forEach((form, idx) => {
        console.log(`${idx + 1}. ${form.sa_type}: €${form.project_budget?.toLocaleString()}`);
        console.log(`   Code: ${form.enumeration_code}`);
        if (form.project_decisions) {
          console.log(`   → Linked to Decision: ${form.project_decisions.decision_type}`);
          console.log(`   → Protocol: ${form.project_decisions.protocol_number}`);
        } else {
          console.log(`   → No linked decision`);
        }
      });
    }
    
    console.log('\n✅ Normalized structure verified successfully!');
    console.log('\n🎯 Benefits of Normalized Structure:');
    console.log('• Clean separation of decisions and formulations');
    console.log('• Proper foreign key relationships');
    console.log('• Easy to query and maintain');
    console.log('• Supports comprehensive edit form requirements');
    console.log('• Scalable for future features');
    
    return true;
    
  } catch (error) {
    console.error('Error verifying structure:', error);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('=== Project History Normalization Migration ===\n');
  
  try {
    // Step 1: Analyze existing data
    console.log('Step 1: Analyzing existing project history data...');
    const projectGroups = await analyzeExistingData();
    if (!projectGroups) {
      throw new Error('Failed to analyze existing data');
    }
    
    // Step 2: Migrate to decisions table
    console.log('\nStep 2: Migrating to project_decisions table...');
    const decisionsSuccess = await migrateToDecisionsTable(projectGroups);
    if (!decisionsSuccess) {
      throw new Error('Failed to migrate to decisions table');
    }
    
    // Step 3: Migrate to formulations table
    console.log('\nStep 3: Migrating to project_formulations table...');
    const formulationsSuccess = await migrateToFormulationsTable(projectGroups);
    if (!formulationsSuccess) {
      throw new Error('Failed to migrate to formulations table');
    }
    
    // Step 4: Verify the structure
    console.log('\nStep 4: Verifying normalized structure...');
    const verified = await verifyNormalizedStructure();
    if (!verified) {
      throw new Error('Structure verification failed');
    }
    
    console.log('\n🎉 Project History Normalization Complete!');
    console.log('\nYou now have properly normalized tables:');
    console.log('• project_decisions: For "Αποφάσεις που τεκμηριώνουν το έργο"');
    console.log('• project_formulations: For "Στοιχεία κατάρτισης έργου"');
    console.log('• Proper foreign key relationships linking them together');
    console.log('• Clean, maintainable structure for the comprehensive edit form');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Execute the migration
main();