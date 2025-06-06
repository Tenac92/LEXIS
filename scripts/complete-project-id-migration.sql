-- Complete Project ID Migration Script
-- This script updates your database schema to use project.id instead of project.mis
-- Based on your CSV data structure

-- Step 1: Update Projects table to match your CSV structure
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

-- Make na853 and event_description the main identifiers
ALTER TABLE public."Projects" 
ADD CONSTRAINT IF NOT EXISTS projects_na853_unique UNIQUE (na853),
ADD CONSTRAINT IF NOT EXISTS projects_event_description_unique UNIQUE (event_description);

-- Step 2: Add project_id columns and update all related tables
-- Budget NA853 Split
ALTER TABLE public.budget_na853_split 
ADD COLUMN IF NOT EXISTS project_id integer;

UPDATE public.budget_na853_split 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_na853_split.mis = p.mis
AND budget_na853_split.project_id IS NULL;

ALTER TABLE public.budget_na853_split 
ADD CONSTRAINT IF NOT EXISTS budget_na853_split_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Budget History
ALTER TABLE public.budget_history 
ADD COLUMN IF NOT EXISTS project_id integer;

UPDATE public.budget_history 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_history.mis = p.mis
AND budget_history.project_id IS NULL;

ALTER TABLE public.budget_history 
ADD CONSTRAINT IF NOT EXISTS budget_history_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Budget Notifications
ALTER TABLE public.budget_notifications 
ADD COLUMN IF NOT EXISTS project_id integer;

UPDATE public.budget_notifications 
SET project_id = p.id 
FROM public."Projects" p 
WHERE budget_notifications.mis = p.mis
AND budget_notifications.project_id IS NULL;

ALTER TABLE public.budget_notifications 
ADD CONSTRAINT IF NOT EXISTS budget_notifications_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Generated Documents
ALTER TABLE public.generated_documents 
ADD COLUMN IF NOT EXISTS project_id integer;

UPDATE public.generated_documents 
SET project_id = p.id 
FROM public."Projects" p 
WHERE generated_documents.mis = p.mis
AND generated_documents.project_id IS NULL;

ALTER TABLE public.generated_documents 
ADD CONSTRAINT IF NOT EXISTS generated_documents_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE CASCADE;

-- Legacy Beneficiary table
ALTER TABLE public."Beneficiary" 
ADD COLUMN IF NOT EXISTS project_id integer;

UPDATE public."Beneficiary" 
SET project_id = p.id 
FROM public."Projects" p 
WHERE "Beneficiary".project = p.mis
AND "Beneficiary".project_id IS NULL;

ALTER TABLE public."Beneficiary" 
ADD CONSTRAINT IF NOT EXISTS beneficiary_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public."Projects"(id) ON DELETE SET NULL;

-- Step 3: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_na853 ON public."Projects"(na853);
CREATE INDEX IF NOT EXISTS idx_projects_event_description ON public."Projects"(event_description);
CREATE INDEX IF NOT EXISTS idx_budget_na853_split_project_id ON public.budget_na853_split(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_project_id ON public.budget_history(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_notifications_project_id ON public.budget_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_project_id ON public.generated_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_project_id ON public."Beneficiary"(project_id);

-- Step 4: Create a view for easy project lookup by any identifier
CREATE OR REPLACE VIEW project_lookup AS
SELECT 
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
  status
FROM public."Projects";

-- Step 5: Create helper function to find project ID by any identifier
CREATE OR REPLACE FUNCTION get_project_id(identifier text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  project_id integer;
BEGIN
  -- Try direct ID lookup
  IF identifier ~ '^\d+$' THEN
    SELECT id INTO project_id FROM public."Projects" WHERE id = identifier::integer;
    IF FOUND THEN
      RETURN project_id;
    END IF;
  END IF;
  
  -- Try NA853 lookup
  SELECT id INTO project_id FROM public."Projects" WHERE na853 = identifier;
  IF FOUND THEN
    RETURN project_id;
  END IF;
  
  -- Try legacy MIS lookup
  IF identifier ~ '^\d+$' THEN
    SELECT id INTO project_id FROM public."Projects" WHERE mis = identifier::integer;
    IF FOUND THEN
      RETURN project_id;
    END IF;
  END IF;
  
  -- Try event description lookup
  SELECT id INTO project_id FROM public."Projects" WHERE event_description = identifier;
  IF FOUND THEN
    RETURN project_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Verification queries
SELECT 'Migration verification:' as status;

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