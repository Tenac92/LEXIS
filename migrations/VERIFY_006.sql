-- Verification Queries for Migration 006
-- Run these to confirm the migration was applied successfully

-- ============================================================================
-- 1. Check Foreign Key Constraint
-- ============================================================================
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table
FROM pg_constraint 
WHERE conname = 'fk_budget_history_project';

-- Expected: 1 row showing budget_history -> Projects

-- ============================================================================
-- 2. Verify Version Column Added
-- ============================================================================
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'project_budget' 
  AND column_name = 'version';

-- Expected: 1 row with integer type, default 0

-- ============================================================================
-- 3. Verify Check Constraint (user_view >= 0)
-- ============================================================================
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'project_budget'::regclass
  AND conname = 'chk_user_view_non_negative';

-- Expected: 1 row with CHECK constraint definition

-- ============================================================================
-- 4. Verify lock_and_update_budget Function Exists
-- ============================================================================
SELECT 
  proname AS function_name,
  pronargs AS num_arguments,
  prorettype::regtype AS return_type,
  pg_get_functiondef(oid) AS function_body
FROM pg_proc 
WHERE proname = 'lock_and_update_budget';

-- Expected: 1 row showing the function definition

-- ============================================================================
-- 5. Verify log_budget_audit Function Exists
-- ============================================================================
SELECT 
  proname AS function_name,
  pronargs AS num_arguments
FROM pg_proc 
WHERE proname = 'log_budget_audit';

-- Expected: 1 row

-- ============================================================================
-- 6. Verify budget_audit_log Table Exists
-- ============================================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'budget_audit_log';

-- Expected: 1 row

-- Check columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'budget_audit_log'
ORDER BY ordinal_position;

-- Expected: 11 columns (id, project_id, operation, user_id, etc.)

-- ============================================================================
-- 7. Verify budget_reconciliation View Exists
-- ============================================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'budget_reconciliation';

-- Expected: 1 row with table_type = 'VIEW'

-- ============================================================================
-- 8. Check for Budget Mismatches (Important!)
-- ============================================================================
SELECT 
  project_id,
  mis,
  na853,
  recorded_user_view,
  calculated_user_view,
  difference,
  status,
  document_count
FROM budget_reconciliation 
WHERE status = 'MISMATCH'
ORDER BY ABS(difference) DESC
LIMIT 20;

-- Expected: Ideally 0 rows. If any rows, these need manual reconciliation.

-- ============================================================================
-- 9. Check Indexes Were Created
-- ============================================================================
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_budget_history_project_id',
  'idx_project_budget_version',
  'idx_budget_audit_log_project_id',
  'idx_budget_audit_log_created_at',
  'idx_budget_audit_log_operation',
  'idx_budget_audit_log_user_id',
  'idx_budget_audit_log_document_id'
)
ORDER BY tablename, indexname;

-- Expected: 7 rows

-- ============================================================================
-- 10. Test the Lock Function (Dry Run)
-- ============================================================================
-- WARNING: This will actually update a budget! 
-- Replace with a real project_id for testing
/*
SELECT * FROM lock_and_update_budget(
  p_project_id := 1,  -- Change this to a real project ID
  p_amount := 0.01,   -- Small test amount
  p_document_id := NULL,
  p_user_id := NULL
);
*/

-- ============================================================================
-- SUMMARY QUERY: Quick Health Check
-- ============================================================================
SELECT 
  'Foreign Key' AS check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_history_project'
  ) THEN '✅ OK' ELSE '❌ MISSING' END AS status
UNION ALL
SELECT 
  'Version Column',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_budget' AND column_name = 'version'
  ) THEN '✅ OK' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'Check Constraint',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_user_view_non_negative'
  ) THEN '✅ OK' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'Lock Function',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'lock_and_update_budget'
  ) THEN '✅ OK' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'Audit Function',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_budget_audit'
  ) THEN '✅ OK' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'Audit Table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_audit_log'
  ) THEN '✅ OK' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'Reconciliation View',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_reconciliation'
  ) THEN '✅ OK' ELSE '❌ MISSING' END;
