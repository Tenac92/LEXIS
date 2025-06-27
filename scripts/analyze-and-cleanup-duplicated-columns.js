/**
 * Analyze and Cleanup Duplicated Columns
 * 
 * This script analyzes the Projects table to identify columns that are now
 * duplicated in other tables (project_index, project_history) and prepares
 * for their removal while ensuring data integrity.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeAndCleanupDuplicatedColumns() {
  console.log('=== ANALYZING AND CLEANING UP DUPLICATED COLUMNS ===\n');
  
  try {
    // Step 1: Analyze current Projects table structure
    console.log('📊 Step 1: Analyzing Projects table structure...');
    const projectsStructure = await analyzeProjectsTable();
    
    // Step 2: Analyze related tables
    console.log('\n🔍 Step 2: Analyzing related tables...');
    const relatedStructures = await analyzeRelatedTables();
    
    // Step 3: Identify duplicated columns
    console.log('\n📋 Step 3: Identifying duplicated columns...');
    const duplicatedColumns = identifyDuplicatedColumns(projectsStructure, relatedStructures);
    
    // Step 4: Verify data consistency before cleanup
    console.log('\n✅ Step 4: Verifying data consistency...');
    const consistencyCheck = await verifyDataConsistency(duplicatedColumns);
    
    // Step 5: Create cleanup plan
    console.log('\n🎯 Step 5: Creating cleanup plan...');
    const cleanupPlan = createCleanupPlan(duplicatedColumns, consistencyCheck);
    
    // Step 6: Generate migration script
    console.log('\n📝 Step 6: Generating migration approach...');
    generateMigrationApproach(cleanupPlan);
    
  } catch (error) {
    console.error('❌ Error in column cleanup analysis:', error.message);
    throw error;
  }
}

/**
 * Analyze Projects table structure
 */
async function analyzeProjectsTable() {
  const { data: sample, error } = await supabase
    .from('Projects')
    .select('*')
    .limit(1);
  
  if (error) {
    throw new Error(`Failed to fetch Projects sample: ${error.message}`);
  }
  
  const columns = sample.length > 0 ? Object.keys(sample[0]) : [];
  console.log(`   Projects table has ${columns.length} columns:`);
  
  const columnsByCategory = {
    core: [],
    geographic: [],
    agency: [],
    event: [],
    financial: [],
    metadata: [],
    jsonb: []
  };
  
  columns.forEach(col => {
    console.log(`     ${col}`);
    
    // Categorize columns
    if (['id', 'mis', 'project_title', 'na853'].includes(col)) {
      columnsByCategory.core.push(col);
    } else if (col.includes('region') || col.includes('municipality') || col.includes('geographic')) {
      columnsByCategory.geographic.push(col);
    } else if (col.includes('agency') || col.includes('implementing')) {
      columnsByCategory.agency.push(col);
    } else if (col.includes('event') || col.includes('type')) {
      columnsByCategory.event.push(col);
    } else if (col.includes('budget') || col.includes('expense') || col.includes('cost')) {
      columnsByCategory.financial.push(col);
    } else if (col.includes('created') || col.includes('updated')) {
      columnsByCategory.metadata.push(col);
    } else if (sample[0][col] && typeof sample[0][col] === 'object') {
      columnsByCategory.jsonb.push(col);
    }
  });
  
  return { columns, columnsByCategory, sampleData: sample[0] };
}

/**
 * Analyze related tables
 */
async function analyzeRelatedTables() {
  const tables = ['project_index', 'project_history', 'budget_na853_split'];
  const structures = {};
  
  for (const table of tables) {
    const { data: sample, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️ Could not analyze ${table}: ${error.message}`);
      continue;
    }
    
    const columns = sample.length > 0 ? Object.keys(sample[0]) : [];
    structures[table] = { columns, sampleData: sample[0] };
    console.log(`   ${table}: ${columns.length} columns`);
  }
  
  return structures;
}

/**
 * Identify duplicated columns
 */
function identifyDuplicatedColumns(projectsStructure, relatedStructures) {
  const duplicates = {
    geographic: [],
    agency: [],
    event: [],
    financial: [],
    redundant: []
  };
  
  console.log('\n   🔍 Analyzing potential duplicates...');
  
  // Check geographic data
  if (relatedStructures.project_index) {
    const indexColumns = relatedStructures.project_index.columns;
    
    if (indexColumns.includes('kallikratis_id')) {
      projectsStructure.columnsByCategory.geographic.forEach(col => {
        if (col.includes('region') || col.includes('municipality')) {
          duplicates.geographic.push({
            column: col,
            reason: 'Geographic data available in project_index via kallikratis_id',
            replacement: 'project_index.kallikratis_id → kallikratis table'
          });
        }
      });
    }
    
    if (indexColumns.includes('unit_id')) {
      projectsStructure.columnsByCategory.agency.forEach(col => {
        if (col.includes('implementing') || col.includes('agency')) {
          duplicates.agency.push({
            column: col,
            reason: 'Agency data available in project_index via unit_id',
            replacement: 'project_index.unit_id → Monada table'
          });
        }
      });
    }
    
    if (indexColumns.includes('event_type_id')) {
      projectsStructure.columnsByCategory.event.forEach(col => {
        if (col.includes('event') || col.includes('type')) {
          duplicates.event.push({
            column: col,
            reason: 'Event data available in project_index via event_type_id',
            replacement: 'project_index.event_type_id → event_types table'
          });
        }
      });
    }
  }
  
  // Check JSONB redundancy
  const jsonbColumns = projectsStructure.columnsByCategory.jsonb;
  if (jsonbColumns.length > 0 && relatedStructures.project_history) {
    jsonbColumns.forEach(col => {
      duplicates.redundant.push({
        column: col,
        reason: 'JSONB data better structured in project_history',
        replacement: 'project_history JSONB columns with proper schema'
      });
    });
  }
  
  return duplicates;
}

/**
 * Verify data consistency
 */
async function verifyDataConsistency(duplicatedColumns) {
  const results = {
    safe: [],
    conflicts: [],
    missing: []
  };
  
  // Check a sample of projects for data consistency
  const { data: projects, error } = await supabase
    .from('Projects')
    .select('id, mis')
    .limit(10);
  
  if (error) {
    throw new Error(`Failed to fetch projects for consistency check: ${error.message}`);
  }
  
  for (const project of projects) {
    // Check if project has corresponding entries in related tables
    const { data: indexEntry } = await supabase
      .from('project_index')
      .select('*')
      .eq('project_id', project.id)
      .single();
    
    const { data: historyEntry } = await supabase
      .from('project_history')
      .select('*')
      .eq('project_id', project.id)
      .single();
    
    if (indexEntry && historyEntry) {
      results.safe.push(project.mis);
    } else if (!indexEntry || !historyEntry) {
      results.missing.push({
        mis: project.mis,
        missing: {
          index: !indexEntry,
          history: !historyEntry
        }
      });
    }
  }
  
  console.log(`   ✅ Safe to cleanup: ${results.safe.length} projects`);
  console.log(`   ⚠️ Missing related data: ${results.missing.length} projects`);
  
  return results;
}

/**
 * Create cleanup plan
 */
function createCleanupPlan(duplicatedColumns, consistencyCheck) {
  const plan = {
    phase1: {
      name: 'Safe Column Removal',
      columns: [],
      risk: 'low'
    },
    phase2: {
      name: 'JSONB Migration',
      columns: [],
      risk: 'medium'
    },
    phase3: {
      name: 'Geographic Data Migration',
      columns: [],
      risk: 'high'
    },
    prerequisites: []
  };
  
  // Categorize by risk level
  [...duplicatedColumns.geographic, ...duplicatedColumns.agency, ...duplicatedColumns.event].forEach(dup => {
    if (dup.column.includes('region') || dup.column.includes('geographic')) {
      plan.phase3.columns.push(dup);
    } else {
      plan.phase1.columns.push(dup);
    }
  });
  
  duplicatedColumns.redundant.forEach(dup => {
    plan.phase2.columns.push(dup);
  });
  
  // Add prerequisites
  if (consistencyCheck.missing.length > 0) {
    plan.prerequisites.push('Ensure all projects have project_index entries');
    plan.prerequisites.push('Ensure all projects have project_history entries');
  }
  
  plan.prerequisites.push('Update all API endpoints to use new data sources');
  plan.prerequisites.push('Update frontend components to fetch from correct endpoints');
  plan.prerequisites.push('Create comprehensive tests for data retrieval');
  
  return plan;
}

/**
 * Generate migration approach
 */
function generateMigrationApproach(cleanupPlan) {
  console.log('\n📋 CLEANUP PLAN SUMMARY:');
  console.log('='.repeat(60));
  
  console.log('\n🎯 PHASE 1: Safe Column Removal (Low Risk)');
  if (cleanupPlan.phase1.columns.length > 0) {
    cleanupPlan.phase1.columns.forEach(col => {
      console.log(`   ❌ Remove: ${col.column}`);
      console.log(`      Reason: ${col.reason}`);
      console.log(`      Replacement: ${col.replacement}`);
    });
  } else {
    console.log('   ✅ No columns identified for Phase 1');
  }
  
  console.log('\n🔄 PHASE 2: JSONB Migration (Medium Risk)');
  if (cleanupPlan.phase2.columns.length > 0) {
    cleanupPlan.phase2.columns.forEach(col => {
      console.log(`   🔄 Migrate: ${col.column}`);
      console.log(`      Reason: ${col.reason}`);
      console.log(`      Replacement: ${col.replacement}`);
    });
  } else {
    console.log('   ✅ No columns identified for Phase 2');
  }
  
  console.log('\n🗺️ PHASE 3: Geographic Data Migration (High Risk)');
  if (cleanupPlan.phase3.columns.length > 0) {
    cleanupPlan.phase3.columns.forEach(col => {
      console.log(`   🗺️ Migrate: ${col.column}`);
      console.log(`      Reason: ${col.reason}`);
      console.log(`      Replacement: ${col.replacement}`);
    });
  } else {
    console.log('   ✅ No columns identified for Phase 3');
  }
  
  console.log('\n📋 PREREQUISITES:');
  cleanupPlan.prerequisites.forEach((req, index) => {
    console.log(`   ${index + 1}. ${req}`);
  });
  
  console.log('\n🚀 RECOMMENDED APPROACH:');
  console.log('   1. Update API endpoints to fetch from correct tables first');
  console.log('   2. Update frontend components to use new data sources');
  console.log('   3. Test thoroughly with existing data');
  console.log('   4. Remove Phase 1 columns (safest)');
  console.log('   5. Migrate Phase 2 JSONB data');
  console.log('   6. Finally migrate Phase 3 geographic data');
  
  console.log('\n💡 CRITICAL NOTES:');
  console.log('   • Never remove columns without ensuring data is available elsewhere');
  console.log('   • Always backup database before structural changes');
  console.log('   • Test all endpoints after each phase');
  console.log('   • Monitor performance impact of new queries');
  
  console.log('\n='.repeat(60));
  console.log('✅ ANALYSIS COMPLETED - Ready for implementation');
  console.log('='.repeat(60));
}

// Execute the analysis
analyzeAndCleanupDuplicatedColumns().catch(console.error);