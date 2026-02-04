/**
 * Recalculate user_view for all projects based on 2026 documents
 * Uses project_index to link documents to projects
 * Run with: npx tsx scripts/recalculate-user-view-2026.ts
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
  {
    db: {
      schema: process.env.SUPABASE_SCHEMA || "public",
    },
  }
);

interface ProjectBudgetUpdate {
  project_id: number;
  na853: string;
  old_user_view: string;
  calculated_user_view: number;
  document_count: number;
}

async function recalculateAllUserViews() {
  console.log("\n=== Recalculating user_view for all projects (2026 documents) ===\n");

  // Get all project budgets
  const { data: budgets, error: budgetError } = await supabase
    .from("project_budget")
    .select("project_id, na853, user_view, mis")
    .not("project_id", "is", null)
    .order("project_id");

  if (budgetError) {
    throw new Error(`Failed to fetch budgets: ${budgetError.message}`);
  }

  if (!budgets || budgets.length === 0) {
    console.log("No project budgets found.");
    return;
  }

  console.log(`Found ${budgets.length} project budgets to recalculate.\n`);

  const updates: ProjectBudgetUpdate[] = [];
  let processedCount = 0;
  let errorCount = 0;

  for (const budget of budgets) {
    try {
      processedCount++;
      process.stdout.write(`\r[${processedCount}/${budgets.length}] Processing project ${budget.project_id}...`);

      // Get project_index records for this project
      const { data: projectIndexRecords, error: indexError } = await supabase
        .from("project_index")
        .select("id")
        .eq("project_id", budget.project_id);

      if (indexError) {
        console.error(`\n  Error fetching project_index for project ${budget.project_id}:`, indexError);
        errorCount++;
        continue;
      }

      if (!projectIndexRecords || projectIndexRecords.length === 0) {
        // No project_index records, user_view should be 0
        if (parseFloat(budget.user_view || "0") !== 0) {
          updates.push({
            project_id: budget.project_id,
            na853: budget.na853,
            old_user_view: budget.user_view,
            calculated_user_view: 0,
            document_count: 0,
          });
        }
        continue;
      }

      const projectIndexIds = projectIndexRecords.map((rec) => rec.id);

      // Get all 2026+ documents for these project_index records
      // Include all non-rejected/non-cancelled statuses
      const { data: documents, error: docsError } = await supabase
        .from("generated_documents")
        .select("id, total_amount, status, created_at")
        .in("project_index_id", projectIndexIds)
        .in("status", ["approved", "pending", "processed", "completed"])
        .gte("created_at", "2026-01-01T00:00:00Z");

      if (docsError) {
        console.error(`\n  Error fetching documents for project ${budget.project_id}:`, docsError);
        errorCount++;
        continue;
      }

      // Calculate total from documents
      const totalAmount = (documents || []).reduce((sum, doc) => {
        return sum + parseFloat(doc.total_amount || "0");
      }, 0);

      const currentUserView = parseFloat(budget.user_view || "0");

      // Check if update is needed
      if (Math.abs(currentUserView - totalAmount) > 0.01) {
        updates.push({
          project_id: budget.project_id,
          na853: budget.na853,
          old_user_view: budget.user_view,
          calculated_user_view: totalAmount,
          document_count: documents?.length || 0,
        });
      }
    } catch (error) {
      console.error(`\n  Unexpected error processing project ${budget.project_id}:`, error);
      errorCount++;
    }
  }

  console.log("\n\n=== Summary ===\n");
  console.log(`Total projects processed: ${processedCount}`);
  console.log(`Projects requiring update: ${updates.length}`);
  console.log(`Errors encountered: ${errorCount}\n`);

  if (updates.length === 0) {
    console.log("✅ All user_view values are correct. No updates needed.");
    return;
  }

  console.log("Projects requiring update:\n");
  updates.forEach((update, idx) => {
    console.log(
      `${idx + 1}. Project ${update.project_id} (${update.na853}): ` +
      `€${parseFloat(update.old_user_view).toFixed(2)} → €${update.calculated_user_view.toFixed(2)} ` +
      `(${update.document_count} docs)`
    );
  });

  // Ask for confirmation
  console.log("\n⚠️  Ready to update project_budget table.");
  console.log("Press Ctrl+C to cancel or Enter to proceed...");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  console.log("\n🔧 Updating project_budget records...\n");

  let successCount = 0;
  let updateErrorCount = 0;

  for (const update of updates) {
    try {
      const { error: updateError } = await supabase
        .from("project_budget")
        .update({
          user_view: update.calculated_user_view.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", update.project_id);

      if (updateError) {
        console.error(`  ❌ Failed to update project ${update.project_id}:`, updateError);
        updateErrorCount++;
      } else {
        successCount++;
        process.stdout.write(`\r  ✅ Updated ${successCount}/${updates.length} projects...`);
      }
    } catch (error) {
      console.error(`\n  ❌ Error updating project ${update.project_id}:`, error);
      updateErrorCount++;
    }
  }

  console.log("\n\n=== Final Results ===\n");
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed to update: ${updateErrorCount}`);
  console.log(`\n✨ Done!\n`);
}

recalculateAllUserViews()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
