-- =====================================================
-- Migration 005: Remove Deprecated region_deprecated Field
-- =====================================================
-- Purpose: Permanently remove deprecated project_catalog.region_deprecated
-- Risk Level: HIGH (irreversible data deletion)
-- Downtime: BRIEF (table lock during ALTER)
-- Rollback: NONE (must restore from backup)
-- Date: 2026-01-23 (DO NOT RUN BEFORE 2026-03-01)
-- =====================================================
-- CRITICAL PREREQUISITES:
-- 1. Wait at least 30 days after running migration 004
-- 2. Verify NO code references project_catalog.region_deprecated
-- 3. Verify all region data has been migrated to project_index_regions
-- 4. BACKUP database before running
-- 5. Get approval from team lead/DBA
-- =====================================================

\echo '=========================================='
\echo 'WARNING: Permanent Data Deletion'
\echo '=========================================='
\echo 'This migration will PERMANENTLY DELETE the region_deprecated column'
\echo 'from the project_catalog table. This action CANNOT be rolled back.'
\echo ''
\echo 'Press Ctrl+C now if you are not ready to proceed.'
\echo ''
\prompt 'Type YES to continue: ' confirm

-- Verify user confirmation
DO $$
BEGIN
  IF :'confirm' != 'YES' THEN
    RAISE EXCEPTION 'Migration cancelled by user';
  END IF;
END $$;

BEGIN;

-- Verify we're on the correct database
SELECT current_database(), current_user, now() AS migration_start_time;

\echo ''
\echo '=========================================='
\echo 'Removing Deprecated region_deprecated Field'
\echo '=========================================='
\echo ''

-- =====================================================
-- PART 1: Final audit of region_deprecated usage
-- =====================================================

\echo '1. Performing final audit of region_deprecated field...'

DO $$
DECLARE
  populated_count INTEGER;
  last_migration DATE;
BEGIN
  -- Check when migration 004 was run
  SELECT created_at::date INTO last_migration
  FROM region_audit_log
  WHERE table_name = 'project_catalog'
    AND operation = 'UPDATE'
    AND new_data->>'region_deprecated' IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check for populated data
  SELECT COUNT(*) INTO populated_count
  FROM project_catalog
  WHERE region_deprecated IS NOT NULL 
    AND region_deprecated::text != '{}'
    AND region_deprecated::text != 'null';
  
  RAISE NOTICE 'Migration 004 was run on: %', COALESCE(last_migration::text, 'UNKNOWN');
  RAISE NOTICE 'Rows with populated region_deprecated: %', populated_count;
  
  IF populated_count > 0 THEN
    RAISE WARNING '⚠ WARNING: % rows still have populated region_deprecated data', populated_count;
    RAISE EXCEPTION 'Cannot proceed - migrate this data first using migration 004 helper view'
      USING HINT = 'Review project_catalog_region_migration_helper view for migration guidance';
  END IF;
  
  IF last_migration IS NOT NULL AND last_migration > (CURRENT_DATE - INTERVAL '30 days') THEN
    RAISE WARNING '⚠ WARNING: Migration 004 was run only % days ago', (CURRENT_DATE - last_migration);
    RAISE WARNING '⚠ Recommended waiting period is 30 days';
  END IF;
END $$;

-- =====================================================
-- PART 2: Check for code references
-- =====================================================

\echo '2. Checking for database objects that reference region_deprecated...'

-- Check views
SELECT 
  'VIEW' AS object_type,
  schemaname,
  viewname AS object_name,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%region_deprecated%'

UNION ALL

-- Check functions
SELECT 
  'FUNCTION' AS object_type,
  n.nspname AS schemaname,
  p.proname AS object_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%region_deprecated%'

UNION ALL

-- Check triggers
SELECT 
  'TRIGGER' AS object_type,
  'public' AS schemaname,
  t.tgname AS object_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE pg_get_triggerdef(t.oid) ILIKE '%region_deprecated%';

-- If any results, abort
DO $$
DECLARE
  ref_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM (
    SELECT viewname FROM pg_views 
    WHERE schemaname = 'public' AND definition ILIKE '%region_deprecated%'
    UNION ALL
    SELECT p.proname FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE '%region_deprecated%'
  ) refs;
  
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'Cannot proceed - % database objects still reference region_deprecated', ref_count
      USING HINT = 'Update or drop these objects before removing the column';
  END IF;
END $$;

-- =====================================================
-- PART 3: Archive data to audit log (backup)
-- =====================================================

\echo '3. Archiving region_deprecated data to audit log...'

-- Store final state in audit log
INSERT INTO region_audit_log (
  table_name,
  operation,
  record_id,
  old_data,
  changed_by
)
SELECT 
  'project_catalog' AS table_name,
  'ARCHIVE_BEFORE_DROP' AS operation,
  id AS record_id,
  jsonb_build_object(
    'id', id,
    'mis', mis,
    'title', title,
    'region_deprecated', region_deprecated,
    'archived_at', NOW()
  ) AS old_data,
  current_user AS changed_by
FROM project_catalog
WHERE region_deprecated IS NOT NULL;

\echo '✓ Data archived to region_audit_log';

-- =====================================================
-- PART 4: Drop migration helper view
-- =====================================================

\echo '4. Dropping migration helper view...'

DROP VIEW IF EXISTS project_catalog_region_migration_helper CASCADE;

\echo '✓ Helper view dropped';

-- =====================================================
-- PART 5: Remove the deprecated column
-- =====================================================

\echo '5. Removing region_deprecated column...'

-- Final confirmation before point of no return
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POINT OF NO RETURN';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'About to permanently drop region_deprecated column.';
  RAISE NOTICE 'Last chance to cancel (Ctrl+C within 5 seconds)...';
  
  PERFORM pg_sleep(5);
  
  RAISE NOTICE 'Proceeding with column drop...';
END $$;

-- Drop the column
ALTER TABLE project_catalog 
  DROP COLUMN IF EXISTS region_deprecated;

\echo '✓ Column region_deprecated removed';

-- =====================================================
-- PART 6: Vacuum and optimize
-- =====================================================

\echo '6. Optimizing table...'

VACUUM FULL ANALYZE project_catalog;

\echo '✓ Table optimized';

-- =====================================================
-- PART 7: Verify removal
-- =====================================================

\echo '7. Verifying column removal...'

DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'project_catalog' 
      AND column_name = 'region_deprecated'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE EXCEPTION 'ERROR: Column region_deprecated still exists!';
  ELSE
    RAISE NOTICE '✓ SUCCESS: Column region_deprecated has been removed';
  END IF;
END $$;

-- =====================================================
-- PART 8: Record migration completion
-- =====================================================

\echo '8. Recording migration completion...'

INSERT INTO region_audit_log (
  table_name,
  operation,
  record_id,
  new_data,
  changed_by
) VALUES (
  'project_catalog',
  'MIGRATION_005_COMPLETE',
  0,
  jsonb_build_object(
    'migration', 'Remove deprecated region_deprecated field',
    'completed_at', NOW(),
    'completed_by', current_user
  ),
  current_user
);

COMMIT;

\echo ''
\echo '=========================================='
\echo 'Migration 005 Complete'
\echo '=========================================='
\echo ''
\echo 'The region_deprecated column has been permanently removed.'
\echo 'All region data should now be accessed via the normalized model:'
\echo '  - regions table (Περιφέρειες)'
\echo '  - regional_units table (Περιφερειακές Ενότητες)'
\echo '  - municipalities table (Δήμοι)'
\echo '  - project_index_regions junction table'
\echo ''

-- =====================================================
-- ROLLBACK: NOT POSSIBLE - RESTORE FROM BACKUP
-- =====================================================
/*

NO ROLLBACK AVAILABLE

To restore the column, you must:
1. Restore database from backup taken before this migration
2. Re-run migrations 001-004

To recover archived data:
SELECT 
  (old_data->>'id')::integer AS id,
  old_data->>'mis' AS mis,
  old_data->>'title' AS title,
  old_data->'region_deprecated' AS region_data
FROM region_audit_log
WHERE table_name = 'project_catalog'
  AND operation = 'ARCHIVE_BEFORE_DROP'
ORDER BY (old_data->>'id')::integer;

*/
