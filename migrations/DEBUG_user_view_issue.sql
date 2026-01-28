-- Debug Query: Why aren't 2024ΝΑ85300013 documents counting?
-- Documents have project_index_id but user_view is not updating

-- Step 1: Find the project in Projects table
SELECT 
  id AS project_id,
  na853,
  mis
FROM "Projects" 
WHERE na853 = '2024ΝΑ85300013'
LIMIT 1;

-- Step 2: Find the budget record for this project
SELECT 
  pb.id AS budget_id,
  pb.project_id,
  pb.mis,
  pb.na853,
  pb.user_view,
  pb.katanomes_etous,
  pb.ethsia_pistosi,
  pb.current_quarter_spent
FROM project_budget pb
WHERE pb.na853 = '2024ΝΑ85300013' 
   OR pb.mis IN (SELECT mis FROM "Projects" WHERE na853 = '2024ΝΑ85300013')
   OR pb.project_id IN (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013');

-- Step 3: Check if project_id in project_budget matches project ID
SELECT 
  p.id AS projects_table_id,
  pb.project_id AS budget_project_id,
  CASE 
    WHEN p.id = pb.project_id THEN '✅ MATCH'
    ELSE '❌ MISMATCH - THIS IS THE PROBLEM!'
  END AS status
FROM "Projects" p
LEFT JOIN project_budget pb ON pb.na853 = p.na853
WHERE p.na853 = '2024ΝΑ85300013';

-- Step 4: Find all documents for this project
SELECT 
  gd.id,
  gd.project_index_id,
  gd.total_amount,
  gd.status,
  gd.created_at,
  EXTRACT(YEAR FROM gd.created_at) AS doc_year,
  CASE 
    WHEN gd.status IN ('approved', 'pending', 'processed') THEN '✅ Will count'
    ELSE '❌ Wrong status - won''t count'
  END AS will_be_counted
FROM generated_documents gd
WHERE gd.project_index_id IN (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013')
ORDER BY gd.created_at DESC;

-- Step 5: THE KEY QUERY - Check if project_index_id matches project_budget.project_id
SELECT 
  'Documents reference project ID:' AS info,
  gd.project_index_id AS document_points_to,
  pb.project_id AS budget_record_expects,
  CASE 
    WHEN gd.project_index_id = pb.project_id THEN '✅ CORRECT'
    WHEN gd.project_index_id != pb.project_id THEN '❌ MISMATCH - Documents won''t be counted!'
    WHEN pb.project_id IS NULL THEN '❌ Budget has NULL project_id!'
  END AS diagnosis
FROM generated_documents gd
LEFT JOIN project_budget pb ON pb.na853 = '2024ΝΑ85300013'
WHERE gd.project_index_id IN (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013')
LIMIT 1;

-- Step 6: Calculate what user_view SHOULD be
SELECT 
  (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013') AS project_id,
  COUNT(*) AS total_docs_2026,
  COUNT(CASE WHEN status IN ('approved', 'pending', 'processed') THEN 1 END) AS countable_docs,
  SUM(CASE WHEN status IN ('approved', 'pending', 'processed') THEN total_amount ELSE 0 END) AS should_be_user_view,
  (SELECT user_view FROM project_budget WHERE na853 = '2024ΝΑ85300013') AS actual_user_view
FROM generated_documents gd
WHERE gd.project_index_id = (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013')
  AND EXTRACT(YEAR FROM gd.created_at) >= 2026;

-- Step 7: FIX THE ISSUE - Sync project_id in project_budget
UPDATE project_budget pb
SET 
  project_id = (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013'),
  updated_at = NOW()
WHERE pb.na853 = '2024ΝΑ85300013'
  AND (pb.project_id IS NULL OR pb.project_id != (SELECT id FROM "Projects" WHERE na853 = '2024ΝΑ85300013'));

-- Step 8: Recalculate user_view
UPDATE project_budget pb
SET 
  user_view = COALESCE((
    SELECT SUM(gd.total_amount)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ), 0),
  updated_at = NOW()
WHERE pb.na853 = '2024ΝΑ85300013';

-- Step 9: Verify the fix
SELECT 
  pb.project_id,
  pb.na853,
  pb.user_view AS updated_user_view,
  (
    SELECT COUNT(*)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ) AS docs_counted,
  (
    SELECT SUM(total_amount)
    FROM generated_documents gd
    WHERE gd.project_index_id = pb.project_id
      AND gd.status IN ('approved', 'pending', 'processed')
      AND EXTRACT(YEAR FROM gd.created_at) >= 2026
  ) AS calculated_total,
  CASE 
    WHEN pb.user_view = COALESCE((
      SELECT SUM(total_amount)
      FROM generated_documents gd
      WHERE gd.project_index_id = pb.project_id
        AND gd.status IN ('approved', 'pending', 'processed')
        AND EXTRACT(YEAR FROM gd.created_at) >= 2026
    ), 0) THEN '✅ FIXED!'
    ELSE '❌ Still broken'
  END AS status
FROM project_budget pb
WHERE pb.na853 = '2024ΝΑ85300013';
