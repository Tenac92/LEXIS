-- =====================================================
-- Migration 002: Validate Region Data Integrity
-- =====================================================
-- Simplified version with single result set
-- =====================================================

WITH 
-- Test 1: Orphaned project_index entries
orphaned_index AS (
  SELECT COUNT(*) as count
  FROM project_index pi
  LEFT JOIN "Projects" p ON p.id = pi.project_id
  WHERE p.id IS NULL
),
-- Test 2: Orphaned geographic relationships
orphaned_regions AS (
  SELECT COUNT(*) as count
  FROM project_index_regions pir
  LEFT JOIN project_index pi ON pi.id = pir.project_index_id
  WHERE pi.id IS NULL
),
orphaned_units AS (
  SELECT COUNT(*) as count
  FROM project_index_units piu
  LEFT JOIN project_index pi ON pi.id = piu.project_index_id
  WHERE pi.id IS NULL
),
orphaned_munis AS (
  SELECT COUNT(*) as count
  FROM project_index_munis pim
  LEFT JOIN project_index pi ON pi.id = pim.project_index_id
  WHERE pi.id IS NULL
),
-- Test 3: Invalid codes
invalid_regions AS (
  SELECT COUNT(DISTINCT pir.region_code) as count
  FROM project_index_regions pir
  LEFT JOIN regions r ON r.code = pir.region_code
  WHERE r.code IS NULL
),
invalid_units AS (
  SELECT COUNT(DISTINCT piu.unit_code) as count
  FROM project_index_units piu
  LEFT JOIN regional_units ru ON ru.code = piu.unit_code
  WHERE ru.code IS NULL
),
invalid_munis AS (
  SELECT COUNT(DISTINCT pim.muni_code) as count
  FROM project_index_munis pim
  LEFT JOIN municipalities m ON m.code = pim.muni_code
  WHERE m.code IS NULL
),
-- Statistics
stats AS (
  SELECT 
    (SELECT COUNT(*) FROM "Projects") as total_projects,
    (SELECT COUNT(*) FROM project_index) as total_index,
    (SELECT COUNT(*) FROM project_index_regions) as region_assignments,
    (SELECT COUNT(*) FROM project_index_units) as unit_assignments,
    (SELECT COUNT(*) FROM project_index_munis) as muni_assignments,
    (SELECT COUNT(DISTINCT region_code) FROM project_index_regions) as unique_regions
)

-- Display all results in one table
SELECT 
  '📊 DATA INTEGRITY AUDIT RESULTS' as test_category,
  '' as test_name,
  '' as result,
  '' as status

UNION ALL SELECT '═══════════════════════════════════', '', '', ''

UNION ALL SELECT '🔍 ORPHANED RECORDS', '', '', ''
UNION ALL SELECT '', '  Orphaned project_index entries', (SELECT count FROM orphaned_index)::text, 
  CASE WHEN (SELECT count FROM orphaned_index) = 0 THEN '✅ OK' ELSE '❌ NEEDS CLEANUP' END

UNION ALL SELECT '', '  Orphaned region relationships', (SELECT count FROM orphaned_regions)::text,
  CASE WHEN (SELECT count FROM orphaned_regions) = 0 THEN '✅ OK' ELSE '❌ NEEDS CLEANUP' END

UNION ALL SELECT '', '  Orphaned unit relationships', (SELECT count FROM orphaned_units)::text,
  CASE WHEN (SELECT count FROM orphaned_units) = 0 THEN '✅ OK' ELSE '❌ NEEDS CLEANUP' END

UNION ALL SELECT '', '  Orphaned muni relationships', (SELECT count FROM orphaned_munis)::text,
  CASE WHEN (SELECT count FROM orphaned_munis) = 0 THEN '✅ OK' ELSE '❌ NEEDS CLEANUP' END

UNION ALL SELECT '═══════════════════════════════════', '', '', ''

UNION ALL SELECT '🔢 INVALID CODES', '', '', ''
UNION ALL SELECT '', '  Invalid region codes', (SELECT count FROM invalid_regions)::text,
  CASE WHEN (SELECT count FROM invalid_regions) = 0 THEN '✅ OK' ELSE '❌ NEEDS FIX' END

UNION ALL SELECT '', '  Invalid unit codes', (SELECT count FROM invalid_units)::text,
  CASE WHEN (SELECT count FROM invalid_units) = 0 THEN '✅ OK' ELSE '❌ NEEDS FIX' END

UNION ALL SELECT '', '  Invalid muni codes', (SELECT count FROM invalid_munis)::text,
  CASE WHEN (SELECT count FROM invalid_munis) = 0 THEN '✅ OK' ELSE '❌ NEEDS FIX' END

UNION ALL SELECT '═══════════════════════════════════', '', '', ''

UNION ALL SELECT '📈 STATISTICS', '', '', ''
UNION ALL SELECT '', '  Total Projects', (SELECT total_projects FROM stats)::text, '📁'
UNION ALL SELECT '', '  Total project_index entries', (SELECT total_index FROM stats)::text, '🔗'
UNION ALL SELECT '', '  Region assignments', (SELECT region_assignments FROM stats)::text, '🗺️'
UNION ALL SELECT '', '  Unit assignments', (SELECT unit_assignments FROM stats)::text, '📍'
UNION ALL SELECT '', '  Municipality assignments', (SELECT muni_assignments FROM stats)::text, '🏛️'
UNION ALL SELECT '', '  Unique regions in use', (SELECT unique_regions FROM stats)::text, '🌍'

UNION ALL SELECT '═══════════════════════════════════', '', '', ''

UNION ALL SELECT 
  CASE 
    WHEN (SELECT count FROM orphaned_index) + (SELECT count FROM orphaned_regions) + 
         (SELECT count FROM orphaned_units) + (SELECT count FROM orphaned_munis) +
         (SELECT count FROM invalid_regions) + (SELECT count FROM invalid_units) + 
         (SELECT count FROM invalid_munis) = 0
    THEN '✅ ALL CHECKS PASSED - Database is healthy!'
    ELSE '⚠️ ISSUES FOUND - Review results above and run cleanup'
  END, '', '', '';
