/**
 * Debug script to investigate project 188 calculation issue
 * Run with: npx tsx scripts/debug-project-188.ts
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

async function debugProject188() {
  console.log("\n=== Debugging Project 188 ===\n");

  // Get project budget
  const { data: budget, error: budgetError } = await supabase
    .from("project_budget")
    .select("project_id, na853, user_view, mis")
    .eq("project_id", 188)
    .single();

  if (budgetError) {
    throw new Error(`Failed to fetch budget: ${budgetError.message}`);
  }

  console.log("Project Budget:");
  console.log(`  project_id: ${budget.project_id}`);
  console.log(`  na853: ${budget.na853}`);
  console.log(`  mis: ${budget.mis}`);
  console.log(`  current user_view: €${budget.user_view}\n`);

  // Get project_index records
  const { data: projectIndexRecords, error: indexError } = await supabase
    .from("project_index")
    .select("id, project_id, monada_id, event_types_id")
    .eq("project_id", 188);

  if (indexError) {
    throw new Error(`Failed to fetch project_index: ${indexError.message}`);
  }

  console.log(`Project Index Records (count: ${projectIndexRecords?.length || 0}):`);
  projectIndexRecords?.forEach((rec) => {
    console.log(`  id: ${rec.id}, project_id: ${rec.project_id}`);
  });

  if (!projectIndexRecords || projectIndexRecords.length === 0) {
    console.log("  ❌ No project_index records found!");
    return;
  }

  const projectIndexIds = projectIndexRecords.map((rec) => rec.id);
  console.log(`\nProject Index IDs to query: ${projectIndexIds.join(", ")}\n`);

  // Get ALL documents (no filters first)
  console.log("Step 1: Get ALL documents linked to these project_index IDs:");
  const { data: allDocs, error: allError } = await supabase
    .from("generated_documents")
    .select("id, project_index_id, total_amount, status, created_at")
    .in("project_index_id", projectIndexIds);

  if (allError) {
    throw new Error(`Failed to fetch all documents: ${allError.message}`);
  }

  console.log(`  Found ${allDocs?.length || 0} total documents`);
  allDocs?.forEach((doc) => {
    console.log(
      `    ID: ${doc.id}, amount: €${doc.total_amount}, status: ${doc.status}, created: ${doc.created_at}`
    );
  });

  // Filter by status
  console.log("\nStep 2: Filter by status ['approved', 'pending', 'processed']:");
  const statusFiltered = allDocs?.filter((doc) =>
    ["approved", "pending", "processed"].includes(doc.status)
  ) || [];
  console.log(`  Found ${statusFiltered.length} documents`);
  statusFiltered.forEach((doc) => {
    console.log(`    ID: ${doc.id}, amount: €${doc.total_amount}`);
  });

  // Filter by date
  console.log("\nStep 3: Filter by date >= 2026-01-01:");
  const dateFiltered = statusFiltered.filter((doc) => {
    const docDate = new Date(doc.created_at);
    return docDate >= new Date("2026-01-01T00:00:00Z");
  });
  console.log(`  Found ${dateFiltered.length} documents`);
  dateFiltered.forEach((doc) => {
    console.log(
      `    ID: ${doc.id}, amount: €${doc.total_amount}, created: ${doc.created_at}`
    );
  });

  // Calculate total
  const total = dateFiltered.reduce(
    (sum, doc) => sum + parseFloat(doc.total_amount || "0"),
    0
  );
  console.log(`\n  TOTAL: €${total.toFixed(2)}`);

  // Now test the actual query from the script
  console.log("\nStep 4: Actual script query (with all filters combined):");
  const { data: queriedDocs, error: queryError } = await supabase
    .from("generated_documents")
    .select("id, total_amount, status, created_at")
    .in("project_index_id", projectIndexIds)
    .in("status", ["approved", "pending", "processed"])
    .gte("created_at", "2026-01-01T00:00:00Z");

  if (queryError) {
    throw new Error(`Query error: ${queryError.message}`);
  }

  console.log(`  Found ${queriedDocs?.length || 0} documents`);
  queriedDocs?.forEach((doc) => {
    console.log(
      `    ID: ${doc.id}, amount: €${doc.total_amount}, status: ${doc.status}`
    );
  });

  const scriptTotal = queriedDocs?.reduce(
    (sum, doc) => sum + parseFloat(doc.total_amount || "0"),
    0
  ) || 0;

  console.log(`\n  SCRIPT QUERY TOTAL: €${scriptTotal.toFixed(2)}`);

  console.log("\n=== Summary ===");
  console.log(`Total documents: ${allDocs?.length || 0}`);
  console.log(`After filters: ${queriedDocs?.length || 0}`);
  console.log(`Total amount: €${scriptTotal.toFixed(2)}`);
  console.log(`Expected: 6 docs, €41,879.43`);
  console.log(`Match: ${queriedDocs?.length === 6 && Math.abs(scriptTotal - 41879.43) < 0.01 ? "✅ YES" : "❌ NO"}\n`);
}

debugProject188()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
