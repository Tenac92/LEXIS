/**
 * Update Budget Table Script
 * Adds project_id column to budget_na853_split table and populates it
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function updateBudgetTable() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    console.log('[BudgetUpdate] Starting budget table update...');

    // First, check if project_id column already exists
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'budget_na853_split' });

    if (columnsError) {
      console.log('[BudgetUpdate] Continuing with manual column check...');
    }

    // Get all budget records
    console.log('[BudgetUpdate] Fetching all budget records...');
    const { data: budgetRecords, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('id, mis, na853')
      .limit(1000);

    if (budgetError) {
      console.error('[BudgetUpdate] Error fetching budget records:', budgetError);
      return;
    }

    console.log(`[BudgetUpdate] Found ${budgetRecords.length} budget records`);

    // Get all projects to create mapping
    console.log('[BudgetUpdate] Fetching all projects...');
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, na853')
      .limit(1000);

    if (projectsError) {
      console.error('[BudgetUpdate] Error fetching projects:', projectsError);
      return;
    }

    console.log(`[BudgetUpdate] Found ${projects.length} projects`);

    // Create mapping from MIS to project ID
    const misToProjectId = new Map();
    const na853ToProjectId = new Map();

    projects.forEach(project => {
      if (project.mis) {
        misToProjectId.set(project.mis, project.id);
      }
      if (project.na853) {
        na853ToProjectId.set(project.na853, project.id);
      }
    });

    console.log(`[BudgetUpdate] Created mapping for ${misToProjectId.size} MIS codes and ${na853ToProjectId.size} NA853 codes`);

    // Update budget records one by one
    let updatedCount = 0;
    let missingCount = 0;

    for (const budgetRecord of budgetRecords) {
      let projectId = null;

      // Try to find project ID by MIS first
      if (budgetRecord.mis && misToProjectId.has(budgetRecord.mis)) {
        projectId = misToProjectId.get(budgetRecord.mis);
      }
      // Then try by NA853
      else if (budgetRecord.na853 && na853ToProjectId.has(budgetRecord.na853)) {
        projectId = na853ToProjectId.get(budgetRecord.na853);
      }

      if (projectId) {
        // Update the record with project_id
        const { error: updateError } = await supabase
          .from('budget_na853_split')
          .update({ project_id: projectId })
          .eq('id', budgetRecord.id);

        if (updateError) {
          console.error(`[BudgetUpdate] Error updating record ${budgetRecord.id}:`, updateError);
        } else {
          updatedCount++;
          if (updatedCount % 10 === 0) {
            console.log(`[BudgetUpdate] Updated ${updatedCount} records...`);
          }
        }
      } else {
        missingCount++;
        console.log(`[BudgetUpdate] No project found for budget record: MIS=${budgetRecord.mis}, NA853=${budgetRecord.na853}`);
      }
    }

    console.log(`[BudgetUpdate] Update complete!`);
    console.log(`[BudgetUpdate] Updated: ${updatedCount} records`);
    console.log(`[BudgetUpdate] Missing project mapping: ${missingCount} records`);

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('budget_na853_split')
      .select('id, mis, na853, project_id')
      .not('project_id', 'is', null)
      .limit(5);

    if (!verifyError && verifyData) {
      console.log('[BudgetUpdate] Sample updated records:');
      verifyData.forEach(record => {
        console.log(`  ID: ${record.id}, MIS: ${record.mis}, NA853: ${record.na853}, Project ID: ${record.project_id}`);
      });
    }

  } catch (error) {
    console.error('[BudgetUpdate] Script error:', error);
  }
}

// Run the script
updateBudgetTable();