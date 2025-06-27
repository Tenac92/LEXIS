/**
 * Simple Project History Creation Script
 * 
 * This script creates the project_history table using a simpler approach
 * that works with standard Supabase configurations and then populates it
 * with existing project data.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Check if project_history table exists
 */
async function checkTableExists() {
  try {
    const { data, error } = await supabase
      .from('project_history')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      // Table doesn't exist
      return false;
    }
    
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Create project_history table using Supabase client
 * Since we can't use direct SQL, we'll guide the user to create it manually
 */
async function createProjectHistoryTable() {
  console.log('Checking if project_history table exists...');
  
  const exists = await checkTableExists();
  
  if (exists) {
    console.log('✓ project_history table already exists');
    return true;
  }
  
  console.log('❌ project_history table does not exist');
  console.log('\n📋 SQL to create the table:');
  console.log('=========================================');
  
  const createTableSQL = `
-- Create project_history table
CREATE TABLE public.project_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  project_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  implementing_agency_location text NULL,
  expenditure_types jsonb NULL,
  decisions jsonb NULL,
  event_name text NULL,
  event_year integer NULL,
  enumeration_code text NULL,
  inclusion_year integer NULL,
  summary_description text NULL,
  expenses_executed numeric NULL,
  project_status text NULL,
  previous_entries jsonb NULL,
  formulation jsonb NULL,
  changes jsonb NULL,
  CONSTRAINT project_history_pkey PRIMARY KEY (id),
  CONSTRAINT project_history_project_id_fkey FOREIGN KEY (project_id) 
    REFERENCES "Projects" (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_project_history_project_id ON public.project_history(project_id);
CREATE INDEX idx_project_history_created_at ON public.project_history(created_at);
CREATE INDEX idx_project_history_event_name ON public.project_history(event_name);
CREATE INDEX idx_project_history_status ON public.project_history(project_status);
`;
  
  console.log(createTableSQL);
  console.log('=========================================');
  console.log('\nPlease execute this SQL in your Supabase SQL editor, then run this script again.');
  
  return false;
}

/**
 * Fetch project data for population
 */
async function fetchProjectsData() {
  console.log('Fetching projects data...');
  
  try {
    const { data: projects, error } = await supabase
      .from('Projects')
      .select(`
        id,
        mis,
        na853,
        event_description,
        project_title,
        event_type_id,
        event_year,
        kya,
        fek,
        ada,
        ada_import_sana271,
        ada_import_sana853,
        budget_decision,
        funding_decision,
        allocation_decision,
        budget_e069,
        budget_na271,
        budget_na853,
        status,
        created_at,
        updated_at
      `);

    if (error) {
      throw error;
    }

    console.log(`✓ Found ${projects.length} projects to process`);
    return projects;
  } catch (err) {
    console.error('Error fetching projects data:', err.message);
    throw err;
  }
}

/**
 * Parse JSON field safely
 */
function safeJsonParse(jsonString, fallback = []) {
  if (!jsonString) return fallback;
  
  try {
    if (typeof jsonString === 'string') {
      // Handle double-encoded JSON strings
      if (jsonString.startsWith('"[') && jsonString.endsWith(']"')) {
        return JSON.parse(JSON.parse(jsonString));
      }
      return JSON.parse(jsonString);
    }
    return Array.isArray(jsonString) ? jsonString : fallback;
  } catch (err) {
    return fallback;
  }
}

/**
 * Transform project data into project history format
 */
function transformProjectToHistory(project) {
  // Parse JSON fields - Projects table stores arrays directly
  const eventYears = Array.isArray(project.event_year) ? project.event_year : safeJsonParse(project.event_year);
  const kya = Array.isArray(project.kya) ? project.kya : safeJsonParse(project.kya);
  const fek = Array.isArray(project.fek) ? project.fek : safeJsonParse(project.fek);
  const ada = Array.isArray(project.ada) ? project.ada : safeJsonParse(project.ada);

  // Extract event information
  const eventYear = Array.isArray(eventYears) && eventYears.length > 0 ? 
    parseInt(eventYears[0]) || null : null;

  // Build decisions object
  const decisions = {
    kya: kya,
    fek: fek,
    ada: ada,
    ada_import_sana271: Array.isArray(project.ada_import_sana271) ? project.ada_import_sana271 : safeJsonParse(project.ada_import_sana271),
    ada_import_sana853: Array.isArray(project.ada_import_sana853) ? project.ada_import_sana853 : safeJsonParse(project.ada_import_sana853),
    budget_decision: Array.isArray(project.budget_decision) ? project.budget_decision : safeJsonParse(project.budget_decision),
    funding_decision: Array.isArray(project.funding_decision) ? project.funding_decision : safeJsonParse(project.funding_decision),
    allocation_decision: Array.isArray(project.allocation_decision) ? project.allocation_decision : safeJsonParse(project.allocation_decision)
  };

  // For implementing agency location, we'll use event_description as base since region/agency data is handled by project_index
  let implementingAgencyLocation = project.event_description || '';

  // Build formulation object with budget data
  const formulation = {
    budget_e069: project.budget_e069,
    budget_na271: project.budget_na271,
    budget_na853: project.budget_na853,
    na853_code: project.na853,
    mis_code: project.mis,
    project_title: project.project_title,
    event_description: project.event_description
  };

  return {
    project_id: project.id,
    implementing_agency_location: implementingAgencyLocation || null,
    expenditure_types: null, // Will be populated from project_index data later
    decisions: Object.keys(decisions).some(key => decisions[key] && Array.isArray(decisions[key]) && decisions[key].length > 0) ? decisions : null,
    event_name: null, // Will be populated from event_types lookup using event_type_id
    event_year: eventYear,
    enumeration_code: project.na853,
    inclusion_year: eventYear, // Use event year as inclusion year if available
    summary_description: project.event_description,
    expenses_executed: project.budget_na853 ? parseFloat(project.budget_na853) : null,
    project_status: project.status || 'active',
    previous_entries: null, // Will be populated if we have version history
    formulation: formulation,
    changes: null // Will track future changes
  };
}

/**
 * Populate project_history table with existing project data
 */
async function populateProjectHistory() {
  console.log('Starting project history population...');
  
  const projects = await fetchProjectsData();
  
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`Processing ${projects.length} projects...`);
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    const historyEntries = batch.map(project => transformProjectToHistory(project));
    
    try {
      const { error } = await supabase
        .from('project_history')
        .insert(historyEntries);
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✓ Processed batch ${i / batchSize + 1}/${Math.ceil(projects.length / batchSize)} (${successCount} total)`);
      }
    } catch (err) {
      console.error(`Error processing batch ${i / batchSize + 1}:`, err.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`\n=== PROJECT HISTORY POPULATION COMPLETE ===`);
  console.log(`✓ Successfully created: ${successCount} history entries`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${successCount + errorCount}/${projects.length}`);
}

/**
 * Validate the created data
 */
async function validateProjectHistory() {
  console.log('\nValidating project history data...');
  
  try {
    // Check data counts
    const { data: countData, error: countError } = await supabase
      .from('project_history')
      .select('project_id, event_name, expenditure_types, decisions');

    if (countError) {
      console.error('Error checking data counts:', countError.message);
    } else if (countData && countData.length > 0) {
      // Calculate statistics manually
      const totalEntries = countData.length;
      const uniqueProjects = new Set(countData.map(item => item.project_id)).size;
      const entriesWithEvents = countData.filter(item => item.event_name).length;
      const entriesWithExpenditures = countData.filter(item => item.expenditure_types).length;
      const entriesWithDecisions = countData.filter(item => item.decisions).length;
      
      console.log('✓ Data validation:');
      console.log(`  - Total history entries: ${totalEntries}`);
      console.log(`  - Unique projects: ${uniqueProjects}`);
      console.log(`  - Entries with events: ${entriesWithEvents}`);
      console.log(`  - Entries with expenditure types: ${entriesWithExpenditures}`);
      console.log(`  - Entries with decisions: ${entriesWithDecisions}`);
    }

    // Sample a few entries
    const { data: sampleData, error: sampleError } = await supabase
      .from('project_history')
      .select('*')
      .limit(3);

    if (!sampleError && sampleData) {
      console.log('\n✓ Sample entries:');
      sampleData.forEach((entry, index) => {
        console.log(`  Entry ${index + 1}:`);
        console.log(`    - Project ID: ${entry.project_id}`);
        console.log(`    - Event: ${entry.event_name || 'N/A'}`);
        console.log(`    - Status: ${entry.project_status || 'N/A'}`);
        console.log(`    - Location: ${entry.implementing_agency_location || 'N/A'}`);
      });
    }

  } catch (err) {
    console.error('Error during validation:', err.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('=== PROJECT HISTORY TABLE SETUP ===\n');
  
  try {
    // Step 1: Check/Create the table
    const tableReady = await createProjectHistoryTable();
    
    if (!tableReady) {
      console.log('\n⏸️  Script paused: Please create the table first.');
      return;
    }
    
    // Step 2: Populate with existing data
    await populateProjectHistory();
    
    // Step 3: Validate the results
    await validateProjectHistory();
    
    console.log('\n=== OPERATION COMPLETED SUCCESSFULLY ===');
    console.log('✓ project_history table is populated with historical data');
    console.log('✓ Data transformation from Projects table completed');
    console.log('✓ Ready for tracking future project changes');
    
  } catch (error) {
    console.error('\n=== OPERATION FAILED ===');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Execute the script
main().catch(console.error);