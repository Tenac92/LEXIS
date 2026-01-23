-- =====================================================
-- Migration 003: Add Region Data Constraints
-- =====================================================
-- Purpose: Enforce data integrity at database level
-- Risk Level: MEDIUM (adds constraints, may fail if bad data exists)
-- Downtime: LOW (brief table locks)
-- Rollback: See rollback script below
-- Date: 2026-01-23
-- =====================================================
-- PREREQUISITES:
-- 1. Run migration 002_validate_region_data.sql first
-- 2. Fix any data integrity issues found
-- 3. Backup database before running
-- =====================================================

-- Verify we're on the correct database
SELECT current_database(), current_user, now() AS migration_start_time;

\echo '=========================================='
\echo 'Adding Region Data Constraints'
\echo '=========================================='
\echo ''

BEGIN;

-- =====================================================
-- PART 1: Add constraints to reference tables
-- =====================================================

\echo '1. Adding constraints to regions table...'

-- Ensure region codes are positive
ALTER TABLE regions 
  ADD CONSTRAINT IF NOT EXISTS regions_code_positive 
  CHECK (code > 0);

-- Ensure region names are non-empty
ALTER TABLE regions 
  ADD CONSTRAINT IF NOT EXISTS regions_name_not_empty 
  CHECK (LENGTH(TRIM(name)) > 0);

COMMENT ON CONSTRAINT regions_code_positive ON regions IS 
  'Ensures region codes are positive integers. Added 2026-01-23.';

COMMENT ON CONSTRAINT regions_name_not_empty ON regions IS 
  'Ensures region names are not empty or whitespace-only. Added 2026-01-23.';

COMMIT;

-- Create unique indexes OUTSIDE transaction (can't use CONCURRENTLY inside transaction)
CREATE UNIQUE INDEX IF NOT EXISTS regions_name_unique_lower 
  ON regions (LOWER(name));

BEGIN;

\echo '2. Adding constraints to regional_units table...'

-- Ensure unit codes are positive
ALTER TABLE regional_units 
  ADD CONSTRAINT IF NOT EXISTS regional_units_code_positive 
  CHECK (code > 0);

-- Ensure unit names are non-empty
ALTER TABLE regional_units 
  ADD CONSTRAINT IF NOT EXISTS regional_units_name_not_empty 
  CHECK (LENGTH(TRIM(name)) > 0);

-- Ensure parent region codes are positive
ALTER TABLE regional_units 
  ADD CONSTRAINT IF NOT EXISTS regional_units_region_code_positive 
  CHECK (region_code > 0);

COMMENT ON CONSTRAINT regional_units_code_positive ON regional_units IS 
  'Ensures unit codes are positive integers. Added 2026-01-23.';

COMMIT;

-- Create unique indexes OUTSIDE transaction
CREATE UNIQUE INDEX IF NOT EXISTS regional_units_name_region_unique 
  ON regional_units (region_code, LOWER(name));

BEGIN;

\echo '3. Adding constraints to municipalities table...'

-- Ensure municipality codes are positive
ALTER TABLE municipalities 
  ADD CONSTRAINT IF NOT EXISTS municipalities_code_positive 
  CHECK (code > 0);

-- Ensure municipality names are non-empty
ALTER TABLE municipalities 
  ADD CONSTRAINT IF NOT EXISTS municipalities_name_not_empty 
  CHECK (LENGTH(TRIM(name)) > 0);

-- Ensure parent unit codes are positive
COMMENT ON CONSTRAINT municipalities_code_positive ON municipalities IS 
  'Ensures municipality codes are positive integers. Added 2026-01-23.';

COMMIT;

-- Create unique indexes OUTSIDE transaction
CREATE UNIQUE INDEX IF NOT EXISTS municipalities_name_unit_unique 
  ON municipalities (unit_code, LOWER(name));

BEGIN
  ON municipalities (unit_code, LOWER(name));

COMMENT ON CONSTRAINT municipalities_code_positive ON municipalities IS 
  'Ensures municipality codes are positive integers. Added 2026-01-23.';

-- =====================================================
-- PART 2: Verify foreign key constraints exist
-- =====================================================

\echo '4. Verifying foreign key constraints...'

DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  -- Count foreign key constraints on geographic tables
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN (
      'regional_units',
      'municipalities',
      'project_index_regions',
      'project_index_units',
      'project_index_munis'
    );
  
  IF fk_count >= 8 THEN
    RAISE NOTICE '✓ SUCCESS: Found % foreign key constraints', fk_count;
  ELSE
    RAISE WARNING '⚠ WARNING: Expected at least 8 FK constraints, found %', fk_count;
  END IF;
END $$;

-- =====================================================
-- PART 3: Add triggers for data validation (optional)
-- =====================================================

\echo '5. Creating validation trigger function...'

-- Trigger to prevent deletion of regions in use
CREATE OR REPLACE FUNCTION prevent_region_deletion()
RETURNS TRIGGER AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  -- Check if region is referenced in project_index_regions
  SELECT COUNT(*) INTO usage_count
  FROM project_index_regions
  WHERE region_code = OLD.code;
  
  IF usage_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete region code % ("%") - still referenced by % project(s)', 
      OLD.code, OLD.name, usage_count
      USING HINT = 'Remove all project assignments before deleting this region.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (optional - comment out if you want CASCADE DELETE instead)
-- CREATE TRIGGER regions_prevent_deletion
--   BEFORE DELETE ON regions
--   FOR EACH ROW
--   EXECUTE FUNCTION prevent_region_deletion();

COMMENT ON FUNCTION prevent_region_deletion() IS 
  'Prevents deletion of regions that are still assigned to projects. Added 2026-01-23.';

-- =====================================================
-- PART 4: Add logging trigger for region changes
-- =====================================================

\echo '6. Creating audit logging for region changes...'

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS region_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  record_id BIGINT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT DEFAULT current_user,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_region_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO region_audit_log (table_name, operation, record_id, old_data)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.code, row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO region_audit_log (table_name, operation, record_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.code, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO region_audit_log (table_name, operation, record_id, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.code, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to geographic tables
DROP TRIGGER IF EXISTS regions_audit_trigger ON regions;
CREATE TRIGGER regions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON regions
  FOR EACH ROW EXECUTE FUNCTION audit_region_changes();

DROP TRIGGER IF EXISTS regional_units_audit_trigger ON regional_units;
CREATE TRIGGER regional_units_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON regional_units
  FOR EACH ROW EXECUTE FUNCTION audit_region_changes();

DROP TRIGGER IF EXISTS municipalities_audit_trigger ON municipalities;
CREATE TRIGGER municipalities_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON municipalities
  FOR EACH ROW EXECUTE FUNCTION audit_region_changes();

COMMENT ON TABLE region_audit_log IS 
  'Audit log for all changes to geographic reference tables. Added 2026-01-23.';

-- =====================================================
-- PART 5: Verify all constraints
-- =====================================================

\echo '7. Verifying all constraints...'

SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  CASE 
    WHEN tc.constraint_type = 'CHECK' THEN cc.check_clause
    ELSE NULL
  END AS constraint_definition
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('regions', 'regional_units', 'municipalities')
  AND tc.constraint_name LIKE '%positive%' 
     OR tc.constraint_name LIKE '%not_empty%'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- =====================================================
-- PART 6: Test constraints (optional)
-- =====================================================

\echo '8. Testing constraints (will roll back)...'

DO $$
BEGIN
  -- Test 1: Try to insert region with negative code (should fail)
  BEGIN
    INSERT INTO regions (code, name) VALUES (-1, 'Test Region');
    RAISE EXCEPTION 'TEST FAILED: Negative region code was allowed';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '✓ TEST PASSED: Negative region code rejected';
  END;
  
  -- Test 2: Try to insert region with empty name (should fail)
  BEGIN
    INSERT INTO regions (code, name) VALUES (99999, '   ');
    RAISE EXCEPTION 'TEST FAILED: Empty region name was allowed';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '✓ TEST PASSED: Empty region name rejected';
  END;
  
  RAISE NOTICE '✓ All constraint tests passed';
END $$;

COMMIT;

\echo ''
\echo '=========================================='
\echo 'Migration 003 Complete'
\echo '=========================================='

-- =====================================================
-- ROLLBACK SCRIPT
-- =====================================================
/*

BEGIN;

-- Drop audit triggers
DROP TRIGGER IF EXISTS regions_audit_trigger ON regions;
DROP TRIGGER IF EXISTS regional_units_audit_trigger ON regional_units;
DROP TRIGGER IF EXISTS municipalities_audit_trigger ON municipalities;

-- Drop audit function
DROP FUNCTION IF EXISTS audit_region_changes();

-- Drop validation function
DROP FUNCTION IF EXISTS prevent_region_deletion();

-- Drop audit log table
DROP TABLE IF EXISTS region_audit_log;

-- Drop unique indexes
DROP INDEX IF EXISTS regions_name_unique_lower;
DROP INDEX IF EXISTS regional_units_name_region_unique;
DROP INDEX IF EXISTS municipalities_name_unit_unique;

-- Drop constraints
ALTER TABLE regions DROP CONSTRAINT IF EXISTS regions_code_positive;
ALTER TABLE regions DROP CONSTRAINT IF EXISTS regions_name_not_empty;
ALTER TABLE regional_units DROP CONSTRAINT IF EXISTS regional_units_code_positive;
ALTER TABLE regional_units DROP CONSTRAINT IF EXISTS regional_units_name_not_empty;
ALTER TABLE regional_units DROP CONSTRAINT IF EXISTS regional_units_region_code_positive;
ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_code_positive;
ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_name_not_empty;
ALTER TABLE municipalities DROP CONSTRAINT IF EXISTS municipalities_unit_code_positive;

COMMIT;

*/
