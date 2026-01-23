-- =====================================================
-- Migration 002: Validate Region Data Integrity
-- =====================================================
-- Purpose: Audit and report data integrity issues
-- Risk Level: NONE (read-only queries)
-- Downtime: NONE
-- Rollback: N/A (no changes made)
-- Date: 2026-01-23
-- =====================================================

-- This is a READ-ONLY audit script
-- It identifies data quality issues that should be fixed
-- before proceeding with further migrations

\echo '=========================================='
\echo 'Region Data Integrity Audit'
\echo 'Date:' `date`
\echo '=========================================='
\echo ''

-- =====================================================
-- TEST 1: Check for orphaned project_index entries
-- =====================================================
\echo '1. Checking for orphaned project_index entries...'

SELECT 
  'ORPHANED_PROJECT_INDEX' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(pi.id ORDER BY pi.id) AS affected_ids
FROM project_index pi
LEFT JOIN "Projects" p ON p.id = pi.project_id
WHERE p.id IS NULL
GROUP BY issue_type;

-- =====================================================
-- TEST 2: Check for orphaned geographic relationships
-- =====================================================
\echo '2. Checking for orphaned geographic relationships...'

-- Orphaned region relationships
SELECT 
  'ORPHANED_REGION_RELATION' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(pir.project_index_id ORDER BY pir.project_index_id) AS affected_ids
FROM project_index_regions pir
LEFT JOIN project_index pi ON pi.id = pir.project_index_id
WHERE pi.id IS NULL;

-- Orphaned unit relationships
SELECT 
  'ORPHANED_UNIT_RELATION' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(piu.project_index_id ORDER BY piu.project_index_id) AS affected_ids
FROM project_index_units piu
LEFT JOIN project_index pi ON pi.id = piu.project_index_id
WHERE pi.id IS NULL;

-- Orphaned municipality relationships
SELECT 
  'ORPHANED_MUNI_RELATION' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(pim.project_index_id ORDER BY pim.project_index_id) AS affected_ids
FROM project_index_munis pim
LEFT JOIN project_index pi ON pi.id = pim.project_index_id
WHERE pi.id IS NULL;

-- =====================================================
-- TEST 3: Check for invalid region codes
-- =====================================================
\echo '3. Checking for invalid region codes...'

-- Invalid region codes in project_index_regions
SELECT 
  'INVALID_REGION_CODE' AS issue_type,
  COUNT(DISTINCT pir.region_code) AS count,
  ARRAY_AGG(DISTINCT pir.region_code ORDER BY pir.region_code) AS invalid_codes
FROM project_index_regions pir
LEFT JOIN regions r ON r.code = pir.region_code
WHERE r.code IS NULL;

-- Invalid unit codes in project_index_units
SELECT 
  'INVALID_UNIT_CODE' AS issue_type,
  COUNT(DISTINCT piu.unit_code) AS count,
  ARRAY_AGG(DISTINCT piu.unit_code ORDER BY piu.unit_code) AS invalid_codes
FROM project_index_units piu
LEFT JOIN regional_units ru ON ru.code = piu.unit_code
WHERE ru.code IS NULL;

-- Invalid municipality codes in project_index_munis
SELECT 
  'INVALID_MUNI_CODE' AS issue_type,
  COUNT(DISTINCT pim.muni_code) AS count,
  ARRAY_AGG(DISTINCT pim.muni_code ORDER BY pim.muni_code) AS invalid_codes
FROM project_index_munis pim
LEFT JOIN municipalities m ON m.code = pim.muni_code
WHERE m.code IS NULL;

-- =====================================================
-- TEST 4: Check for duplicate geographic relationships
-- =====================================================
\echo '4. Checking for duplicate geographic relationships...'

-- Duplicate region assignments (should be prevented by PRIMARY KEY)
SELECT 
  'DUPLICATE_REGION' AS issue_type,
  project_index_id,
  region_code,
  COUNT(*) AS duplicate_count
FROM project_index_regions
GROUP BY project_index_id, region_code
HAVING COUNT(*) > 1;

-- Duplicate unit assignments
SELECT 
  'DUPLICATE_UNIT' AS issue_type,
  project_index_id,
  unit_code,
  COUNT(*) AS duplicate_count
FROM project_index_units
GROUP BY project_index_id, unit_code
HAVING COUNT(*) > 1;

-- Duplicate municipality assignments
SELECT 
  'DUPLICATE_MUNI' AS issue_type,
  project_index_id,
  muni_code,
  COUNT(*) AS duplicate_count
FROM project_index_munis
GROUP BY project_index_id, muni_code
HAVING COUNT(*) > 1;

-- =====================================================
-- TEST 5: Check project_catalog.region usage
-- =====================================================
\echo '5. Checking legacy project_catalog.region field...'

SELECT 
  'PROJECT_CATALOG_REGION_USAGE' AS issue_type,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE region IS NOT NULL) AS non_null_count,
  COUNT(*) FILTER (WHERE region::text != '{}') AS non_empty_count,
  COUNT(*) FILTER (WHERE region::text != '{}' AND region::text != 'null') AS populated_count
FROM project_catalog;

-- Sample of populated region fields
SELECT 
  'PROJECT_CATALOG_REGION_SAMPLE' AS issue_type,
  id,
  mis,
  title,
  region
FROM project_catalog
WHERE region IS NOT NULL 
  AND region::text != '{}'
  AND region::text != 'null'
LIMIT 10;

-- =====================================================
-- TEST 6: Check referential integrity of Kallikratis hierarchy
-- =====================================================
\echo '6. Checking Kallikratis hierarchy integrity...'

-- Regional units without valid parent region
SELECT 
  'INVALID_REGION_IN_UNIT' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(ru.code ORDER BY ru.code) AS affected_unit_codes
FROM regional_units ru
LEFT JOIN regions r ON r.code = ru.region_code
WHERE r.code IS NULL;

-- Municipalities without valid parent regional unit
SELECT 
  'INVALID_UNIT_IN_MUNI' AS issue_type,
  COUNT(*) AS count,
  ARRAY_AGG(m.code ORDER BY m.code) AS affected_muni_codes
FROM municipalities m
LEFT JOIN regional_units ru ON ru.code = m.unit_code
WHERE ru.code IS NULL;

-- =====================================================
-- TEST 7: Check for projects with no geographic assignment
-- =====================================================
\echo '7. Checking for projects without geographic data...'

SELECT 
  'PROJECTS_NO_GEOGRAPHY' AS issue_type,
  COUNT(DISTINCT p.id) AS count,
  ARRAY_AGG(DISTINCT p.id ORDER BY p.id) AS project_ids
FROM "Projects" p
JOIN project_index pi ON pi.project_id = p.id
LEFT JOIN project_index_regions pir ON pir.project_index_id = pi.id
LEFT JOIN project_index_units piu ON piu.project_index_id = pi.id
LEFT JOIN project_index_munis pim ON pim.project_index_id = pi.id
WHERE pir.project_index_id IS NULL
  AND piu.project_index_id IS NULL
  AND pim.project_index_id IS NULL;

-- =====================================================
-- TEST 8: Statistics and summary
-- =====================================================
\echo '8. Generating statistics...'

SELECT 
  'STATISTICS' AS report_type,
  'Total Projects' AS metric,
  COUNT(*) AS value
FROM "Projects"

UNION ALL

SELECT 
  'STATISTICS',
  'Total project_index entries',
  COUNT(*)
FROM project_index

UNION ALL

SELECT 
  'STATISTICS',
  'Region assignments',
  COUNT(*)
FROM project_index_regions

UNION ALL

SELECT 
  'STATISTICS',
  'Unit assignments',
  COUNT(*)
FROM project_index_units

UNION ALL

SELECT 
  'STATISTICS',
  'Municipality assignments',
  COUNT(*)
FROM project_index_munis

UNION ALL

SELECT 
  'STATISTICS',
  'Unique regions in use',
  COUNT(DISTINCT region_code)
FROM project_index_regions

UNION ALL

SELECT 
  'STATISTICS',
  'Unique units in use',
  COUNT(DISTINCT unit_code)
FROM project_index_units

UNION ALL

SELECT 
  'STATISTICS',
  'Unique municipalities in use',
  COUNT(DISTINCT muni_code)
FROM project_index_munis

ORDER BY metric;

-- =====================================================
-- CLEANUP SCRIPT (if issues found)
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'If issues were found, use these cleanup queries:'
\echo '=========================================='

/*

-- Delete orphaned project_index entries
-- DELETE FROM project_index pi
-- WHERE NOT EXISTS (
--   SELECT 1 FROM "Projects" p WHERE p.id = pi.project_id
-- );

-- Delete orphaned region relationships
-- DELETE FROM project_index_regions pir
-- WHERE NOT EXISTS (
--   SELECT 1 FROM project_index pi WHERE pi.id = pir.project_index_id
-- );

-- Delete orphaned unit relationships
-- DELETE FROM project_index_units piu
-- WHERE NOT EXISTS (
--   SELECT 1 FROM project_index pi WHERE pi.id = piu.project_index_id
-- );

-- Delete orphaned municipality relationships
-- DELETE FROM project_index_munis pim
-- WHERE NOT EXISTS (
--   SELECT 1 FROM project_index pi WHERE pi.id = pim.project_index_id
-- );

-- Delete invalid region code references
-- DELETE FROM project_index_regions pir
-- WHERE NOT EXISTS (
--   SELECT 1 FROM regions r WHERE r.code = pir.region_code
-- );

-- Delete invalid unit code references
-- DELETE FROM project_index_units piu
-- WHERE NOT EXISTS (
--   SELECT 1 FROM regional_units ru WHERE ru.code = piu.unit_code
-- );

-- Delete invalid municipality code references
-- DELETE FROM project_index_munis pim
-- WHERE NOT EXISTS (
--   SELECT 1 FROM municipalities m WHERE m.code = pim.muni_code
-- );

*/

\echo ''
\echo 'Audit complete. Review results above.'
