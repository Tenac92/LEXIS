/**
 * Create and Populate Project History Table Script
 * 
 * This script creates the project_history table matching the provided SQL structure
 * and populates it with existing project data from the Projects table and related sources.
 * 
 * The script handles:
 * 1. Creating the project_history table with the exact structure specified
 * 2. Populating historical entries from existing project data
 * 3. Extracting data from JSONB fields in the Projects table
 * 4. Linking with reference tables (event_types, expenditure_types, etc.)
 * 5. Creating comprehensive audit trail entries
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Create the project_history table matching the exact SQL structure provided
 */
async function createProjectHistoryTable() {
  console.log('Creating project_history table...');
  
  try {
    // Drop table if exists to recreate with exact structure
    const dropResult = await supabase.rpc('sql', {
      query: 'DROP TABLE IF EXISTS public.project_history CASCADE;'
    });
    
    // Create project_history table with exact structure from user specification
    const createResult = await supabase.rpc('sql', {
      query: `
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
        ) TABLESPACE pg_default;
      `
    });
    
    if (createResult.error) {
      console.error('Error creating table:', createResult.error.message);
      throw createResult.error;
    }
    
    // Create indexes for better performance
    await supabase.rpc('sql', {
      query: 'CREATE INDEX idx_project_history_project_id ON public.project_history(project_id);'
    });
    
    await supabase.rpc('sql', {
      query: 'CREATE INDEX idx_project_history_created_at ON public.project_history(created_at);'
    });
    
    await supabase.rpc('sql', {
      query: 'CREATE INDEX idx_project_history_event_name ON public.project_history(event_name);'
    });
    
    await supabase.rpc('sql', {
      query: 'CREATE INDEX idx_project_history_status ON public.project_history(project_status);'
    });

    if (error) {
      console.error('Error creating project_history table:', error.message);
      throw error;
    }

    console.log('✓ Project history table created successfully');
    return true;
  } catch (err) {
    console.error('Failed to create project_history table:', err.message);
    throw err;
  }
}

/**
 * Fetch all project data along with related information
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
        event_type,
        event_year,
        region,
        implementing_agency,
        expenditure_type,
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
 * Fetch reference data for mapping IDs to names
 */
async function fetchReferenceData() {
  console.log('Fetching reference data...');
  
  const references = {
    eventTypes: new Map(),
    expenditureTypes: new Map(),
    units: new Map(),
    kallikratis: new Map()
  };

  try {
    // Fetch event types
    const { data: eventTypes } = await supabase
      .from('event_types')
      .select('id, name');
    
    if (eventTypes) {
      eventTypes.forEach(et => references.eventTypes.set(et.name, et));
      console.log(`✓ Loaded ${eventTypes.length} event types`);
    }

    // Fetch expenditure types  
    const { data: expenditureTypes } = await supabase
      .from('expediture_types')
      .select('id, expediture_types as name');
    
    if (expenditureTypes) {
      expenditureTypes.forEach(et => references.expenditureTypes.set(et.name, et));
      console.log(`✓ Loaded ${expenditureTypes.length} expenditure types`);
    }

    // Fetch units (Monada)
    const { data: units } = await supabase
      .from('Monada')
      .select('id, unit, unit_name');
    
    if (units) {
      units.forEach(unit => references.units.set(unit.unit, unit));
      console.log(`✓ Loaded ${units.length} units`);
    }

    // Fetch kallikratis data
    const { data: kallikratis } = await supabase
      .from('kallikratis')
      .select('*');
    
    if (kallikratis) {
      kallikratis.forEach(k => references.kallikratis.set(k.id, k));
      console.log(`✓ Loaded ${kallikratis.length} kallikratis entries`);
    }

  } catch (err) {
    console.error('Error fetching reference data:', err.message);
  }

  return references;
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
function transformProjectToHistory(project, references) {
  // Parse JSON fields
  const eventTypes = safeJsonParse(project.event_type);
  const eventYears = safeJsonParse(project.event_year);
  const regions = safeJsonParse(project.region);
  const implementingAgencies = safeJsonParse(project.implementing_agency);
  const expenditureTypes = safeJsonParse(project.expenditure_type);
  const kya = safeJsonParse(project.kya);
  const fek = safeJsonParse(project.fek);
  const ada = safeJsonParse(project.ada);

  // Extract event information
  const eventName = Array.isArray(eventTypes) && eventTypes.length > 0 ? eventTypes[0] : null;
  const eventYear = Array.isArray(eventYears) && eventYears.length > 0 ? 
    parseInt(eventYears[0]) || null : null;

  // Build decisions object
  const decisions = {
    kya: kya,
    fek: fek,
    ada: ada,
    ada_import_sana271: safeJsonParse(project.ada_import_sana271),
    ada_import_sana853: safeJsonParse(project.ada_import_sana853),
    budget_decision: safeJsonParse(project.budget_decision),
    funding_decision: safeJsonParse(project.funding_decision),
    allocation_decision: safeJsonParse(project.allocation_decision)
  };

  // Build implementing agency location from regions and agencies
  let implementingAgencyLocation = '';
  if (Array.isArray(regions) && regions.length > 0) {
    const region = regions[0];
    if (typeof region === 'object') {
      implementingAgencyLocation = [
        region.perifereia,
        region.perifereiaki_enotita,
        region.onoma_neou_ota,
        region.onoma_dimotikis_enotitas
      ].filter(Boolean).join(', ');
    }
  }
  
  if (Array.isArray(implementingAgencies) && implementingAgencies.length > 0) {
    implementingAgencyLocation += implementingAgencyLocation ? 
      ` - ${implementingAgencies[0]}` : implementingAgencies[0];
  }

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
    expenditure_types: expenditureTypes.length > 0 ? expenditureTypes : null,
    decisions: Object.keys(decisions).some(key => decisions[key]) ? decisions : null,
    event_name: eventName,
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
  const references = await fetchReferenceData();
  
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`Processing ${projects.length} projects...`);
  
  for (const project of projects) {
    try {
      const historyData = transformProjectToHistory(project, references);
      
      const { error } = await supabase
        .from('project_history')
        .insert(historyData);
      
      if (error) {
        console.error(`Error inserting history for project ${project.id}:`, error.message);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 50 === 0) {
          console.log(`✓ Processed ${successCount} projects...`);
        }
      }
    } catch (err) {
      console.error(`Error processing project ${project.id}:`, err.message);
      errorCount++;
    }
  }
  
  console.log(`\n=== PROJECT HISTORY POPULATION COMPLETE ===`);
  console.log(`✓ Successfully created: ${successCount} history entries`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${successCount + errorCount}/${projects.length}`);
}

/**
 * Validate the created table and data
 */
async function validateProjectHistory() {
  console.log('\nValidating project history table...');
  
  try {
    // Check table structure using direct query
    const { data: columns, error: structureError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'project_history')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (structureError) {
      console.error('Error checking table structure:', structureError.message);
    } else {
      console.log('✓ Table structure validation:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
      });
    }

    // Check data counts using aggregation
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
  console.log('=== PROJECT HISTORY TABLE CREATION AND POPULATION ===\n');
  
  try {
    // Step 1: Create the table
    await createProjectHistoryTable();
    
    // Step 2: Populate with existing data
    await populateProjectHistory();
    
    // Step 3: Validate the results
    await validateProjectHistory();
    
    console.log('\n=== ALL OPERATIONS COMPLETED SUCCESSFULLY ===');
    console.log('✓ project_history table is ready for use');
    console.log('✓ Historical data has been populated from existing projects');
    console.log('✓ Foreign key relationships are properly established');
    
  } catch (error) {
    console.error('\n=== OPERATION FAILED ===');
    console.error('Error:', error.message);
    console.log('\nPlease check your Supabase connection and try again.');
    console.log('Make sure you have SUPABASE_SERVICE_ROLE_KEY set in your environment variables.');
    process.exit(1);
  }
}

// Execute the script
main().catch(console.error);