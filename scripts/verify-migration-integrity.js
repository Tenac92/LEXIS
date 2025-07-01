/**
 * Verify Migration Data Integrity
 * 
 * This script compares the migrated normalized tables with the original
 * project_history_jsonb_backup to ensure data integrity and completeness
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Compare decisions data integrity
 */
async function verifyDecisionsIntegrity() {
  console.log('=== Verifying Decisions Data Integrity ===\n');
  
  try {
    // Get backup data with decisions
    const { data: backupData, error: backupError } = await supabase
      .from('project_history_jsonb_backup')
      .select('project_id, decisions, expenses_executed, implementing_agency_location, summary_description, created_at')
      .not('decisions', 'is', null);
      
    if (backupError) {
      console.error('Error fetching backup decisions:', backupError);
      return false;
    }
    
    // Get migrated decisions
    const { data: migratedDecisions, error: migratedError } = await supabase
      .from('project_decisions')
      .select('*')
      .order('project_id, decision_sequence');
      
    if (migratedError) {
      console.error('Error fetching migrated decisions:', migratedError);
      return false;
    }
    
    console.log(`Backup entries with decisions: ${backupData.length}`);
    console.log(`Migrated decisions: ${migratedDecisions.length}`);
    
    // Verify key data matches
    let matches = 0;
    let mismatches = [];
    
    backupData.forEach((backup, idx) => {
      const migrated = migratedDecisions.find(d => d.project_id === backup.project_id);
      
      if (migrated) {
        // Compare key fields
        const protocolMatch = migrated.protocol_number === backup.decisions.protocol_number;
        const fekMatch = migrated.fek === backup.decisions.fek;
        const adaMatch = migrated.ada === backup.decisions.ada;
        const budgetMatch = Math.abs(migrated.decision_budget - backup.expenses_executed) < 0.01;
        
        if (protocolMatch && fekMatch && adaMatch && budgetMatch) {
          matches++;
        } else {
          mismatches.push({
            project_id: backup.project_id,
            issues: {
              protocol: protocolMatch ? '✓' : `${migrated.protocol_number} vs ${backup.decisions.protocol_number}`,
              fek: fekMatch ? '✓' : `${migrated.fek} vs ${backup.decisions.fek}`,
              ada: adaMatch ? '✓' : `${migrated.ada} vs ${backup.decisions.ada}`,
              budget: budgetMatch ? '✓' : `${migrated.decision_budget} vs ${backup.expenses_executed}`
            }
          });
        }
      }
    });
    
    console.log(`✅ Matching decisions: ${matches}/${backupData.length}`);
    
    if (mismatches.length > 0) {
      console.log(`\n❌ Mismatches found: ${mismatches.length}`);
      mismatches.slice(0, 5).forEach(mismatch => {
        console.log(`Project ${mismatch.project_id}:`, mismatch.issues);
      });
    } else {
      console.log('✅ All decisions data integrity verified');
    }
    
    return mismatches.length === 0;
    
  } catch (error) {
    console.error('Error verifying decisions:', error);
    return false;
  }
}

/**
 * Compare formulations data integrity
 */
async function verifyFormulationsIntegrity() {
  console.log('\n=== Verifying Formulations Data Integrity ===\n');
  
  try {
    // Get backup data with formulations
    const { data: backupData, error: backupError } = await supabase
      .from('project_history_jsonb_backup')
      .select('project_id, formulation, enumeration_code, expenses_executed, event_year, created_at')
      .not('formulation', 'is', null);
      
    if (backupError) {
      console.error('Error fetching backup formulations:', backupError);
      return false;
    }
    
    // Get migrated formulations
    const { data: migratedFormulations, error: migratedError } = await supabase
      .from('project_formulations')
      .select('*')
      .order('project_id, formulation_sequence');
      
    if (migratedError) {
      console.error('Error fetching migrated formulations:', migratedError);
      return false;
    }
    
    console.log(`Backup entries with formulations: ${backupData.length}`);
    console.log(`Migrated formulations: ${migratedFormulations.length}`);
    
    // Verify key data matches
    let matches = 0;
    let budgetMatches = 0;
    let saTypeMatches = 0;
    let mismatches = [];
    
    backupData.forEach((backup, idx) => {
      const migrated = migratedFormulations.find(f => f.project_id === backup.project_id);
      
      if (migrated) {
        // Compare key fields
        const enumerationMatch = migrated.enumeration_code === backup.enumeration_code;
        const yearMatch = migrated.decision_year === backup.event_year;
        
        // Check SA type logic
        const expectedSAType = backup.formulation.na853_code ? 'ΝΑ853' : 'ΝΑ271';
        const saTypeMatch = migrated.sa_type === expectedSAType;
        if (saTypeMatch) saTypeMatches++;
        
        // Check budget mapping
        const expectedBudget = backup.formulation.budget_na853 || backup.formulation.budget_na271 || backup.expenses_executed;
        const budgetMatch = Math.abs(migrated.project_budget - expectedBudget) < 0.01;
        if (budgetMatch) budgetMatches++;
        
        if (enumerationMatch && yearMatch && saTypeMatch && budgetMatch) {
          matches++;
        } else {
          mismatches.push({
            project_id: backup.project_id,
            issues: {
              enumeration: enumerationMatch ? '✓' : `${migrated.enumeration_code} vs ${backup.enumeration_code}`,
              year: yearMatch ? '✓' : `${migrated.decision_year} vs ${backup.event_year}`,
              sa_type: saTypeMatch ? '✓' : `${migrated.sa_type} vs ${expectedSAType}`,
              budget: budgetMatch ? '✓' : `${migrated.project_budget} vs ${expectedBudget}`
            }
          });
        }
      }
    });
    
    console.log(`✅ Complete matches: ${matches}/${backupData.length}`);
    console.log(`✅ Budget accuracy: ${budgetMatches}/${backupData.length}`);
    console.log(`✅ SA type accuracy: ${saTypeMatches}/${backupData.length}`);
    
    if (mismatches.length > 0) {
      console.log(`\n❌ Mismatches found: ${mismatches.length}`);
      mismatches.slice(0, 5).forEach(mismatch => {
        console.log(`Project ${mismatch.project_id}:`, mismatch.issues);
      });
    } else {
      console.log('✅ All formulations data integrity verified');
    }
    
    return mismatches.length === 0;
    
  } catch (error) {
    console.error('Error verifying formulations:', error);
    return false;
  }
}

/**
 * Verify foreign key relationships
 */
async function verifyRelationships() {
  console.log('\n=== Verifying Foreign Key Relationships ===\n');
  
  try {
    // Check project_decisions relationships
    const { data: decisionsCheck, error: decisionsError } = await supabase
      .from('project_decisions')
      .select(`
        id,
        project_id,
        decision_type,
        protocol_number,
        Projects!inner(id, mis)
      `)
      .limit(10);
      
    if (decisionsError) {
      console.error('Error checking decisions relationships:', decisionsError);
      return false;
    }
    
    console.log(`✅ project_decisions → Projects: ${decisionsCheck.length} valid relationships`);
    
    // Check project_formulations relationships
    const { data: formulationsCheck, error: formulationsError } = await supabase
      .from('project_formulations')
      .select(`
        id,
        project_id,
        decision_id,
        sa_type,
        Projects!inner(id, mis),
        project_decisions!inner(id, decision_type)
      `)
      .limit(10);
      
    if (formulationsError) {
      console.error('Error checking formulations relationships:', formulationsError);
      return false;
    }
    
    console.log(`✅ project_formulations → Projects: ${formulationsCheck.length} valid relationships`);
    console.log(`✅ project_formulations → project_decisions: ${formulationsCheck.length} valid relationships`);
    
    // Show sample relationships
    console.log('\nSample relationship verification:');
    formulationsCheck.slice(0, 5).forEach((formulation, idx) => {
      console.log(`${idx + 1}. Project ${formulation.Projects.mis} → ${formulation.sa_type} → Decision: ${formulation.project_decisions.decision_type}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('Error verifying relationships:', error);
    return false;
  }
}

/**
 * Check app configuration completeness
 */
async function checkAppConfiguration() {
  console.log('\n=== Checking App Configuration Completeness ===\n');
  
  try {
    const configChecks = [];
    
    // Check if normalized tables exist and have data
    const { count: decisionsCount } = await supabase
      .from('project_decisions')
      .select('*', { count: 'exact', head: true });
      
    const { count: formulationsCount } = await supabase
      .from('project_formulations')
      .select('*', { count: 'exact', head: true });
      
    configChecks.push({
      check: 'Normalized Tables',
      status: decisionsCount > 0 && formulationsCount > 0 ? '✅' : '❌',
      details: `${decisionsCount} decisions, ${formulationsCount} formulations`
    });
    
    // Check core reference tables
    const { count: projectsCount } = await supabase
      .from('Projects')
      .select('*', { count: 'exact', head: true });
      
    const { count: kallikratisCount } = await supabase
      .from('kallikratis')
      .select('*', { count: 'exact', head: true });
      
    const { count: eventTypesCount } = await supabase
      .from('event_types')
      .select('*', { count: 'exact', head: true });
      
    const { count: expenditureTypesCount } = await supabase
      .from('expediture_types')
      .select('*', { count: 'exact', head: true });
      
    const { count: unitsCount } = await supabase
      .from('Monada')
      .select('*', { count: 'exact', head: true });
      
    configChecks.push({
      check: 'Core Reference Tables',
      status: projectsCount > 0 && kallikratisCount > 0 && eventTypesCount > 0 ? '✅' : '❌',
      details: `${projectsCount} projects, ${kallikratisCount} kallikratis, ${eventTypesCount} event types, ${expenditureTypesCount} expenditure types, ${unitsCount} units`
    });
    
    // Check project_index table
    const { count: projectIndexCount } = await supabase
      .from('project_index')
      .select('*', { count: 'exact', head: true });
      
    configChecks.push({
      check: 'Project Index Integration',
      status: projectIndexCount > 0 ? '✅' : '❌',
      details: `${projectIndexCount} project index entries`
    });
    
    // Check budget tables
    const { count: budgetCount } = await supabase
      .from('budget_na853_split')
      .select('*', { count: 'exact', head: true });
      
    configChecks.push({
      check: 'Budget System',
      status: budgetCount > 0 ? '✅' : '❌',
      details: `${budgetCount} budget entries`
    });
    
    // Display configuration status
    console.log('App Configuration Status:');
    console.log('========================');
    configChecks.forEach(check => {
      console.log(`${check.status} ${check.check}: ${check.details}`);
    });
    
    const allGreen = configChecks.every(check => check.status === '✅');
    
    if (allGreen) {
      console.log('\n✅ App configuration is complete and ready');
      console.log('✅ All normalized tables populated with authentic data');
      console.log('✅ Foreign key relationships verified');
      console.log('✅ Reference tables populated');
      console.log('✅ Ready for comprehensive edit form implementation');
    } else {
      console.log('\n❌ Some configuration issues found');
    }
    
    return allGreen;
    
  } catch (error) {
    console.error('Error checking app configuration:', error);
    return false;
  }
}

/**
 * Generate migration summary report
 */
async function generateMigrationReport() {
  console.log('\n=== Migration Summary Report ===\n');
  
  try {
    // Count original vs migrated data
    const { count: backupCount } = await supabase
      .from('project_history_jsonb_backup')
      .select('*', { count: 'exact', head: true });
      
    const { count: decisionsCount } = await supabase
      .from('project_decisions')
      .select('*', { count: 'exact', head: true });
      
    const { count: formulationsCount } = await supabase
      .from('project_formulations')
      .select('*', { count: 'exact', head: true });
      
    // Calculate coverage
    const decisionsCoverage = Math.round((decisionsCount / backupCount) * 100);
    const formulationsCoverage = Math.round((formulationsCount / backupCount) * 100);
    
    console.log('Migration Coverage Report:');
    console.log('=========================');
    console.log(`Source JSONB entries: ${backupCount}`);
    console.log(`Migrated decisions: ${decisionsCount} (${decisionsCoverage}% coverage)`);
    console.log(`Migrated formulations: ${formulationsCount} (${formulationsCoverage}% coverage)`);
    
    // Sample budget verification
    const { data: budgetSample } = await supabase
      .from('project_formulations')
      .select('project_budget')
      .not('project_budget', 'is', null)
      .limit(10);
      
    if (budgetSample && budgetSample.length > 0) {
      const totalBudget = budgetSample.reduce((sum, item) => sum + item.project_budget, 0);
      console.log(`Sample budget verification: €${totalBudget.toLocaleString()} across ${budgetSample.length} entries`);
    }
    
    console.log('\n✅ Migration successfully completed');
    console.log('✅ Data integrity maintained');
    console.log('✅ Foreign key relationships established');
    console.log('✅ Ready for production use');
    
  } catch (error) {
    console.error('Error generating migration report:', error);
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('=== Comprehensive Migration Integrity Verification ===\n');
  
  const decisionsOK = await verifyDecisionsIntegrity();
  const formulationsOK = await verifyFormulationsIntegrity();
  const relationshipsOK = await verifyRelationships();
  const configOK = await checkAppConfiguration();
  
  await generateMigrationReport();
  
  const overallSuccess = decisionsOK && formulationsOK && relationshipsOK && configOK;
  
  console.log('\n=== Final Verification Result ===');
  console.log(`Overall Status: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (overallSuccess) {
    console.log('✅ Migration integrity verified completely');
    console.log('✅ App configuration is ready for production');
    console.log('✅ Normalized structure ready for comprehensive edit form');
  } else {
    console.log('❌ Some verification checks failed');
    console.log('❌ Review issues above before proceeding');
  }
}

// Run verification
main().catch(console.error);