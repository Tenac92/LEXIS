/**
 * Seed mock data for stage database.
 * Run with: npx tsx scripts/seed-stage.ts
 */
import dotenv from "dotenv";
import bcrypt from "bcrypt";
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

const now = new Date().toISOString();

async function getRowCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`[Seed] Failed counting ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function seedEventTypes() {
  const count = await getRowCount("event_types");
  if (count > 0) {
    console.log("[Seed] event_types already populated, skipping.");
    return;
  }

  const { error } = await supabase.from("event_types").insert([
    { name: "Έγκριση" },
    { name: "Τροποποίηση" },
    { name: "Κλείσιμο" },
  ]);

  if (error) throw new Error(`[Seed] event_types: ${error.message}`);
}

async function seedExpenditureTypes() {
  const count = await getRowCount("expenditure_types");
  if (count > 0) {
    console.log("[Seed] expenditure_types already populated, skipping.");
    return;
  }

  const { error } = await supabase.from("expenditure_types").insert([
    { expenditure_types: "Τεχνικά Έργα", expenditure_types_minor: "Οδικά" },
    { expenditure_types: "Προμήθειες", expenditure_types_minor: "Εξοπλισμός" },
  ]);

  if (error) throw new Error(`[Seed] expenditure_types: ${error.message}`);
}

async function seedMonada() {
  const count = await getRowCount("Monada");
  if (count > 0) {
    console.log("[Seed] Monada already populated, skipping.");
    return;
  }

  const { error } = await supabase.from("Monada").insert([
    {
      id: 1,
      unit: "A1",
      unit_name: { name: "Διεύθυνση Υποδομών" },
      parts: { sector: "Τεχνικά" },
      email: "infra@example.com",
      director: { name: "Α. Παπαδόπουλος" },
      address: { tk: "10557", region: "Αττική", address: "Σταδίου 1" },
    },
    {
      id: 2,
      unit: "B2",
      unit_name: { name: "Διεύθυνση Προμηθειών" },
      parts: { sector: "Οικονομικά" },
      email: "procurement@example.com",
      director: { name: "Μ. Ιωάννου" },
      address: { tk: "54624", region: "Κεντρική Μακεδονία", address: "Εγνατία 20" },
    },
  ]);

  if (error) throw new Error(`[Seed] Monada: ${error.message}`);
}

async function seedGeography() {
  const regionsCount = await getRowCount("regions");
  if (regionsCount === 0) {
    const { error } = await supabase.from("regions").insert([
      { code: 1, name: "Αττική" },
      { code: 2, name: "Κεντρική Μακεδονία" },
    ]);
    if (error) throw new Error(`[Seed] regions: ${error.message}`);
  }

  const unitsCount = await getRowCount("regional_units");
  if (unitsCount === 0) {
    const { error } = await supabase.from("regional_units").insert([
      { code: 101, name: "Κεντρικός Τομέας Αθηνών", region_code: 1 },
      { code: 201, name: "Θεσσαλονίκης", region_code: 2 },
    ]);
    if (error) throw new Error(`[Seed] regional_units: ${error.message}`);
  }

  const munisCount = await getRowCount("municipalities");
  if (munisCount === 0) {
    const { error } = await supabase.from("municipalities").insert([
      { code: 10101, name: "Δήμος Αθηναίων", unit_code: 101 },
      { code: 20101, name: "Δήμος Θεσσαλονίκης", unit_code: 201 },
    ]);
    if (error) throw new Error(`[Seed] municipalities: ${error.message}`);
  }
}

async function seedUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", "admin@stage.local")
    .limit(1);

  if (error) throw new Error(`[Seed] users lookup: ${error.message}`);
  if (data && data.length > 0) {
    console.log("[Seed] User admin@stage.local already exists, skipping.");
    return;
  }

  const password = await bcrypt.hash("admin123!", 10);
  const { error: insertError } = await supabase.from("users").insert([
    {
      email: "admin@stage.local",
      password,
      name: "Stage Admin",
      role: "admin",
      is_active: true,
      department: "IT",
    },
  ]);

  if (insertError) throw new Error(`[Seed] users insert: ${insertError.message}`);
}

async function seedProjects() {
  const { data: existing, error } = await supabase
    .from("Projects")
    .select("id, na853")
    .in("na853", ["NA853-2026-001", "NA853-2026-002"]);

  if (error) throw new Error(`[Seed] Projects lookup: ${error.message}`);
  if (existing && existing.length > 0) {
    console.log("[Seed] Projects already seeded, skipping.");
    return;
  }

  const { data: insertedProjects, error: insertError } = await supabase
    .from("Projects")
    .insert([
      {
        mis: 1001,
        na853: "NA853-2026-001",
        event_description: "Αναβάθμιση οδικού δικτύου",
        project_title: "Βελτίωση Οδικής Ασφάλειας",
        status: "Ενεργό",
        event_year: [2026],
        inc_year: 2026,
      },
      {
        mis: 1002,
        na853: "NA853-2026-002",
        event_description: "Προμήθεια εξοπλισμού",
        project_title: "Εξοπλισμός Υπηρεσιών",
        status: "Ενεργό",
        event_year: [2026],
        inc_year: 2026,
      },
    ])
    .select("id, na853, mis")
    .order("id", { ascending: true });

  if (insertError) throw new Error(`[Seed] Projects insert: ${insertError.message}`);
  if (!insertedProjects || insertedProjects.length === 0) return;

  const { data: eventTypes, error: eventError } = await supabase
    .from("event_types")
    .select("id")
    .order("id", { ascending: true })
    .limit(1);
  if (eventError || !eventTypes?.[0]) {
    throw new Error(`[Seed] event_types fetch: ${eventError?.message || "missing"}`);
  }

  const { data: expTypes, error: expError } = await supabase
    .from("expenditure_types")
    .select("id")
    .order("id", { ascending: true })
    .limit(1);
  if (expError || !expTypes?.[0]) {
    throw new Error(`[Seed] expenditure_types fetch: ${expError?.message || "missing"}`);
  }

  const { data: monadaRows, error: monadaError } = await supabase
    .from("Monada")
    .select("id")
    .order("id", { ascending: true })
    .limit(2);
  if (monadaError || !monadaRows?.[0]) {
    throw new Error(`[Seed] Monada fetch: ${monadaError?.message || "missing"}`);
  }

  const projectBudgetRows = insertedProjects.map((project, idx) => ({
    na853: project.na853,
    mis: project.mis,
    project_id: project.id,
    proip: idx === 0 ? "250000.00" : "120000.00",
    ethsia_pistosi: idx === 0 ? "50000.00" : "30000.00",
    q1: idx === 0 ? "15000.00" : "8000.00",
    q2: idx === 0 ? "15000.00" : "7000.00",
    q3: idx === 0 ? "10000.00" : "9000.00",
    q4: idx === 0 ? "10000.00" : "6000.00",
    katanomes_etous: idx === 0 ? "50000.00" : "30000.00",
    user_view: idx === 0 ? "20000.00" : "9000.00",
    current_quarter_spent: idx === 0 ? "3000.00" : "1500.00",
  }));

  const { error: budgetError } = await supabase
    .from("project_budget")
    .insert(projectBudgetRows);
  if (budgetError) throw new Error(`[Seed] project_budget: ${budgetError.message}`);

  const projectIndexRows = insertedProjects.map((project, idx) => ({
    project_id: project.id,
    monada_id: monadaRows[idx % monadaRows.length].id,
    event_types_id: eventTypes[0].id,
    expenditure_type_id: expTypes[0].id,
  }));

  const { data: projectIndexInserted, error: indexError } = await supabase
    .from("project_index")
    .insert(projectIndexRows)
    .select("id, project_id")
    .order("id", { ascending: true });

  if (indexError) throw new Error(`[Seed] project_index: ${indexError.message}`);

  if (projectIndexInserted && projectIndexInserted.length > 0) {
    const regionLinks = projectIndexInserted.map((row, idx) => ({
      project_index_id: row.id,
      region_code: idx === 0 ? 1 : 2,
    }));

    const unitLinks = projectIndexInserted.map((row, idx) => ({
      project_index_id: row.id,
      unit_code: idx === 0 ? 101 : 201,
    }));

    const muniLinks = projectIndexInserted.map((row, idx) => ({
      project_index_id: row.id,
      muni_code: idx === 0 ? 10101 : 20101,
    }));

    await supabase.from("project_index_regions").insert(regionLinks);
    await supabase.from("project_index_units").insert(unitLinks);
    await supabase.from("project_index_munis").insert(muniLinks);
  }

  const budgetHistoryRows = insertedProjects.map((project) => ({
    project_id: project.id,
    previous_amount: "0.00",
    new_amount: "10000.00",
    change_type: "seed",
    change_reason: "Initial stage seed",
  }));

  const { error: historyError } = await supabase
    .from("budget_history")
    .insert(budgetHistoryRows);
  if (historyError) throw new Error(`[Seed] budget_history: ${historyError.message}`);
}

async function main() {
  console.log("[Seed] Starting stage data seed...");
  await seedEventTypes();
  await seedExpenditureTypes();
  await seedMonada();
  await seedGeography();
  await seedUsers();
  await seedProjects();
  console.log("[Seed] Completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
