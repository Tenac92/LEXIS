/**
 * Comprehensive Database Check
 * 
 * This script performs a thorough analysis of the entire database structure,
 * checking table schemas, relationships, data integrity, and system health.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function comprehensiveDatabaseCheck() {
  console.log('=== COMPREHENSIVE DATABASE HEALTH CHECK ===\n');
  
  const results = {
    tableCount: 0,
    totalRecords: 0,
    errors: [],
    warnings: [],
    criticalIssues: [],
    healthScore: 0
  };
  
  try {
    // Step 1: Core Table Analysis
    console.log('🔍 STEP 1: CORE TABLE ANALYSIS');
    await checkCoreProjectTables(results);
    
    // Step 2: Reference Table Analysis
    console.log('\n🔍 STEP 2: REFERENCE TABLE ANALYSIS');
    await checkReferenceTables(results);
    
    // Step 3: Relationship Integrity
    console.log('\n🔍 STEP 3: RELATIONSHIP INTEGRITY');
    await checkRelationshipIntegrity(results);
    
    // Step 4: Data Consistency
    console.log('\n🔍 STEP 4: DATA CONSISTENCY');
    await checkDataConsistency(results);
    
    // Step 5: Performance Analysis
    console.log('\n🔍 STEP 5: PERFORMANCE ANALYSIS');
    await checkPerformanceMetrics(results);
    
    // Step 6: Schema Validation
    console.log('\n🔍 STEP 6: SCHEMA VALIDATION');
    await validateSchemaIntegrity(results);
    
    // Step 7: Project History Analysis
    console.log('\n🔍 STEP 7: PROJECT HISTORY ANALYSIS');
    await analyzeProjectHistory(results);
    
    // Generate Final Report
    generateHealthReport(results);
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    results.criticalIssues.push(`Database check failure: ${error.message}`);
    generateHealthReport(results);
  }
}

/**
 * Check core project-related tables
 */
async function checkCoreProjectTables(results) {
  const coreTables = [
    { name: 'Projects', key: 'id', displayField: 'project_title' },
    { name: 'project_index', key: 'project_id', displayField: 'event_type_name' },
    { name: 'project_history', key: 'id', displayField: 'summary_description' },
    { name: 'budget_na853_split', key: 'id', displayField: 'mis' },
    { name: 'budget_history', key: 'id', displayField: 'project_id' }
  ];
  
  for (const table of coreTables) {
    try {
      console.log(`  📊 Analyzing ${table.name}...`);
      
      // Get row count
      const { count, error: countError } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        results.errors.push(`${table.name}: ${countError.message}`);
        continue;
      }
      
      results.totalRecords += count;
      console.log(`     Records: ${count.toLocaleString()}`);
      
      // Check for null keys
      const { data: nullKeys, error: nullError } = await supabase
        .from(table.name)
        .select(table.key)
        .is(table.key, null)
        .limit(1);
      
      if (nullError) {
        results.warnings.push(`${table.name}: Could not check null keys - ${nullError.message}`);
      } else if (nullKeys && nullKeys.length > 0) {
        results.criticalIssues.push(`${table.name}: Found null primary keys`);
      }
      
      // Sample data check
      const { data: sample, error: sampleError } = await supabase
        .from(table.name)
        .select('*')
        .limit(3);
      
      if (sampleError) {
        results.warnings.push(`${table.name}: Could not fetch sample data - ${sampleError.message}`);
      } else if (sample) {
        console.log(`     Columns: ${Object.keys(sample[0] || {}).length}`);
        console.log(`     Sample: ${sample.length > 0 ? '✓' : '❌'}`);
      }
      
      results.tableCount++;
      
    } catch (error) {
      results.errors.push(`${table.name}: Analysis failed - ${error.message}`);
    }
  }
}

/**
 * Check reference tables
 */
async function checkReferenceTables(results) {
  const referenceTables = [
    { name: 'event_types', expectedMin: 10, key: 'name' },
    { name: 'expediture_types', expectedMin: 5, key: 'expediture_types' },
    { name: 'kallikratis', expectedMin: 900, key: 'perifereia' },
    { name: 'Monada', expectedMin: 10, key: 'unit_name' },
    { name: 'users', expectedMin: 1, key: 'email' }
  ];
  
  for (const table of referenceTables) {
    try {
      console.log(`  📚 Checking ${table.name}...`);
      
      const { count, error: countError } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        results.errors.push(`${table.name}: ${countError.message}`);
        continue;
      }
      
      console.log(`     Records: ${count.toLocaleString()} (expected: ${table.expectedMin}+)`);
      
      if (count < table.expectedMin) {
        results.warnings.push(`${table.name}: Low record count (${count} < ${table.expectedMin})`);
      }
      
      // Check for unique values
      const { data: uniqueCheck, error: uniqueError } = await supabase
        .from(table.name)
        .select(table.key)
        .limit(10);
      
      if (uniqueError) {
        results.warnings.push(`${table.name}: Could not check unique values - ${uniqueError.message}`);
      } else if (uniqueCheck) {
        const uniqueValues = new Set(uniqueCheck.map(row => row[table.key]));
        console.log(`     Unique ${table.key}: ${uniqueValues.size}/${uniqueCheck.length}`);
      }
      
    } catch (error) {
      results.errors.push(`${table.name}: Check failed - ${error.message}`);
    }
  }
}

/**
 * Check relationship integrity
 */
async function checkRelationshipIntegrity(results) {
  const relationships = [
    {
      parent: 'Projects',
      child: 'project_index',
      parentKey: 'id',
      childKey: 'project_id',
      name: 'Projects → project_index'
    },
    {
      parent: 'Projects',
      child: 'project_history',
      parentKey: 'id',
      childKey: 'project_id',
      name: 'Projects → project_history'
    },
    {
      parent: 'event_types',
      child: 'project_index',
      parentKey: 'id',
      childKey: 'event_type_id',
      name: 'event_types → project_index'
    },
    {
      parent: 'expediture_types',
      child: 'project_index',
      parentKey: 'id',
      childKey: 'expediture_type_id',
      name: 'expediture_types → project_index'
    }
  ];
  
  for (const rel of relationships) {
    try {
      console.log(`  🔗 Checking ${rel.name}...`);
      
      // Check for orphaned records
      const { data: orphans, error: orphanError } = await supabase
        .from(rel.child)
        .select(`${rel.childKey}, ${rel.parent}!inner(${rel.parentKey})`)
        .is(`${rel.parent}.${rel.parentKey}`, null)
        .limit(5);
      
      if (orphanError) {
        if (orphanError.message.includes('Could not find a relationship')) {
          console.log(`     Relationship check skipped (no FK defined)`);
        } else {
          results.warnings.push(`${rel.name}: Could not check orphans - ${orphanError.message}`);
        }
      } else if (orphans && orphans.length > 0) {
        results.criticalIssues.push(`${rel.name}: Found ${orphans.length} orphaned records`);
      } else {
        console.log(`     Orphaned records: 0 ✓`);
      }
      
    } catch (error) {
      results.warnings.push(`${rel.name}: Relationship check failed - ${error.message}`);
    }
  }
}

/**
 * Check data consistency
 */
async function checkDataConsistency(results) {
  try {
    // Check project-index consistency
    console.log('  📏 Checking project-index consistency...');
    
    const { data: projectCount } = await supabase
      .from('Projects')
      .select('id', { count: 'exact', head: true });
    
    const { data: indexCount } = await supabase
      .from('project_index')
      .select('project_id', { count: 'exact', head: true });
    
    if (projectCount && indexCount) {
      console.log(`     Projects: ${projectCount.length || 0}`);
      console.log(`     Index entries: ${indexCount.length || 0}`);
      
      const ratio = indexCount.length / (projectCount.length || 1);
      if (ratio < 0.8) {
        results.warnings.push(`Low project_index coverage: ${(ratio * 100).toFixed(1)}%`);
      }
    }
    
    // Check budget consistency
    console.log('  💰 Checking budget consistency...');
    
    const { data: budgetSample, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('mis, q1, q2, q3, q4')
      .limit(10);
    
    if (budgetError) {
      results.warnings.push(`Budget check failed: ${budgetError.message}`);
    } else if (budgetSample) {
      let negativeValues = 0;
      let nullValues = 0;
      
      budgetSample.forEach(budget => {
        ['q1', 'q2', 'q3', 'q4'].forEach(quarter => {
          const value = budget[quarter];
          if (value === null || value === undefined) nullValues++;
          else if (value < 0) negativeValues++;
        });
      });
      
      console.log(`     Negative values: ${negativeValues}`);
      console.log(`     Null values: ${nullValues}`);
      
      if (negativeValues > 0) {
        results.warnings.push(`Found ${negativeValues} negative budget values`);
      }
    }
    
  } catch (error) {
    results.warnings.push(`Data consistency check failed: ${error.message}`);
  }
}

/**
 * Check performance metrics
 */
async function checkPerformanceMetrics(results) {
  const performanceTests = [
    {
      name: 'Projects query',
      query: () => supabase.from('Projects').select('id, project_title').limit(10)
    },
    {
      name: 'project_index query',
      query: () => supabase.from('project_index').select('*').limit(10)
    },
    {
      name: 'Complex join',
      query: () => supabase
        .from('project_index')
        .select('*, Projects!inner(project_title)')
        .limit(5)
    }
  ];
  
  for (const test of performanceTests) {
    try {
      const startTime = Date.now();
      const { data, error } = await test.query();
      const duration = Date.now() - startTime;
      
      if (error) {
        results.warnings.push(`${test.name}: Query failed - ${error.message}`);
      } else {
        console.log(`  ⚡ ${test.name}: ${duration}ms (${data?.length || 0} rows)`);
        
        if (duration > 2000) {
          results.warnings.push(`${test.name}: Slow query (${duration}ms)`);
        }
      }
    } catch (error) {
      results.warnings.push(`${test.name}: Performance test failed - ${error.message}`);
    }
  }
}

/**
 * Validate schema integrity
 */
async function validateSchemaIntegrity(results) {
  try {
    // Check for required columns in critical tables
    const { data: projectSample } = await supabase
      .from('Projects')
      .select('*')
      .limit(1);
    
    if (projectSample && projectSample.length > 0) {
      const requiredColumns = ['id', 'mis', 'project_title', 'na853'];
      const actualColumns = Object.keys(projectSample[0]);
      const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));
      
      if (missingColumns.length > 0) {
        results.criticalIssues.push(`Projects table missing columns: ${missingColumns.join(', ')}`);
      } else {
        console.log('  ✓ Projects table schema complete');
      }
    }
    
    // Check project_history schema
    const { data: historySample } = await supabase
      .from('project_history')
      .select('*')
      .limit(1);
    
    if (historySample && historySample.length > 0) {
      const historyColumns = Object.keys(historySample[0]);
      const expectedHistoryColumns = ['id', 'project_id', 'decisions', 'formulation', 'changes'];
      const missingHistoryColumns = expectedHistoryColumns.filter(col => !historyColumns.includes(col));
      
      if (missingHistoryColumns.length > 0) {
        results.criticalIssues.push(`project_history table missing columns: ${missingHistoryColumns.join(', ')}`);
      } else {
        console.log('  ✓ project_history table schema complete');
      }
    }
    
  } catch (error) {
    results.warnings.push(`Schema validation failed: ${error.message}`);
  }
}

/**
 * Analyze project history table specifically
 */
async function analyzeProjectHistory(results) {
  try {
    const { count: historyCount, error: countError } = await supabase
      .from('project_history')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      results.errors.push(`project_history count error: ${countError.message}`);
      return;
    }
    
    console.log(`  📚 project_history records: ${historyCount}`);
    
    // Check for entries with complete form data
    const { data: completeEntries, error: completeError } = await supabase
      .from('project_history')
      .select('formulation')
      .not('formulation', 'is', null)
      .limit(10);
    
    if (completeError) {
      results.warnings.push(`Could not check project_history completeness: ${completeError.message}`);
    } else if (completeEntries) {
      let entriesWithCompleteData = 0;
      completeEntries.forEach(entry => {
        if (entry.formulation?.complete_form_data) {
          entriesWithCompleteData++;
        }
      });
      
      console.log(`  ✓ Entries with complete form data: ${entriesWithCompleteData}/${completeEntries.length} sampled`);
    }
    
    // Check for proper JSONB structure
    const { data: jsonbSample, error: jsonbError } = await supabase
      .from('project_history')
      .select('decisions, formulation, changes')
      .not('decisions', 'is', null)
      .limit(5);
    
    if (jsonbError) {
      results.warnings.push(`Could not check JSONB structure: ${jsonbError.message}`);
    } else if (jsonbSample) {
      console.log(`  ✓ JSONB fields populated: ${jsonbSample.length} entries checked`);
    }
    
  } catch (error) {
    results.warnings.push(`project_history analysis failed: ${error.message}`);
  }
}

/**
 * Generate comprehensive health report
 */
function generateHealthReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE HEALTH REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n📈 STATISTICS:`);
  console.log(`   Tables analyzed: ${results.tableCount}`);
  console.log(`   Total records: ${results.totalRecords.toLocaleString()}`);
  console.log(`   Errors: ${results.errors.length}`);
  console.log(`   Warnings: ${results.warnings.length}`);
  console.log(`   Critical issues: ${results.criticalIssues.length}`);
  
  // Calculate health score
  let healthScore = 100;
  healthScore -= results.errors.length * 10;
  healthScore -= results.warnings.length * 5;
  healthScore -= results.criticalIssues.length * 20;
  healthScore = Math.max(0, healthScore);
  
  console.log(`\n🏥 OVERALL HEALTH SCORE: ${healthScore}/100`);
  
  if (healthScore >= 90) {
    console.log('   Status: ✅ EXCELLENT - Database is in optimal condition');
  } else if (healthScore >= 75) {
    console.log('   Status: ✅ GOOD - Minor issues that should be addressed');
  } else if (healthScore >= 50) {
    console.log('   Status: ⚠️ FAIR - Several issues need attention');
  } else {
    console.log('   Status: ❌ POOR - Critical issues require immediate attention');
  }
  
  // Report issues
  if (results.criticalIssues.length > 0) {
    console.log(`\n🚨 CRITICAL ISSUES:`);
    results.criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log(`\n❌ ERRORS:`);
    results.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS:`);
    results.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS:`);
  if (healthScore >= 90) {
    console.log('   • Continue regular monitoring');
    console.log('   • Consider implementing automated health checks');
  } else if (healthScore >= 75) {
    console.log('   • Address warnings to prevent future issues');
    console.log('   • Monitor performance metrics regularly');
  } else if (healthScore >= 50) {
    console.log('   • Prioritize fixing critical issues');
    console.log('   • Review and optimize slow queries');
    console.log('   • Check data consistency more frequently');
  } else {
    console.log('   • Immediate action required on critical issues');
    console.log('   • Consider data backup before making changes');
    console.log('   • Review schema integrity and relationships');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Database health check completed');
  console.log('='.repeat(60));
}

// Execute the comprehensive check
comprehensiveDatabaseCheck().catch(console.error);