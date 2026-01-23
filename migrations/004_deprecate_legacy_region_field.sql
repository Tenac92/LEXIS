-- =====================================================
-- Migration 004: Deprecate Legacy project_catalog.region
-- =====================================================
-- Purpose: Phase out JSONB region field in favor of normalized model
-- Risk Level: LOW (renames field, preserves data)
-- Downtime: BRIEF (table lock during ALTER)
-- Rollback: See rollback script below
-- Date: 2026-01-23
-- =====================================================
-- PREREQUISITES:
-- 1. Ensure all code has been updated to use project_index_regions
-- 2. Verify project_catalog.region is not actively used (run audit below)
-- 3. Backup database before running
-- =====================================================

BEGIN;

-- Verify we're on the correct database
SELECT current_database(), current_user, now() AS migration_start_time;

\echo '=========================================='
\echo 'Deprecating project_catalog.region Field'
\echo '=========================================='
\echo ''

-- =====================================================
-- PART 1: Audit current usage of project_catalog.region
-- =====================================================

\echo '1. Auditing current usage of project_catalog.region...'

DO $$
DECLARE
  total_rows INTEGER;
  non_null_count INTEGER;
  non_empty_count INTEGER;
  populated_count INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE region IS NOT NULL),
    COUNT(*) FILTER (WHERE region::text != '{}'),
    COUNT(*) FILTER (WHERE region::text != '{}' AND region::text != 'null')
  INTO total_rows, non_null_count, non_empty_count, populated_count
  FROM project_catalog;
  
  RAISE NOTICE 'project_catalog statistics:';
  RAISE NOTICE '  Total rows: %', total_rows;
  RAISE NOTICE '  Non-NULL region: %', non_null_count;
  RAISE NOTICE '  Non-empty region: %', non_empty_count;
  RAISE NOTICE '  Populated region: %', populated_count;
  
  IF populated_count > 0 THEN
    RAISE WARNING '⚠ WARNING: % rows have populated region field', populated_count;
    RAISE WARNING '⚠ These values will be preserved in region_deprecated column';
    RAISE WARNING '⚠ Consider migrating this data to project_index_regions before proceeding';
  ELSE
    RAISE NOTICE '✓ No populated region fields found - safe to deprecate';
  END IF;
END $$;

-- =====================================================
-- PART 2: Display sample of populated regions
-- =====================================================

\echo '2. Showing sample of populated region fields (if any)...'

SELECT 
  id,
  mis,
  title,
  region AS region_content,
  jsonb_typeof(region) AS region_type,
  pg_column_size(region) AS region_size_bytes
FROM project_catalog
WHERE region IS NOT NULL 
  AND region::text != '{}'
  AND region::text != 'null'
ORDER BY id
LIMIT 10;

-- =====================================================
-- PART 3: Check if region field is referenced in views
-- =====================================================

\echo '3. Checking for views that reference region field...'

SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%project_catalog%region%'
ORDER BY viewname;

-- =====================================================
-- PART 4: Rename region column to region_deprecated
-- =====================================================

\echo '4. Renaming region column to region_deprecated...'

-- Check if column exists before renaming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'project_catalog' 
      AND column_name = 'region'
  ) THEN
    ALTER TABLE project_catalog 
      RENAME COLUMN region TO region_deprecated;
    RAISE NOTICE '✓ Column renamed: region → region_deprecated';
  ELSE
    RAISE NOTICE '⚠ Column "region" does not exist, skipping rename';
  END IF;
END $$;

-- =====================================================
-- PART 5: Add column comment documenting deprecation
-- =====================================================

\echo '5. Adding deprecation documentation...'

COMMENT ON COLUMN project_catalog.region_deprecated IS 
  'DEPRECATED 2026-01-23: Region data has been migrated to normalized tables (regions, regional_units, municipalities) and linked via project_index_regions junction table. This field is preserved temporarily for data recovery purposes only. Do not use in application code. Scheduled for removal after 2026-03-01.';

-- =====================================================
-- PART 6: Create migration helper view (optional)
-- =====================================================

\echo '6. Creating helper view for data migration (if needed)...'

CREATE OR REPLACE VIEW project_catalog_region_migration_helper AS
SELECT 
  pc.id AS catalog_id,
  pc.mis,
  pc.title,
  pc.region_deprecated,
  
  -- Extract potential region name from JSONB (adapt based on actual structure)
  CASE 
    WHEN jsonb_typeof(pc.region_deprecated) = 'object' THEN
      COALESCE(
        pc.region_deprecated->>'perifereia',
        pc.region_deprecated->>'region',
        pc.region_deprecated->>'name'
      )
    WHEN jsonb_typeof(pc.region_deprecated) = 'string' THEN
      pc.region_deprecated#>>'{}'
    ELSE NULL
  END AS extracted_region_name,
  
  -- Find matching project in Projects table
  p.id AS project_id,
  p.na853,
  
  -- Find matching region code
  r.code AS potential_region_code,
  r.name AS region_name,
  
  -- Check if already migrated
  EXISTS (
    SELECT 1 
    FROM project_index pi
    JOIN project_index_regions pir ON pir.project_index_id = pi.id
    WHERE pi.project_id = p.id
  ) AS already_has_region_assignment
  
FROM project_catalog pc
LEFT JOIN "Projects" p ON p.mis::text = pc.mis::text OR p.na853 = pc.budget_na853
LEFT JOIN regions r ON r.name = COALESCE(
  pc.region_deprecated->>'perifereia',
  pc.region_deprecated->>'region',
  pc.region_deprecated->>'name'
)
WHERE pc.region_deprecated IS NOT NULL
  AND pc.region_deprecated::text != '{}'
  AND pc.region_deprecated::text != 'null'
ORDER BY pc.id;

COMMENT ON VIEW project_catalog_region_migration_helper IS 
  'Helper view to migrate legacy project_catalog.region_deprecated data to project_index_regions. Shows potential matches between old JSONB data and normalized region codes. Added 2026-01-23.';

\echo '✓ Migration helper view created: project_catalog_region_migration_helper';

-- =====================================================
-- PART 7: Create migration script for populated regions
-- =====================================================

\echo '7. Generating migration script for populated regions (if any)...'

DO $$
DECLARE
  migration_sql TEXT;
BEGIN
  -- Generate INSERT statements for regions that need migration
  SELECT STRING_AGG(
    FORMAT(
      E'-- Migrate catalog_id=%s (MIS=%s): "%s" → region_code=%s\n' ||
      'INSERT INTO project_index_regions (project_index_id, region_code)\n' ||
      'SELECT pi.id, %s\n' ||
      'FROM project_index pi\n' ||
      'WHERE pi.project_id = %s\n' ||
      '  AND NOT EXISTS (\n' ||
      '    SELECT 1 FROM project_index_regions pir\n' ||
      '    WHERE pir.project_index_id = pi.id AND pir.region_code = %s\n' ||
      '  );',
      catalog_id, mis, title, potential_region_code,
      potential_region_code, project_id, potential_region_code
    ),
    E'\n\n'
  ) INTO migration_sql
  FROM project_catalog_region_migration_helper
  WHERE project_id IS NOT NULL
    AND potential_region_code IS NOT NULL
    AND NOT already_has_region_assignment;
  
  IF migration_sql IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Generated migration SQL:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '%', migration_sql;
    RAISE NOTICE '';
    RAISE NOTICE 'Copy the above SQL and run it separately to migrate region data.';
  ELSE
    RAISE NOTICE '✓ No region data requires migration';
  END IF;
END $$;

-- =====================================================
-- PART 8: Verify deprecation
-- =====================================================

\echo '8. Verifying column deprecation...'

SELECT 
  table_name,
  column_name,
  data_type,
  col_description('project_catalog'::regclass, ordinal_position) AS column_comment
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_catalog'
  AND column_name = 'region_deprecated';

COMMIT;

\echo ''
\echo '=========================================='
\echo 'Migration 004 Complete'
\echo '=========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Update application code to stop using project_catalog.region_deprecated'
\echo '2. If needed, run migration SQL generated above to migrate existing data'
\echo '3. Wait 30 days for verification period'
\echo '4. Run migration 005_remove_deprecated_field.sql to permanently remove the column'
\echo ''

-- =====================================================
-- ROLLBACK SCRIPT
-- =====================================================
/*

BEGIN;

-- Drop migration helper view
DROP VIEW IF EXISTS project_catalog_region_migration_helper;

-- Remove column comment
COMMENT ON COLUMN project_catalog.region_deprecated IS NULL;

-- Rename column back
ALTER TABLE project_catalog 
  RENAME COLUMN region_deprecated TO region;

COMMIT;

*/
