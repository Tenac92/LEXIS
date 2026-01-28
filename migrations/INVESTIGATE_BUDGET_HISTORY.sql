-- ============================================================================
-- BUDGET HISTORY INVESTIGATION QUERIES
-- Purpose: Diagnose potential issues in budget history system
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- 1. CHECK FOR DUPLICATE ENTRIES
-- Symptom: Same project_id, document_id, timestamp, amounts
-- ============================================================================
SELECT 
  'Duplicate Check' as check_type,
  project_id,
  document_id,
  created_at,
  previous_amount,
  new_amount,
  change_type,
  COUNT(*) as duplicate_count
FROM budget_history
GROUP BY project_id, document_id, created_at, previous_amount, new_amount, change_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. CHECK FOR MISSING ENTRIES (Projects with budget but no history)
-- Symptom: project_budget records exist but no corresponding history
-- ============================================================================
SELECT 
  'Missing History' as check_type,
  pb.id as budget_id,
  pb.project_id,
  p.na853,
  p.mis,
  pb.user_view,
  pb.katanomes_etous,
  pb.created_at as budget_created,
  COUNT(bh.id) as history_count
FROM project_budget pb
INNER JOIN "Projects" p ON pb.project_id = p.id
LEFT JOIN budget_history bh ON bh.project_id = pb.project_id
WHERE pb.user_view > 0 OR pb.katanomes_etous > 0
GROUP BY pb.id, pb.project_id, p.na853, p.mis, pb.user_view, pb.katanomes_etous, pb.created_at
HAVING COUNT(bh.id) = 0
ORDER BY pb.user_view DESC
LIMIT 20;

-- ============================================================================
-- 3. CHECK FOR ORDERING ISSUES
-- Symptom: History entries out of chronological order or ID sequence broken
-- ============================================================================
WITH history_with_lag AS (
  SELECT 
    id,
    project_id,
    created_at,
    previous_amount,
    new_amount,
    LAG(new_amount) OVER (PARTITION BY project_id ORDER BY created_at, id) as prev_record_new_amount,
    LAG(created_at) OVER (PARTITION BY project_id ORDER BY created_at, id) as prev_created_at
  FROM budget_history
  WHERE project_id IS NOT NULL
)
SELECT 
  'Ordering Issue' as check_type,
  id,
  project_id,
  created_at,
  prev_created_at,
  previous_amount,
  new_amount,
  prev_record_new_amount
FROM history_with_lag
WHERE 
  -- Check if previous_amount doesn't match the previous record's new_amount
  (prev_record_new_amount IS NOT NULL 
   AND ABS(CAST(previous_amount AS NUMERIC) - CAST(prev_record_new_amount AS NUMERIC)) > 0.01)
  -- OR timestamps are out of order
  OR (prev_created_at IS NOT NULL AND created_at < prev_created_at)
ORDER BY project_id, created_at DESC
LIMIT 50;

-- ============================================================================
-- 4. CHECK CURRENT BUDGET vs LAST HISTORY ENTRY MISMATCH
-- Symptom: project_budget.user_view doesn't match last history entry
-- ============================================================================
WITH latest_history AS (
  SELECT DISTINCT ON (project_id)
    project_id,
    new_amount as last_history_amount,
    created_at as last_history_time,
    change_type as last_change_type
  FROM budget_history
  WHERE project_id IS NOT NULL
  ORDER BY project_id, created_at DESC, id DESC
)
SELECT 
  'Budget Mismatch' as check_type,
  pb.project_id,
  p.na853,
  p.mis,
  pb.user_view as current_user_view,
  pb.katanomes_etous as current_katanomes,
  lh.last_history_amount,
  lh.last_history_time,
  lh.last_change_type,
  (CAST(pb.katanomes_etous AS NUMERIC) - CAST(pb.user_view AS NUMERIC)) as expected_available,
  CAST(lh.last_history_amount AS NUMERIC) as actual_available_from_history,
  ABS((CAST(pb.katanomes_etous AS NUMERIC) - CAST(pb.user_view AS NUMERIC)) - 
      CAST(lh.last_history_amount AS NUMERIC)) as difference
FROM project_budget pb
INNER JOIN "Projects" p ON pb.project_id = p.id
LEFT JOIN latest_history lh ON lh.project_id = pb.project_id
WHERE lh.last_history_amount IS NOT NULL
  AND ABS((CAST(pb.katanomes_etous AS NUMERIC) - CAST(pb.user_view AS NUMERIC)) - 
          CAST(lh.last_history_amount AS NUMERIC)) > 0.01
ORDER BY difference DESC
LIMIT 20;

-- ============================================================================
-- 5. CHECK FOR DOCUMENTS WITH MULTIPLE HISTORY ENTRIES
-- Symptom: Same document_id appears multiple times (should only appear once per project change)
-- ============================================================================
SELECT 
  'Document Multiple Entries' as check_type,
  document_id,
  COUNT(*) as entry_count,
  COUNT(DISTINCT project_id) as distinct_projects,
  string_agg(DISTINCT change_type, ', ') as change_types,
  MIN(created_at) as first_entry,
  MAX(created_at) as last_entry,
  SUM(CAST(new_amount AS NUMERIC) - CAST(previous_amount AS NUMERIC)) as total_budget_change
FROM budget_history
WHERE document_id IS NOT NULL
GROUP BY document_id
HAVING COUNT(*) > 1
ORDER BY entry_count DESC, last_entry DESC
LIMIT 30;

-- ============================================================================
-- 6. CHECK FOR MISSING DOCUMENT REFERENCES
-- Symptom: Documents exist with budget impact but no history entry
-- ============================================================================
SELECT 
  'Missing Document History' as check_type,
  gd.id as document_id,
  gd.protocol_number_input,
  gd.total_amount,
  gd.status,
  gd.created_at as doc_created,
  pi.project_id,
  p.na853,
  COUNT(bh.id) as history_entries
FROM generated_documents gd
INNER JOIN project_index pi ON gd.project_index_id = pi.id
INNER JOIN "Projects" p ON pi.project_id = p.id
LEFT JOIN budget_history bh ON bh.document_id = gd.id AND bh.project_id = pi.project_id
WHERE gd.total_amount > 0
  AND gd.status != 'draft'
  AND gd.created_at > '2026-01-01'  -- Only check recent documents
GROUP BY gd.id, gd.protocol_number_input, gd.total_amount, gd.status, gd.created_at, pi.project_id, p.na853
HAVING COUNT(bh.id) = 0
ORDER BY gd.total_amount DESC, gd.created_at DESC
LIMIT 30;

-- ============================================================================
-- 7. CHECK FOR NEGATIVE TRANSITIONS
-- Symptom: Available budget goes negative (impossible scenario)
-- ============================================================================
SELECT 
  'Negative Budget' as check_type,
  id,
  project_id,
  previous_amount,
  new_amount,
  change_type,
  change_reason,
  document_id,
  created_at
FROM budget_history
WHERE CAST(new_amount AS NUMERIC) < 0
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 8. CHECK FOR HISTORY WITHOUT VALID PROJECTS
-- Symptom: Orphaned history entries (project_id references non-existent project)
-- ============================================================================
SELECT 
  'Orphaned History' as check_type,
  bh.id,
  bh.project_id,
  bh.created_at,
  bh.change_type,
  bh.document_id
FROM budget_history bh
LEFT JOIN "Projects" p ON bh.project_id = p.id
WHERE bh.project_id IS NOT NULL 
  AND p.id IS NULL
ORDER BY bh.created_at DESC
LIMIT 20;

-- ============================================================================
-- 9. CHECK FOR CORRECTION DOCUMENTS (Ορθή Επανάληψη) IMPACT
-- Symptom: Corrections might create duplicate or missing history entries
-- ============================================================================
SELECT 
  'Correction Document Impact' as check_type,
  gd.id as document_id,
  gd.protocol_number_input,
  gd.original_protocol_number,
  gd.is_correction,
  gd.total_amount,
  gd.status,
  pi.project_id,
  p.na853,
  COUNT(bh.id) as history_entries,
  string_agg(bh.change_type, ', ') as change_types
FROM generated_documents gd
INNER JOIN project_index pi ON gd.project_index_id = pi.id
INNER JOIN "Projects" p ON pi.project_id = p.id
LEFT JOIN budget_history bh ON bh.document_id = gd.id
WHERE gd.is_correction = true
  OR gd.original_protocol_number IS NOT NULL
GROUP BY gd.id, gd.protocol_number_input, gd.original_protocol_number, gd.is_correction, 
         gd.total_amount, gd.status, pi.project_id, p.na853
ORDER BY gd.created_at DESC
LIMIT 30;

-- ============================================================================
-- 10. CHECK FOR TIMELINE GAPS
-- Symptom: Large time gaps between consecutive history entries for same project
-- ============================================================================
WITH history_gaps AS (
  SELECT 
    project_id,
    id,
    created_at,
    LAG(created_at) OVER (PARTITION BY project_id ORDER BY created_at, id) as prev_created_at,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY project_id ORDER BY created_at, id))) / 3600 as hours_gap
  FROM budget_history
  WHERE project_id IS NOT NULL
)
SELECT 
  'Timeline Gap' as check_type,
  project_id,
  id,
  created_at,
  prev_created_at,
  ROUND(hours_gap::numeric, 2) as hours_between_entries
FROM history_gaps
WHERE hours_gap IS NOT NULL 
  AND hours_gap < 0  -- Negative gap indicates out-of-order entries
ORDER BY hours_gap ASC
LIMIT 20;

-- ============================================================================
-- 11. SUMMARY STATISTICS
-- ============================================================================
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM budget_history) as total_history_entries,
  (SELECT COUNT(DISTINCT project_id) FROM budget_history WHERE project_id IS NOT NULL) as projects_with_history,
  (SELECT COUNT(*) FROM project_budget WHERE user_view > 0) as budgets_with_spending,
  (SELECT COUNT(*) FROM project_budget) as total_budget_records,
  (SELECT COUNT(*) FROM generated_documents WHERE total_amount > 0 AND status != 'draft') as active_documents,
  (SELECT MIN(created_at) FROM budget_history) as earliest_history,
  (SELECT MAX(created_at) FROM budget_history) as latest_history;
