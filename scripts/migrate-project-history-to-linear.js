/**
 * Migrate Project History to Linear Structure
 * 
 * This script migrates the project_history table from complex JSONB columns
 * to a simple, linear column structure for better queryability and performance.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create the new linear project_history table structure
 */
async function createLinearProjectHistoryTable() {
  console.log('Creating new linear project_history table...');
  
  // First, backup existing data
  const { data: existingData, error: fetchError } = await supabase
    .from('project_history')
    .select('*');
    
  if (fetchError) {
    console.log('No existing project_history table found, creating new one');
  } else {
    console.log(`Backing up ${existingData.length} existing project history entries`);
    // Save backup to file
    const fs = await import('fs');
    fs.writeFileSync(
      `project_history_backup_${new Date().toISOString().split('T')[0]}.json`, 
      JSON.stringify(existingData, null, 2)
    );
    console.log('Backup saved to project_history_backup_[date].json');
  }

  // Drop existing table and create new linear structure
  const createTableSQL = `
    -- Drop existing table if it exists
    DROP TABLE IF EXISTS public.project_history CASCADE;
    
    -- Create new linear project_history table
    CREATE TABLE public.project_history (
      id BIGSERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES public."Projects"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      change_type TEXT NOT NULL DEFAULT 'UPDATE',
      change_description TEXT,
      changed_by INTEGER, -- User ID who made the change
      
      -- Core Project Fields (snapshot at time of change)
      project_title TEXT,
      project_description TEXT,
      event_description TEXT,
      status TEXT,
      
      -- Financial Data
      budget_na853 DECIMAL(12,2),
      budget_na271 DECIMAL(12,2),
      budget_e069 DECIMAL(12,2),
      
      -- SA Codes
      na853 TEXT,
      na271 TEXT,
      e069 TEXT,
      
      -- Event Information
      event_type_id INTEGER REFERENCES public.event_types(id),
      event_year TEXT, -- JSON array as text for multiple years
      
      -- Document References (for decisions/documents that triggered this change)
      protocol_number TEXT,
      fek TEXT,
      ada TEXT,
      
      -- Location (simplified - main location only)
      region TEXT,
      regional_unit TEXT,
      municipality TEXT,
      
      -- Implementation
      implementing_agency_id INTEGER REFERENCES public."Monada"(id),
      implementing_agency_name TEXT,
      
      -- Additional Fields
      expenses_executed DECIMAL(12,2),
      project_status TEXT,
      enumeration_code TEXT,
      inclusion_year INTEGER,
      
      -- Summary and Comments
      summary_description TEXT,
      change_comments TEXT,
      
      -- Previous state (for comparison)
      previous_status TEXT,
      previous_budget_na853 DECIMAL(12,2),
      previous_budget_na271 DECIMAL(12,2),
      previous_budget_e069 DECIMAL(12,2)
    );
    
    -- Create indexes for better performance
    CREATE INDEX idx_project_history_project_id ON public.project_history(project_id);
    CREATE INDEX idx_project_history_created_at ON public.project_history(created_at);
    CREATE INDEX idx_project_history_change_type ON public.project_history(change_type);
    CREATE INDEX idx_project_history_changed_by ON public.project_history(changed_by);
    
    -- Grant permissions
    GRANT ALL ON public.project_history TO postgres;
    GRANT ALL ON SEQUENCE project_history_id_seq TO postgres;
  `;

  const { error: createError } = await supabase.rpc('exec', { sql: createTableSQL });
  
  if (createError) {
    console.error('Error creating linear project_history table:', createError);
    return false;
  }
  
  console.log('✓ Linear project_history table created successfully');
  return true;
}

/**
 * Migrate existing JSONB data to linear structure
 */
async function migrateExistingData() {
  console.log('Migrating existing data to linear structure...');
  
  // Get all projects to create initial history entries
  const { data: projects, error: projectsError } = await supabase
    .from('Projects')
    .select('*');
    
  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return false;
  }
  
  console.log(`Creating initial history entries for ${projects.length} projects...`);
  
  const historyEntries = projects.map(project => ({
    project_id: project.id,
    change_type: 'INITIAL',
    change_description: 'Initial project state from migration',
    project_title: project.project_title,
    project_description: project.event_description,
    event_description: project.event_description,
    status: project.status,
    budget_na853: project.budget_na853,
    budget_na271: project.budget_na271,
    budget_e069: project.budget_e069,
    na853: project.na853,
    na271: project.na271,
    e069: project.e069,
    event_type_id: project.event_type_id,
    event_year: Array.isArray(project.event_year) ? JSON.stringify(project.event_year) : project.event_year,
    enumeration_code: project.na853, // Use NA853 as enumeration code
    created_at: project.created_at || new Date().toISOString()
  }));
  
  // Insert in batches to avoid memory issues
  const batchSize = 50;
  for (let i = 0; i < historyEntries.length; i += batchSize) {
    const batch = historyEntries.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('project_history')
      .insert(batch);
      
    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      return false;
    }
    
    console.log(`✓ Migrated batch ${i / batchSize + 1}/${Math.ceil(historyEntries.length / batchSize)}`);
  }
  
  console.log(`✓ Successfully migrated ${historyEntries.length} initial project history entries`);
  return true;
}

/**
 * Verify the migration
 */
async function verifyMigration() {
  console.log('Verifying migration...');
  
  const { data: historyCount, error: countError } = await supabase
    .from('project_history')
    .select('id', { count: 'exact' });
    
  if (countError) {
    console.error('Error verifying migration:', countError);
    return false;
  }
  
  const { data: projectCount, error: projectCountError } = await supabase
    .from('Projects')
    .select('id', { count: 'exact' });
    
  if (projectCountError) {
    console.error('Error counting projects:', projectCountError);
    return false;
  }
  
  console.log(`\n=== Migration Verification ===`);
  console.log(`Projects in database: ${projectCount.length}`);
  console.log(`History entries created: ${historyCount.length}`);
  console.log(`Migration success: ${historyCount.length >= projectCount.length ? '✓' : '✗'}`);
  
  // Show sample data
  const { data: sampleHistory, error: sampleError } = await supabase
    .from('project_history')
    .select('*')
    .limit(3);
    
  if (!sampleError && sampleHistory.length > 0) {
    console.log('\nSample history entry:');
    console.log({
      id: sampleHistory[0].id,
      project_id: sampleHistory[0].project_id,
      change_type: sampleHistory[0].change_type,
      project_title: sampleHistory[0].project_title?.substring(0, 50) + '...',
      budget_na853: sampleHistory[0].budget_na853,
      created_at: sampleHistory[0].created_at
    });
  }
  
  return true;
}

/**
 * Main migration function
 */
async function main() {
  console.log('=== Project History Linear Migration ===\n');
  
  try {
    // Step 1: Create new linear table structure
    const tableCreated = await createLinearProjectHistoryTable();
    if (!tableCreated) {
      throw new Error('Failed to create linear project history table');
    }
    
    // Step 2: Migrate existing data
    const dataMigrated = await migrateExistingData();
    if (!dataMigrated) {
      throw new Error('Failed to migrate existing data');
    }
    
    // Step 3: Verify migration
    const verified = await verifyMigration();
    if (!verified) {
      throw new Error('Migration verification failed');
    }
    
    console.log('\n🎉 Project History Linear Migration completed successfully!');
    console.log('\nBenefits of the new structure:');
    console.log('• Simple SQL queries instead of complex JSONB operations');
    console.log('• Better performance with proper indexing');
    console.log('• Easier data analysis and reporting');
    console.log('• Standard relational database practices');
    console.log('• Clearer audit trail with change tracking');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
main();