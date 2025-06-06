-- Migration Script: Switch from MIS to ID for Project References
-- This script updates the database schema to use project.id instead of project.mis
-- IMPORTANT: Run these commands in order and backup your database first!

-- Step 1: Update Projects table structure to match your CSV data
-- Add missing columns from your CSV file
ALTER TABLE public."Projects" 
ADD COLUMN IF NOT EXISTS e069 text,
ADD COLUMN IF NOT EXISTS na271 text,
ADD COLUMN IF NOT EXISTS na853 text,
ADD COLUMN IF NOT EXISTS event_description text,
ADD COLUMN IF NOT EXISTS project_title text,
ADD COLUMN IF NOT EXISTS event_type jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS event_year jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS kya jsonb,
ADD COLUMN IF NOT EXISTS fek jsonb,
ADD COLUMN IF NOT EXISTS ada jsonb,
ADD COLUMN IF NOT EXISTS ada_import_sana271 jsonb,
ADD COLUMN IF NOT EXISTS ada_import_sana853 jsonb,
ADD COLUMN IF NOT EXISTS budget_decision jsonb,
ADD COLUMN IF NOT EXISTS funding_decision jsonb,
ADD COLUMN IF NOT EXISTS allocation_decision jsonb;

-- Make na853 and event_description unique (main user-facing identifiers)
ALTER TABLE public."Projects" 
ADD CONSTRAINT projects_na853_unique UNIQUE (na853),
ADD CONSTRAINT projects_event_description_unique UNIQUE (event_description);

-- Step 2: Add project_id columns to all related tables
-- Budget NA853 Split table
ALTER TABLE public.budget_na853_split 
ADD COLUMN IF NOT EXISTS project_id integer;

-- Update project_id values based on existing mis values
UPDATE public.budget_na853_split 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_na853_split.mis = p.mis;

-- Add foreign key constraint
ALTER TABLE public.budget_na853_split 
ADD CONSTRAINT budget_na853_split_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Step 3: Update Budget History table
ALTER TABLE public.budget_history 
ADD COLUMN IF NOT EXISTS project_id integer;

-- Update project_id values
UPDATE public.budget_history 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_history.mis = p.mis;

-- Add foreign key constraint
ALTER TABLE public.budget_history 
ADD CONSTRAINT budget_history_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Step 4: Update Budget Notifications table
ALTER TABLE public.budget_notifications 
ADD COLUMN IF NOT EXISTS project_id integer;

-- Update project_id values
UPDATE public.budget_notifications 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_notifications.mis = p.mis;

-- Add foreign key constraint
ALTER TABLE public.budget_notifications 
ADD CONSTRAINT budget_notifications_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Step 5: Update Generated Documents table
ALTER TABLE public.generated_documents 
ADD COLUMN IF NOT EXISTS project_id integer;

-- Update project_id values based on existing mis values
UPDATE public.generated_documents 
SET project_id = p.id 
FROM public."Projects" p 
WHERE generated_documents.mis = p.mis;

-- Add foreign key constraint
ALTER TABLE public.generated_documents 
ADD CONSTRAINT generated_documents_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Step 6: Update Legacy Beneficiary table
ALTER TABLE public."Beneficiary" 
ADD COLUMN IF NOT EXISTS project_id integer;

-- Update project_id values based on existing project (mis) values
UPDATE public."Beneficiary" 
SET project_id = p.id 
FROM public."Projects" p 
WHERE "Beneficiary".project = p.mis;

-- Add foreign key constraint
ALTER TABLE public."Beneficiary" 
ADD CONSTRAINT beneficiary_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE SET NULL;

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_na853 ON public."Projects"(na853);
CREATE INDEX IF NOT EXISTS idx_projects_event_description ON public."Projects"(event_description);
CREATE INDEX IF NOT EXISTS idx_budget_na853_split_project_id ON public.budget_na853_split(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_project_id ON public.budget_history(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_notifications_project_id ON public.budget_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_project_id ON public.generated_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_project_id ON public."Beneficiary"(project_id);

-- Step 8: OPTIONAL - After confirming everything works, you can drop the old mis columns
-- CAUTION: Only run these after thorough testing!
-- ALTER TABLE public.budget_na853_split DROP COLUMN IF EXISTS mis;
-- ALTER TABLE public.budget_history DROP COLUMN IF EXISTS mis;
-- ALTER TABLE public.budget_notifications DROP COLUMN IF EXISTS mis;
-- ALTER TABLE public.generated_documents DROP COLUMN IF EXISTS mis;

-- Verification queries to check the migration
-- Run these to verify the migration was successful:

-- Check that all budget records have project_id
SELECT 
  'budget_na853_split' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project_id,
  COUNT(*) - COUNT(project_id) as missing_project_id
FROM public.budget_na853_split
UNION ALL
SELECT 
  'budget_history' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project_id,
  COUNT(*) - COUNT(project_id) as missing_project_id
FROM public.budget_history
UNION ALL
SELECT 
  'budget_notifications' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project_id,
  COUNT(*) - COUNT(project_id) as missing_project_id
FROM public.budget_notifications
UNION ALL
SELECT 
  'generated_documents' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project_id,
  COUNT(*) - COUNT(project_id) as missing_project_id
FROM public.generated_documents;

-- Check project data integrity
SELECT 
  COUNT(*) as total_projects,
  COUNT(DISTINCT id) as unique_ids,
  COUNT(DISTINCT na853) as unique_na853,
  COUNT(DISTINCT event_description) as unique_event_descriptions
FROM public."Projects";