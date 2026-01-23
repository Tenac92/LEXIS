-- =====================================================
-- Migration 003: Add Region Data Constraints (WEB)
-- =====================================================
-- Simplified for Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Add constraints to reference tables
-- =====================================================

-- Regions table constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regions_code_positive') THEN
    ALTER TABLE regions ADD CONSTRAINT regions_code_positive CHECK (code > 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regions_name_not_empty') THEN
    ALTER TABLE regions ADD CONSTRAINT regions_name_not_empty CHECK (LENGTH(TRIM(name)) > 0);
  END IF;
END $$;

-- Regional units table constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regional_units_code_positive') THEN
    ALTER TABLE regional_units ADD CONSTRAINT regional_units_code_positive CHECK (code > 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regional_units_name_not_empty') THEN
    ALTER TABLE regional_units ADD CONSTRAINT regional_units_name_not_empty CHECK (LENGTH(TRIM(name)) > 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regional_units_region_code_positive') THEN
    ALTER TABLE regional_units ADD CONSTRAINT regional_units_region_code_positive CHECK (region_code > 0);
  END IF;
END $$;

-- Municipalities table constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'municipalities_code_positive') THEN
    ALTER TABLE municipalities ADD CONSTRAINT municipalities_code_positive CHECK (code > 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'municipalities_name_not_empty') THEN
    ALTER TABLE municipalities ADD CONSTRAINT municipalities_name_not_empty CHECK (LENGTH(TRIM(name)) > 0);
  END IF;
END $$;

-- =====================================================
-- PART 2: Add unique indexes (case-insensitive names)
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS regions_name_unique_lower 
  ON regions (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS regional_units_name_region_unique 
  ON regional_units (region_code, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS municipalities_name_unit_unique 
  ON municipalities (unit_code, LOWER(name));

-- =====================================================
-- PART 3: Create audit log table
-- =====================================================

CREATE TABLE IF NOT EXISTS region_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id BIGINT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT DEFAULT current_user,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 4: Create audit trigger function
-- =====================================================

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

-- =====================================================
-- PART 5: Apply audit triggers
-- =====================================================

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

-- =====================================================
-- PART 6: Verify results
-- =====================================================

SELECT 
  '✅ MIGRATION 003 COMPLETE' as status,
  '' as details
UNION ALL
SELECT '═══════════════════════════════', ''
UNION ALL
SELECT '📋 Constraints Added:', ''
UNION ALL
SELECT '', '  • regions_code_positive'
UNION ALL
SELECT '', '  • regions_name_not_empty'
UNION ALL
SELECT '', '  • regional_units_code_positive'
UNION ALL
SELECT '', '  • regional_units_name_not_empty'
UNION ALL
SELECT '', '  • regional_units_region_code_positive'
UNION ALL
SELECT '', '  • municipalities_code_positive'
UNION ALL
SELECT '', '  • municipalities_name_not_empty'
UNION ALL
SELECT '═══════════════════════════════', ''
UNION ALL
SELECT '🔍 Unique Indexes Added:', ''
UNION ALL
SELECT '', '  • regions_name_unique_lower'
UNION ALL
SELECT '', '  • regional_units_name_region_unique'
UNION ALL
SELECT '', '  • municipalities_name_unit_unique'
UNION ALL
SELECT '═══════════════════════════════', ''
UNION ALL
SELECT '📝 Audit System:', ''
UNION ALL
SELECT '', '  • region_audit_log table created'
UNION ALL
SELECT '', '  • Triggers active on 3 tables'
UNION ALL
SELECT '═══════════════════════════════', ''
UNION ALL
SELECT '✅ Database constraints enforced', '';
