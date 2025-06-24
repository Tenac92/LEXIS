/**
 * Create Project History Table Script
 * 
 * Creates a comprehensive project_history table based on the Google Apps Script
 * documentation provided, with proper columns for tracking project changes.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createProjectHistoryTable() {
  try {
    console.log('=== CREATING PROJECT HISTORY TABLE ===\n');

    // Based on the Google Apps Script documentation, create a comprehensive history table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS project_history (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
        
        -- Decision tracking fields
        protocol_number TEXT,
        fek TEXT,
        ada TEXT,
        implementing_agency TEXT,
        decision_budget DECIMAL(15,2),
        expense_category TEXT,
        decision_type TEXT, -- 'Έγκριση', 'Τροποποίηση', 'Παράταση'
        decision_status TEXT, -- 'Ενεργή', 'Ανενεργή'
        is_included BOOLEAN DEFAULT false,
        decision_comments TEXT,
        
        -- Project details changes
        project_title_old TEXT,
        project_title_new TEXT,
        project_description_old TEXT,
        project_description_new TEXT,
        event_description_old TEXT,
        event_description_new TEXT,
        
        -- Budget changes
        budget_na853_old DECIMAL(15,2),
        budget_na853_new DECIMAL(15,2),
        budget_na271_old DECIMAL(15,2),
        budget_na271_new DECIMAL(15,2),
        budget_e069_old DECIMAL(15,2),
        budget_e069_new DECIMAL(15,2),
        
        -- Status changes
        status_old TEXT,
        status_new TEXT,
        
        -- Geographic changes
        region_old JSONB,
        region_new JSONB,
        
        -- Agency changes
        implementing_agency_old TEXT[],
        implementing_agency_new TEXT[],
        
        -- Event type changes
        event_type_old TEXT,
        event_type_new TEXT,
        event_year_old TEXT[],
        event_year_new TEXT[],
        
        -- Expenditure type changes
        expenditure_type_old TEXT[],
        expenditure_type_new TEXT[],
        
        -- Change metadata
        change_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'DECISION'
        change_description TEXT,
        change_reason TEXT,
        
        -- User tracking
        changed_by INTEGER,
        user_name TEXT,
        user_role TEXT,
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        effective_date TIMESTAMP WITH TIME ZONE,
        
        -- Indexes for performance
        INDEX idx_project_history_project_id (project_id),
        INDEX idx_project_history_created_at (created_at),
        INDEX idx_project_history_change_type (change_type),
        INDEX idx_project_history_changed_by (changed_by)
      );
    `;

    console.log('Creating project_history table with comprehensive schema...');
    
    // Execute the table creation
    const { error } = await supabase.rpc('exec', { sql: createTableSQL });
    
    if (error) {
      console.error('Error creating table:', error);
      return;
    }

    console.log('✓ Project history table created successfully');

    // Create trigger function for automatic project change tracking
    const triggerFunctionSQL = `
      CREATE OR REPLACE FUNCTION track_project_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          INSERT INTO project_history (
            project_id,
            project_title_old,
            project_title_new,
            project_description_old,
            project_description_new,
            event_description_old,
            event_description_new,
            budget_na853_old,
            budget_na853_new,
            budget_na271_old,
            budget_na271_new,
            budget_e069_old,
            budget_e069_new,
            status_old,
            status_new,
            change_type,
            change_description,
            created_at
          ) VALUES (
            NEW.id,
            CASE WHEN OLD.project_title != NEW.project_title THEN OLD.project_title END,
            CASE WHEN OLD.project_title != NEW.project_title THEN NEW.project_title END,
            CASE WHEN OLD.event_description != NEW.event_description THEN OLD.event_description END,
            CASE WHEN OLD.event_description != NEW.event_description THEN NEW.event_description END,
            CASE WHEN OLD.event_description != NEW.event_description THEN OLD.event_description END,
            CASE WHEN OLD.event_description != NEW.event_description THEN NEW.event_description END,
            CASE WHEN OLD.budget_na853 != NEW.budget_na853 THEN OLD.budget_na853 END,
            CASE WHEN OLD.budget_na853 != NEW.budget_na853 THEN NEW.budget_na853 END,
            CASE WHEN OLD.budget_na271 != NEW.budget_na271 THEN OLD.budget_na271 END,
            CASE WHEN OLD.budget_na271 != NEW.budget_na271 THEN NEW.budget_na271 END,
            CASE WHEN OLD.budget_e069 != NEW.budget_e069 THEN OLD.budget_e069 END,
            CASE WHEN OLD.budget_e069 != NEW.budget_e069 THEN NEW.budget_e069 END,
            CASE WHEN OLD.status != NEW.status THEN OLD.status END,
            CASE WHEN OLD.status != NEW.status THEN NEW.status END,
            'UPDATE',
            'Automated project update tracking',
            NOW()
          );
          RETURN NEW;
        ELSIF TG_OP = 'INSERT' THEN
          INSERT INTO project_history (
            project_id,
            change_type,
            change_description,
            created_at
          ) VALUES (
            NEW.id,
            'CREATE',
            'Project created',
            NOW()
          );
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;

    console.log('Creating trigger function for automatic change tracking...');
    const { error: triggerError } = await supabase.rpc('exec', { sql: triggerFunctionSQL });
    
    if (triggerError) {
      console.error('Error creating trigger function:', triggerError);
    } else {
      console.log('✓ Trigger function created successfully');
    }

    // Create the trigger
    const triggerSQL = `
      DROP TRIGGER IF EXISTS project_changes_trigger ON "Projects";
      CREATE TRIGGER project_changes_trigger
        AFTER INSERT OR UPDATE ON "Projects"
        FOR EACH ROW
        EXECUTE FUNCTION track_project_changes();
    `;

    console.log('Creating trigger on Projects table...');
    const { error: triggerCreateError } = await supabase.rpc('exec', { sql: triggerSQL });
    
    if (triggerCreateError) {
      console.error('Error creating trigger:', triggerCreateError);
    } else {
      console.log('✓ Trigger created successfully');
    }

    console.log('\n=== PROJECT HISTORY TABLE SETUP COMPLETE ===');
    console.log('The table supports:');
    console.log('- Decision tracking (protocol, FEK, ADA, etc.)');
    console.log('- Project field changes (title, description, budgets)');
    console.log('- Status and metadata changes');
    console.log('- User tracking and timestamps');
    console.log('- Automatic change detection via triggers');

  } catch (error) {
    console.error('Error in createProjectHistoryTable:', error);
  }
}

createProjectHistoryTable().catch(console.error);