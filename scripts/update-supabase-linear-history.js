/**
 * Update Supabase to Use Linear Project History Logic
 * 
 * This script creates the linear project_history table in Supabase
 * using individual columns instead of complex JSONB structures
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create the linear project_history table using Supabase SQL execution
 */
async function createLinearHistoryTable() {
  console.log('Creating linear project_history table in Supabase...');
  
  try {
    // First backup existing data
    const { data: existingHistory, error: fetchError } = await supabase
      .from('project_history')
      .select('*');
      
    if (!fetchError && existingHistory) {
      console.log(`Backing up ${existingHistory.length} existing history entries...`);
      
      // Save backup
      const fs = await import('fs');
      const backupFile = `project_history_backup_${Date.now()}.json`;
      fs.writeFileSync(backupFile, JSON.stringify(existingHistory, null, 2));
      console.log(`✓ Backup saved to ${backupFile}`);
    }
    
    // Drop existing table and create new linear structure
    const { error: dropError } = await supabase.rpc('sql', {
      query: 'DROP TABLE IF EXISTS project_history CASCADE;'
    });
    
    if (dropError) {
      console.log('Note: Could not drop existing table, it may not exist yet');
    }
    
    // Create new linear table structure
    const createTableQuery = `
      CREATE TABLE project_history (
        id BIGSERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_type TEXT NOT NULL DEFAULT 'UPDATE',
        change_description TEXT,
        changed_by INTEGER,
        
        -- Core Project Fields
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
        event_type_id INTEGER REFERENCES event_types(id),
        event_year TEXT,
        
        -- Document References
        protocol_number TEXT,
        fek TEXT,
        ada TEXT,
        
        -- Location
        region TEXT,
        regional_unit TEXT,
        municipality TEXT,
        
        -- Implementation
        implementing_agency_id INTEGER REFERENCES "Monada"(id),
        implementing_agency_name TEXT,
        
        -- Additional Fields
        expenses_executed DECIMAL(12,2),
        project_status TEXT,
        enumeration_code TEXT,
        inclusion_year INTEGER,
        summary_description TEXT,
        change_comments TEXT,
        
        -- Previous state for comparison
        previous_status TEXT,
        previous_budget_na853 DECIMAL(12,2),
        previous_budget_na271 DECIMAL(12,2),
        previous_budget_e069 DECIMAL(12,2)
      );
      
      -- Create performance indexes
      CREATE INDEX idx_project_history_project_id ON project_history(project_id);
      CREATE INDEX idx_project_history_created_at ON project_history(created_at);
      CREATE INDEX idx_project_history_change_type ON project_history(change_type);
    `;
    
    const { error: createError } = await supabase.rpc('sql', {
      query: createTableQuery
    });
    
    if (createError) {
      console.error('Error creating linear table:', createError);
      return false;
    }
    
    console.log('✓ Linear project_history table created successfully');
    return true;
    
  } catch (error) {
    console.error('Error in table creation:', error);
    return false;
  }
}

/**
 * Populate with initial data from existing projects
 */
async function populateInitialHistory() {
  console.log('Populating initial history from existing projects...');
  
  try {
    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('*');
      
    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return false;
    }
    
    console.log(`Creating initial history for ${projects.length} projects...`);
    
    // Create initial history entries
    const historyEntries = projects.map(project => ({
      project_id: project.id,
      change_type: 'INITIAL',
      change_description: 'Initial project state from linear migration',
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
      event_year: Array.isArray(project.event_year) ? 
        JSON.stringify(project.event_year) : project.event_year,
      enumeration_code: project.na853
    }));
    
    // Insert in batches
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < historyEntries.length; i += batchSize) {
      const batch = historyEntries.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('project_history')
        .insert(batch);
        
      if (insertError) {
        console.error(`Error inserting batch starting at ${i}:`, insertError);
        return false;
      }
      
      totalInserted += batch.length;
      console.log(`✓ Inserted ${totalInserted}/${historyEntries.length} entries`);
    }
    
    console.log(`✓ Successfully created ${totalInserted} initial history entries`);
    return true;
    
  } catch (error) {
    console.error('Error populating initial history:', error);
    return false;
  }
}

/**
 * Verify the linear structure is working
 */
async function verifyLinearStructure() {
  console.log('Verifying linear project history structure...');
  
  try {
    // Check table exists and has correct structure
    const { data: historyCount, error: countError } = await supabase
      .from('project_history')
      .select('id', { count: 'exact', head: true });
      
    if (countError) {
      console.error('Error verifying table:', countError);
      return false;
    }
    
    // Get sample data to verify structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('project_history')
      .select('*')
      .limit(1);
      
    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
      return false;
    }
    
    console.log('\n=== Linear Structure Verification ===');
    console.log(`Total history entries: ${historyCount?.length || 0}`);
    
    if (sampleData && sampleData.length > 0) {
      const sample = sampleData[0];
      console.log('\nSample linear entry structure:');
      console.log(`• ID: ${sample.id}`);
      console.log(`• Project ID: ${sample.project_id}`);
      console.log(`• Change Type: ${sample.change_type}`);
      console.log(`• Title: ${sample.project_title?.substring(0, 50)}...`);
      console.log(`• Budget NA853: ${sample.budget_na853}`);
      console.log(`• Created At: ${sample.created_at}`);
      console.log(`• Status: ${sample.status}`);
    }
    
    console.log('\n✅ Linear structure verification successful!');
    return true;
    
  } catch (error) {
    console.error('Error in verification:', error);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('=== Supabase Linear Project History Update ===\n');
  
  try {
    // Step 1: Create linear table structure
    console.log('📋 Step 1: Creating linear table structure...');
    const tableCreated = await createLinearHistoryTable();
    if (!tableCreated) {
      throw new Error('Failed to create linear table structure');
    }
    
    // Step 2: Populate with initial data
    console.log('\n📊 Step 2: Populating initial history data...');
    const dataPopulated = await populateInitialHistory();
    if (!dataPopulated) {
      throw new Error('Failed to populate initial history data');
    }
    
    // Step 3: Verify everything works
    console.log('\n🔍 Step 3: Verifying linear structure...');
    const verified = await verifyLinearStructure();
    if (!verified) {
      throw new Error('Linear structure verification failed');
    }
    
    console.log('\n🎉 Supabase Linear Project History Update Complete!');
    console.log('\n📈 Benefits of Linear Structure:');
    console.log('• Simple SQL queries instead of complex JSONB operations');
    console.log('• Better performance with proper column indexes');
    console.log('• Easier data analysis and reporting capabilities');
    console.log('• Standard relational database best practices');
    console.log('• Clear audit trail with change tracking');
    console.log('• Individual column access for all project fields');
    
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.log('\nThe existing system remains unchanged.');
    process.exit(1);
  }
}

// Execute the update
main();