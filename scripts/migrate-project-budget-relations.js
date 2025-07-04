/**
 * Migrate Project Budget Relations Script
 * 
 * This script populates the project_id foreign key relationships in the new project_budget table
 * to take advantage of better indexing and query performance with integer foreign keys.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function migrateProjectBudgetRelations() {
  try {
    console.log('[Migration] Starting project_budget table relation migration...');

    // Step 1: Get all projects to create mapping
    console.log('[Migration] Fetching all projects...');
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, na853')
      .limit(1000);

    if (projectsError) {
      throw new Error(`Error fetching projects: ${projectsError.message}`);
    }

    console.log(`[Migration] Found ${projects.length} projects`);

    // Create mapping objects for efficient lookups
    const misToProjectId = new Map();
    const na853ToProjectId = new Map();

    projects.forEach(project => {
      if (project.mis) {
        misToProjectId.set(String(project.mis), project.id);
      }
      if (project.na853) {
        na853ToProjectId.set(project.na853, project.id);
      }
    });

    console.log(`[Migration] Created mappings: ${misToProjectId.size} MIS codes, ${na853ToProjectId.size} NA853 codes`);

    // Step 2: Get all budget records that need project_id population
    console.log('[Migration] Fetching budget records...');
    const { data: budgetRecords, error: budgetError } = await supabase
      .from('project_budget')
      .select('id, mis, na853, project_id')
      .limit(1000);

    if (budgetError) {
      throw new Error(`Error fetching budget records: ${budgetError.message}`);
    }

    console.log(`[Migration] Found ${budgetRecords.length} budget records`);

    // Step 3: Update budget records with project_id relationships
    let updatedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;

    for (const budgetRecord of budgetRecords) {
      // Skip if project_id is already set
      if (budgetRecord.project_id) {
        skippedCount++;
        continue;
      }

      let projectId = null;

      // Strategy 1: Try to match by MIS first (more reliable)
      if (budgetRecord.mis && misToProjectId.has(String(budgetRecord.mis))) {
        projectId = misToProjectId.get(String(budgetRecord.mis));
        console.log(`[Migration] Mapping budget record ${budgetRecord.id} via MIS ${budgetRecord.mis} -> Project ID ${projectId}`);
      }
      // Strategy 2: Try to match by NA853 if MIS didn't work
      else if (budgetRecord.na853 && na853ToProjectId.has(budgetRecord.na853)) {
        projectId = na853ToProjectId.get(budgetRecord.na853);
        console.log(`[Migration] Mapping budget record ${budgetRecord.id} via NA853 ${budgetRecord.na853} -> Project ID ${projectId}`);
      }

      if (projectId) {
        // Update the budget record with the project_id
        const { error: updateError } = await supabase
          .from('project_budget')
          .update({ project_id: projectId })
          .eq('id', budgetRecord.id);

        if (updateError) {
          console.error(`[Migration] Failed to update budget record ${budgetRecord.id}:`, updateError.message);
        } else {
          updatedCount++;
          if (updatedCount % 10 === 0) {
            console.log(`[Migration] Updated ${updatedCount} records...`);
          }
        }
      } else {
        missingCount++;
        console.log(`[Migration] No project mapping found for budget record ${budgetRecord.id} (MIS: ${budgetRecord.mis}, NA853: ${budgetRecord.na853})`);
      }
    }

    // Step 4: Create optimized query to verify the relationships
    console.log('[Migration] Verifying project_id relationships...');
    const { data: verificationData, error: verificationError } = await supabase
      .from('project_budget')
      .select(`
        id,
        project_id,
        Projects!project_budget_project_id_fkey(id, mis, na853)
      `)
      .not('project_id', 'is', null)
      .limit(5);

    if (verificationError) {
      console.warn('[Migration] Verification query failed:', verificationError.message);
    } else {
      console.log('[Migration] Sample verified relationships:', JSON.stringify(verificationData, null, 2));
    }

    // Summary
    console.log('\n[Migration] Migration Summary:');
    console.log(`✓ Total budget records: ${budgetRecords.length}`);
    console.log(`✓ Updated with project_id: ${updatedCount}`);
    console.log(`→ Already had project_id: ${skippedCount}`);
    console.log(`⚠ Missing project mapping: ${missingCount}`);
    console.log(`✓ Success rate: ${((updatedCount + skippedCount) / budgetRecords.length * 100).toFixed(1)}%`);

    console.log('\n[Migration] project_budget table is now optimized with project_id foreign key relationships!');
    console.log('[Migration] Budget queries will now use fast integer-based JOINs instead of text comparisons.');

  } catch (error) {
    console.error('[Migration] Critical error:', error);
    throw error;
  }
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateProjectBudgetRelations()
    .then(() => {
      console.log('[Migration] Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Migration failed:', error);
      process.exit(1);
    });
}

export { migrateProjectBudgetRelations };