/**
 * Database Index Optimization Script
 * 
 * This script adds optimized indexes to frequently queried tables
 * to improve query performance for the comprehensive edit form.
 */

import * as supabaseExecutor from '../supabase-sql-executor.js';

const indexQueries = [
  // Project-related indexes
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_mis ON "Projects" (mis);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status ON "Projects" (status);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_event_type_id ON "Projects" (event_type_id);`,
  
  // Project index optimizations
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_index_project_id ON project_index (project_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_index_monada_id ON project_index (monada_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_index_kallikratis_id ON project_index (kallikratis_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_index_event_types_id ON project_index (event_types_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_index_expediture_type_id ON project_index (expediture_type_id);`,
  
  // Normalized table indexes for decisions and formulations
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_decisions_project_id ON project_decisions (project_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_decisions_is_active ON project_decisions (is_active);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_formulations_project_id ON project_formulations (project_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_formulations_decision_id ON project_formulations (decision_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_formulations_is_active ON project_formulations (is_active);`,
  
  // Reference table indexes
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kallikratis_perifereia ON kallikratis (perifereia);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kallikratis_perifereiaki_enotita ON kallikratis (perifereiaki_enotita);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kallikratis_onoma_neou_ota ON kallikratis (onoma_neou_ota);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kallikratis_compound ON kallikratis (perifereia, perifereiaki_enotita, onoma_neou_ota);`,
  
  // Budget table indexes
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_na853_split_mis ON budget_na853_split (mis);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_na853_split_project_id ON budget_na853_split (project_id);`,
];

async function optimizeDatabaseIndexes() {
  console.log('🚀 Starting database index optimization...');
  console.log(`📊 Planning to create ${indexQueries.length} indexes`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < indexQueries.length; i++) {
    const query = indexQueries[i];
    const indexName = query.match(/idx_\w+/)?.[0] || `index_${i + 1}`;
    
    try {
      console.log(`\n📝 Creating index ${i + 1}/${indexQueries.length}: ${indexName}`);
      
      const result = await supabaseExecutor.executeSQLQuery(query);
      
      if (result.error) {
        if (result.error.includes('already exists')) {
          console.log(`⏭️  Index ${indexName} already exists - skipping`);
          skipCount++;
        } else {
          console.error(`❌ Error creating index ${indexName}:`, result.error);
          errorCount++;
        }
      } else {
        console.log(`✅ Successfully created index ${indexName}`);
        successCount++;
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Exception creating index ${indexName}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n📈 Index Optimization Summary:');
  console.log(`✅ Created: ${successCount} indexes`);
  console.log(`⏭️  Skipped: ${skipCount} indexes (already existed)`);
  console.log(`❌ Errors: ${errorCount} indexes`);
  console.log(`📊 Total: ${successCount + skipCount + errorCount}/${indexQueries.length} indexes processed`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Database optimization completed successfully!');
    console.log('⚡ Query performance should be significantly improved');
  } else {
    console.log('\n⚠️  Database optimization completed with some errors');
    console.log('📝 Check error messages above for details');
  }
}

// Run the optimization
optimizeDatabaseIndexes().catch(error => {
  console.error('💥 Fatal error during database optimization:', error);
  process.exit(1);
});