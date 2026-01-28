-- Migration: Fix ALL project_id mismatches and recalculate ALL user_view values
-- Date: 2026-01-23
-- Purpose: Ensure all project_budget records are properly linked and user_view is accurate

-- ============================================================================
-- Part 1: Diagnostic - Check for issues across ALL projects
-- ============================================================================

-- Show projects with NULL or mismatched project_id
SELECT 
  pb.id AS budget_id,
  pb.na853,
  pb.mis,
  pb.project_id AS current_project_id,
  p.id AS should_be_project_id,
  pb.user_view AS current_user_view,
  CASE 
    WHEN pb.project_id IS NULL THEN '❌ NULL project_id'
    WHEN pb.project_id != p.id THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END AS status
FROM project_budget pb
LEFT JOIN "Projects" p ON p.na853 = pb.na853
WHERE pb.project_id IS NULL 
   OR pb.project_id != p.id
ORDER BY pb.na853;

-- ============================================================================
-- Part 2: FIX - Sync project_id for ALL projects
-- ============================================================================

-- Update project_id using na853 as the linking field
UPDATE project_budget pb
SET 
  project_id = p.id,
  updated_at = NOW()
FROM "Projects" p
WHERE p.na853 = pb.na853
  AND (pb.project_id IS NULL OR pb.project_id != p.id);

-- ============================================================================
-- Part 3: FIX - Recalculate user_view for ALL projects (2026+ documents only)
-- ============================================================================

UPDATE project_budget pb
SET 
  user_view = COALESCE((
    SELECT SUM(gd.total_amount)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ), 0),
  updated_at = NOW();

-- ============================================================================
-- Part 4: Verification - Show results
-- ============================================================================

-- Summary statistics
SELECT 
  COUNT(*) AS total_projects,
  COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) AS projects_with_id,
  COUNT(CASE WHEN project_id IS NULL THEN 1 END) AS projects_without_id,
  SUM(user_view) AS total_user_view_all_projects
FROM project_budget;

-- Show projects with documents
SELECT 
  pb.na853,
  pb.project_id,
  pb.user_view,
  pb.katanomes_etous,
  (
    SELECT COUNT(*)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ) AS doc_count_2026,
  CASE 
    WHEN pb.user_view = COALESCE((
      SELECT SUM(total_amount)
      FROM generated_documents gd
      WHERE gd.project_index_id = pb.project_id
        AND gd.status IN ('approved', 'pending', 'processed')
        AND EXTRACT(YEAR FROM gd.created_at) >= 2026
    ), 0) THEN '✅ Correct'
    ELSE '❌ Mismatch'
  END AS status
FROM project_budget pb
WHERE EXISTS (
  SELECT 1 
  FROM generated_documents gd
  WHERE gd.project_index_id = pb.project_id
    AND EXTRACT(YEAR FROM gd.created_at) >= 2026
)
ORDER BY pb.na853;

-- Check for any remaining issues
SELECT * FROM budget_reconciliation 
WHERE status = 'MISMATCH' 
ORDER BY ABS(difference) DESC
LIMIT 20;

-- ============================================================================
-- Results Summary
-- ============================================================================
SELECT 
  '✅ Migration 008 Complete' AS message,
  'All project_id values synced' AS step_1,
  'All user_view values recalculated for 2026+ documents' AS step_2,
  'Check budget_reconciliation view for any remaining issues' AS step_3;
