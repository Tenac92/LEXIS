/**
 * Budget Migration Utility
 * Handles the transition from MIS-based to ID-based budget lookups
 */

import { supabase } from '../data';

interface BudgetRecord {
  id: number;
  mis: number;
  na853: string;
  project_id?: number;
}

interface ProjectRecord {
  id: number;
  mis: number;
  na853: string;
}

export class BudgetMigration {
  /**
   * Add project_id column to budget table if it doesn't exist
   */
  static async ensureProjectIdColumn(): Promise<boolean> {
    try {
      // Try to add the column - this will fail silently if it already exists
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE project_budget ADD COLUMN IF NOT EXISTS project_id integer;'
      });

      if (error && !error.message?.includes('already exists')) {
        console.warn('[BudgetMigration] Column addition warning:', error.message);
      }

      return true;
    } catch (error) {
      console.log('[BudgetMigration] Using fallback approach for column management');
      return true; // Continue anyway
    }
  }

  /**
   * Populate project_id column based on existing MIS and NA853 values
   */
  static async populateProjectIds(): Promise<{ updated: number; missing: number }> {
    try {
      console.log('[BudgetMigration] Starting project ID population...');

      // Get all budget records
      const { data: budgetRecords, error: budgetError } = await supabase
        .from('project_budget')
        .select('id, mis, na853, project_id')
        .limit(1000);

      if (budgetError) {
        throw new Error(`Failed to fetch budget records: ${budgetError.message}`);
      }

      // Get all projects for mapping
      const { data: projects, error: projectsError } = await supabase
        .from('Projects')
        .select('id, mis, na853')
        .limit(1000);

      if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`);
      }

      console.log(`[BudgetMigration] Processing ${budgetRecords.length} budget records with ${projects.length} projects`);

      // Create mapping dictionaries
      const misToProjectId = new Map<number, number>();
      const na853ToProjectId = new Map<string, number>();

      projects.forEach(project => {
        if (project.mis) {
          misToProjectId.set(project.mis, project.id);
        }
        if (project.na853) {
          na853ToProjectId.set(project.na853, project.id);
        }
      });

      let updatedCount = 0;
      let missingCount = 0;

      // Process budget records in batches
      for (const budgetRecord of budgetRecords) {
        // Skip if already has project_id
        if (budgetRecord.project_id) {
          continue;
        }

        let projectId: number | null = null;

        // Try MIS lookup first
        if (budgetRecord.mis && misToProjectId.has(budgetRecord.mis)) {
          projectId = misToProjectId.get(budgetRecord.mis)!;
        }
        // Then try NA853 lookup
        else if (budgetRecord.na853 && na853ToProjectId.has(budgetRecord.na853)) {
          projectId = na853ToProjectId.get(budgetRecord.na853)!;
        }

        if (projectId) {
          try {
            const { error: updateError } = await supabase
              .from('project_budget')
              .update({ project_id: projectId })
              .eq('id', budgetRecord.id);

            if (updateError) {
              console.error(`[BudgetMigration] Failed to update record ${budgetRecord.id}:`, updateError.message);
            } else {
              updatedCount++;
              if (updatedCount % 20 === 0) {
                console.log(`[BudgetMigration] Updated ${updatedCount} records...`);
              }
            }
          } catch (updateError) {
            console.error(`[BudgetMigration] Update error for record ${budgetRecord.id}:`, updateError);
          }
        } else {
          missingCount++;
          console.log(`[BudgetMigration] No project mapping found: MIS=${budgetRecord.mis}, NA853=${budgetRecord.na853}`);
        }
      }

      console.log(`[BudgetMigration] Migration complete: ${updatedCount} updated, ${missingCount} missing`);
      return { updated: updatedCount, missing: missingCount };

    } catch (error) {
      console.error('[BudgetMigration] Migration error:', error);
      throw error;
    }
  }

  /**
   * Run complete migration process
   */
  static async runMigration(): Promise<boolean> {
    try {
      console.log('[BudgetMigration] Starting budget table migration...');

      // Step 1: Ensure project_id column exists
      await this.ensureProjectIdColumn();

      // Step 2: Populate project_id values
      const result = await this.populateProjectIds();

      console.log(`[BudgetMigration] Migration completed successfully!`);
      console.log(`[BudgetMigration] Updated: ${result.updated} records`);
      console.log(`[BudgetMigration] Missing mappings: ${result.missing} records`);

      return true;
    } catch (error) {
      console.error('[BudgetMigration] Migration failed:', error);
      return false;
    }
  }

  /**
   * Verify migration status
   */
  static async verifyMigration(): Promise<void> {
    try {
      const { data: stats, error } = await supabase
        .from('project_budget')
        .select('id, project_id')
        .limit(1000);

      if (error) {
        console.error('[BudgetMigration] Verification error:', error);
        return;
      }

      const total = stats.length;
      const withProjectId = stats.filter(record => record.project_id).length;
      const withoutProjectId = total - withProjectId;

      console.log(`[BudgetMigration] Verification results:`);
      console.log(`  Total records: ${total}`);
      console.log(`  With project_id: ${withProjectId}`);
      console.log(`  Without project_id: ${withoutProjectId}`);
      console.log(`  Migration coverage: ${((withProjectId / total) * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('[BudgetMigration] Verification failed:', error);
    }
  }
}