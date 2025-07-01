-- Linear Project History Table Schema Migration for Supabase
-- 
-- This SQL script creates a new linear project_history table with individual columns
-- instead of complex JSONB structures. Run this in Supabase SQL Editor.

-- Step 1: Backup existing data (optional - creates a backup table)
CREATE TABLE project_history_jsonb_backup AS 
SELECT * FROM project_history;

-- Step 2: Drop existing project_history table
DROP TABLE IF EXISTS project_history CASCADE;

-- Step 3: Create new linear project_history table
CREATE TABLE project_history (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Change tracking
  change_type TEXT NOT NULL DEFAULT 'UPDATE',
  change_description TEXT,
  changed_by INTEGER, -- User ID who made the change
  
  -- Core Project Fields (individual columns instead of JSONB)
  project_title TEXT,
  project_description TEXT,
  event_description TEXT,
  status TEXT,
  
  -- Financial Data (individual columns)
  budget_na853 DECIMAL(12,2),
  budget_na271 DECIMAL(12,2),
  budget_e069 DECIMAL(12,2),
  
  -- SA Codes (individual columns)
  na853 TEXT,
  na271 TEXT,
  e069 TEXT,
  
  -- Event Information (individual columns)
  event_type_id INTEGER REFERENCES event_types(id),
  event_year TEXT, -- Can store multiple years as JSON string if needed
  event_name TEXT,
  
  -- Document References (individual columns instead of JSONB)
  protocol_number TEXT,
  fek TEXT,
  ada TEXT,
  budget_decision TEXT,
  funding_decision TEXT,
  ada_import_sana271 TEXT,
  ada_import_sana853 TEXT,
  allocation_decision TEXT,
  
  -- Location Information (individual columns)
  region TEXT,
  regional_unit TEXT,
  municipality TEXT,
  municipal_community TEXT,
  
  -- Implementation (individual columns)
  implementing_agency_id INTEGER REFERENCES "Monada"(id),
  implementing_agency_name TEXT,
  implementing_agency_location TEXT,
  
  -- Additional Fields (individual columns)
  expenses_executed DECIMAL(12,2),
  project_status TEXT,
  enumeration_code TEXT,
  inclusion_year INTEGER,
  summary_description TEXT,
  change_comments TEXT,
  
  -- Expenditure Types (can be JSON array for multiple types)
  expenditure_types JSONB,
  
  -- Previous state for comparison (individual columns)
  previous_status TEXT,
  previous_budget_na853 DECIMAL(12,2),
  previous_budget_na271 DECIMAL(12,2),
  previous_budget_e069 DECIMAL(12,2),
  
  -- Metadata
  previous_entries JSONB, -- Keep for migration compatibility
  formulation_metadata JSONB, -- Keep minimal metadata if needed
  changes_metadata JSONB -- Keep minimal change metadata if needed
);

-- Step 4: Create indexes for better performance
CREATE INDEX idx_project_history_project_id ON project_history(project_id);
CREATE INDEX idx_project_history_created_at ON project_history(created_at);
CREATE INDEX idx_project_history_change_type ON project_history(change_type);
CREATE INDEX idx_project_history_changed_by ON project_history(changed_by);
CREATE INDEX idx_project_history_status ON project_history(status);
CREATE INDEX idx_project_history_event_year ON project_history(event_year);
CREATE INDEX idx_project_history_enumeration_code ON project_history(enumeration_code);

-- Step 5: Grant necessary permissions
GRANT ALL ON project_history TO postgres;
GRANT ALL ON SEQUENCE project_history_id_seq TO postgres;

-- Step 6: Migrate data from backup table to new linear structure
INSERT INTO project_history (
  project_id,
  created_at,
  change_type,
  change_description,
  
  -- Extract core fields from JSONB backup
  project_title,
  project_description,
  event_description,
  status,
  
  -- Extract financial data
  budget_na853,
  budget_na271,
  budget_e069,
  
  -- Extract SA codes
  na853,
  enumeration_code,
  
  -- Extract event info
  event_year,
  event_name,
  
  -- Extract document references from decisions JSONB
  protocol_number,
  fek,
  ada,
  budget_decision,
  funding_decision,
  ada_import_sana271,
  ada_import_sana853,
  allocation_decision,
  
  -- Extract implementation info
  implementing_agency_location,
  
  -- Extract additional fields
  expenses_executed,
  project_status,
  inclusion_year,
  summary_description,
  
  -- Keep some JSONB for compatibility
  expenditure_types,
  previous_entries,
  formulation_metadata,
  changes_metadata
)
SELECT 
  project_id,
  created_at,
  'MIGRATED' as change_type,
  'Migrated from JSONB to linear structure' as change_description,
  
  -- Extract from formulation JSONB
  COALESCE(
    formulation->>'project_title',
    formulation->'project_details'->>'project_title'
  ) as project_title,
  
  COALESCE(
    formulation->>'project_description',
    formulation->'project_details'->>'project_description'
  ) as project_description,
  
  COALESCE(
    formulation->>'event_description',
    implementing_agency_location
  ) as event_description,
  
  COALESCE(
    formulation->'project_details'->>'project_status',
    project_status
  ) as status,
  
  -- Extract financial data
  CASE 
    WHEN formulation->>'budget_na853' ~ '^[0-9.]+$' 
    THEN (formulation->>'budget_na853')::DECIMAL(12,2)
    ELSE expenses_executed
  END as budget_na853,
  
  CASE 
    WHEN formulation->>'budget_na271' ~ '^[0-9.]+$' 
    THEN (formulation->>'budget_na271')::DECIMAL(12,2)
    ELSE NULL
  END as budget_na271,
  
  CASE 
    WHEN formulation->>'budget_e069' ~ '^[0-9.]+$' 
    THEN (formulation->>'budget_e069')::DECIMAL(12,2)
    ELSE NULL
  END as budget_e069,
  
  -- Extract SA codes
  COALESCE(
    formulation->>'na853_code',
    enumeration_code
  ) as na853,
  
  enumeration_code,
  
  -- Extract event info
  COALESCE(
    formulation->'event_details'->>'event_year',
    event_year::TEXT
  ) as event_year,
  
  COALESCE(
    formulation->'event_details'->>'event_name',
    event_name
  ) as event_name,
  
  -- Extract document references from decisions JSONB
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'kya', '[]'::jsonb)) > 0 
    THEN decisions->'kya'->>0 
    ELSE NULL 
  END as protocol_number,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'fek', '[]'::jsonb)) > 0 
    THEN decisions->'fek'->>0 
    ELSE NULL 
  END as fek,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'ada', '[]'::jsonb)) > 0 
    THEN decisions->'ada'->>0 
    ELSE NULL 
  END as ada,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'budget_decision', '[]'::jsonb)) > 0 
    THEN decisions->'budget_decision'->>0 
    ELSE NULL 
  END as budget_decision,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'funding_decision', '[]'::jsonb)) > 0 
    THEN decisions->'funding_decision'->>0 
    ELSE NULL 
  END as funding_decision,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'ada_import_sana271', '[]'::jsonb)) > 0 
    THEN decisions->'ada_import_sana271'->>0 
    ELSE NULL 
  END as ada_import_sana271,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'ada_import_sana853', '[]'::jsonb)) > 0 
    THEN decisions->'ada_import_sana853'->>0 
    ELSE NULL 
  END as ada_import_sana853,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(decisions->'allocation_decision', '[]'::jsonb)) > 0 
    THEN decisions->'allocation_decision'->>0 
    ELSE NULL 
  END as allocation_decision,
  
  -- Implementation info
  implementing_agency_location,
  
  -- Additional fields
  expenses_executed,
  project_status,
  inclusion_year,
  summary_description,
  
  -- Keep some JSONB for compatibility
  expenditure_types,
  previous_entries,
  formulation as formulation_metadata,
  changes as changes_metadata
  
FROM project_history_jsonb_backup;

-- Step 7: Verify migration
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT project_id) as unique_projects,
  COUNT(project_title) as entries_with_title,
  COUNT(protocol_number) as entries_with_protocol,
  SUM(budget_na853) as total_budget_na853
FROM project_history;

-- Step 8: Show sample linear data
SELECT 
  id,
  project_id,
  change_type,
  project_title,
  budget_na853,
  protocol_number,
  status,
  created_at
FROM project_history 
ORDER BY created_at DESC 
LIMIT 3;

-- Optional: Drop backup table after verifying migration
-- DROP TABLE project_history_jsonb_backup;