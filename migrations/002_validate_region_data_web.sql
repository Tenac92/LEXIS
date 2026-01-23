-- =====================================================
-- Migration 002: Validate Region Data Integrity
-- =====================================================
-- Purpose: Audit and report data integrity issues
-- Risk Level: NONE (read-only queries)
-- Date: 2026-01-23
-- =====================================================

SELECT '========================================' as message
UNION ALL SELECT 'Region Data Integrity Audit'
UNION ALL SELECT '========================================';

-- =====================================================
-- TEST 1: Check for orphaned project_index entries
-- =====================================================

SELECT 'TEST 1: Checking for orphaned project_index entries...' as test;

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

SELECT 'TEST 2: Checking for orphaned geographic relationships...' as test;

-- Orphaned region relationships
SELECT 
  'ORPHANED_REGION_RELATION' AS issue_type,
  COUNT(*) AS count
FROM project_index_regions pir
LEFT JOIN project_index pi ON pi.id = pir.project_index_id
WHERE pi.id IS NULL;

-- Orphaned unit relationships
SELECT 
  'ORPHANED_UNIT_RELATION' AS issue_type,
  COUNT(*) AS count
FROM project_index_units piu
LEFT JOIN project_index pi ON pi.id = piu.project_index_id
WHERE pi.id IS NULL;

-- Orphaned municipality relationships
SELECT 
  'ORPHANED_MUNI_RELATION' AS issue_type,
  COUNT(*) AS count
FROM project_index_munis pim
LEFT JOIN project_index pi ON pi.id = pim.project_index_id
WHERE pi.id IS NULL;

-- =====================================================
-- TEST 3: Check for invalid region codes
-- =====================================================

SELECT 'TEST 3: Checking for invalid region codes...' as test;

-- Invalid region codes
SELECT 
  'INVALID_REGION_CODE' AS issue_type,
  COUNT(DISTINCT pir.region_code) AS count,
  ARRAY_AGG(DISTINCT pir.region_code ORDER BY pir.region_code) AS invalid_codes
FROM project_index_regions pir
LEFT JOIN regions r ON r.code = pir.region_code
WHERE r.code IS NULL;

-- Invalid unit codes
SELECT 
  'INVALID_UNIT_CODE' AS issue_type,
  COUNT(DISTINCT piu.unit_code) AS count
FROM project_index_units piu
LEFT JOIN regional_units ru ON ru.code = piu.unit_code
WHERE ru.code IS NULL;

-- Invalid municipality codes
SELECT 
  'INVALID_MUNI_CODE' AS issue_type,
  COUNT(DISTINCT pim.muni_code) AS count
FROM project_index_munis pim
LEFT JOIN municipalities m ON m.code = pim.muni_code
WHERE m.code IS NULL;

-- =====================================================
-- TEST 4: Check if legacy project_catalog table exists
-- =====================================================

SELECT 'TEST 4: Checking legacy project_catalog table...' as test;

SELECT 
  'PROJECT_CATALOG_TABLE' AS issue_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_catalog')
    THEN 'EXISTS (needs migration)'
    ELSE 'Does not exist (OK)'
  END AS status;

-- =====================================================
-- TEST 5: Statistics Summary
-- =====================================================

SELECT 'TEST 5: Statistics Summary...' as test;

SELECT 'Total Projects' AS metric, COUNT(*)::text AS value FROM "Projects"
UNION ALL
SELECT 'Total project_index entries', COUNT(*)::text FROM project_index
UNION ALL
SELECT 'Region assignments', COUNT(*)::text FROM project_index_regions
UNION ALL
SELECT 'Unit assignments', COUNT(*)::text FROM project_index_units
UNION ALL
SELECT 'Municipality assignments', COUNT(*)::text FROM project_index_munis
UNION ALL
SELECT 'Unique regions in use', COUNT(DISTINCT region_code)::text FROM project_index_regions
ORDER BY metric;

SELECT '========================================' as message
UNION ALL SELECT 'Audit Complete'
UNION ALL SELECT 'Review results above for any issues'
UNION ALL SELECT '========================================';
