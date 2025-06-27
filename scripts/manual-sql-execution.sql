-- Manual SQL Execution for Column Removal
-- Execute these commands in Supabase SQL Editor

-- Remove duplicated columns from Projects table
-- These columns are now sourced from project_history table

ALTER TABLE "Projects" DROP COLUMN IF EXISTS "kya";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "fek";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "ada";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "ada_import_sana271";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "ada_import_sana853";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "budget_decision";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "funding_decision";
ALTER TABLE "Projects" DROP COLUMN IF EXISTS "allocation_decision";

-- Verify remaining columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Projects'
ORDER BY ordinal_position;

-- Verify project_history table contains decision data
SELECT 
    project_id,
    CASE 
        WHEN decisions IS NOT NULL AND jsonb_array_length(decisions) > 0 THEN 'Has Decisions'
        ELSE 'No Decisions'
    END as decision_status,
    CASE 
        WHEN formulation IS NOT NULL AND jsonb_array_length(formulation) > 0 THEN 'Has Formulation'
        ELSE 'No Formulation'
    END as formulation_status
FROM project_history
LIMIT 10;