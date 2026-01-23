-- Migration: Reset user_view to only count 2026 documents
-- Date: 2026-01-23
-- Purpose: Recalculate user_view to exclude pre-2026 documents per government policy

-- ============================================================================
-- Reset user_view for all projects to count only 2026+ documents
-- ============================================================================

-- Backup current values (optional - for safety)
CREATE TABLE IF NOT EXISTS user_view_backup_pre2026 AS
SELECT id, project_id, mis, na853, user_view, current_quarter_spent, updated_at
FROM project_budget;

-- Recalculate user_view based on 2026+ documents only
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

-- Log the change
COMMENT ON TABLE user_view_backup_pre2026 IS 
'Backup of user_view values before migration 007. Contains pre-2026 document totals.';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Check how many projects were affected
SELECT 
  COUNT(*) AS projects_updated,
  SUM(ABS(backup.user_view - pb.user_view)) AS total_difference
FROM user_view_backup_pre2026 backup
JOIN project_budget pb ON pb.id = backup.id
WHERE ABS(backup.user_view - pb.user_view) > 0.01;

-- Show detailed comparison for affected projects
SELECT 
  pb.project_id,
  pb.mis,
  pb.na853,
  backup.user_view AS old_user_view,
  pb.user_view AS new_user_view_2026_only,
  backup.user_view - pb.user_view AS pre_2026_amount_excluded,
  (
    SELECT COUNT(*)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) < 2026
  ) AS pre_2026_docs_excluded,
  (
    SELECT COUNT(*)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ) AS docs_2026_counted
FROM user_view_backup_pre2026 backup
JOIN project_budget pb ON pb.id = backup.id
WHERE ABS(backup.user_view - pb.user_view) > 0.01
ORDER BY (backup.user_view - pb.user_view) DESC
LIMIT 20;

-- ============================================================================
-- Rollback Plan (if needed)
-- ============================================================================

-- To restore original values:
/*
UPDATE project_budget pb
SET 
  user_view = backup.user_view,
  current_quarter_spent = backup.current_quarter_spent,
  updated_at = backup.updated_at
FROM user_view_backup_pre2026 backup
WHERE pb.id = backup.id;

DROP TABLE user_view_backup_pre2026;
*/
