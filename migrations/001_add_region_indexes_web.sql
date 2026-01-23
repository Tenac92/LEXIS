-- =====================================================
-- Migration 001: Add Missing Region Indexes
-- =====================================================
-- Purpose: Optimize region-based filtering and lookups
-- Risk Level: LOW (read-only indexes, zero data changes)
-- Downtime: NONE (uses CREATE INDEX CONCURRENTLY)
-- Date: 2026-01-23
-- =====================================================

-- Verify we're on the correct database
SELECT current_database(), current_user, now() AS migration_start_time;

-- =====================================================
-- PART 1: Add indexes for junction table lookups
-- =====================================================
-- These indexes enable fast filtering by region/unit/municipality
-- Note: CONCURRENTLY removed for web compatibility

-- Index 1: Region code lookups in project_index_regions
CREATE INDEX IF NOT EXISTS idx_pir_region_code 
  ON project_index_regions(region_code);

COMMENT ON INDEX idx_pir_region_code IS 
  'Enables fast filtering of projects by region code. Added 2026-01-23.';

-- Index 2: Regional unit code lookups
CREATE INDEX IF NOT EXISTS idx_piu_unit_code 
  ON project_index_units(unit_code);

COMMENT ON INDEX idx_piu_unit_code IS 
  'Enables fast filtering of projects by regional unit code. Added 2026-01-23.';

-- Index 3: Municipality code lookups
CREATE INDEX IF NOT EXISTS idx_pim_muni_code 
  ON project_index_munis(muni_code);

COMMENT ON INDEX idx_pim_muni_code IS 
  'Enables fast filtering of projects by municipality code. Added 2026-01-23.';

-- =====================================================
-- PART 2: Add composite indexes for complex queries
-- =====================================================

-- Index 4: Composite index for region-based project lookups
CREATE INDEX IF NOT EXISTS idx_pir_composite 
  ON project_index_regions(region_code, project_index_id);

COMMENT ON INDEX idx_pir_composite IS 
  'Composite index for efficient region-to-project lookups. Added 2026-01-23.';

-- Index 5: Composite index for unit-based project lookups
CREATE INDEX IF NOT EXISTS idx_piu_composite 
  ON project_index_units(unit_code, project_index_id);

COMMENT ON INDEX idx_piu_composite IS 
  'Composite index for efficient unit-to-project lookups. Added 2026-01-23.';

-- Index 6: Composite index for municipality-based project lookups
CREATE INDEX IF NOT EXISTS idx_pim_composite 
  ON project_index_munis(muni_code, project_index_id);

COMMENT ON INDEX idx_pim_composite IS 
  'Composite index for efficient municipality-to-project lookups. Added 2026-01-23.';

-- =====================================================
-- PART 3: Verify index creation
-- =====================================================

DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_pir_region_code',
      'idx_piu_unit_code',
      'idx_pim_muni_code',
      'idx_pir_composite',
      'idx_piu_composite',
      'idx_pim_composite'
    );
  
  IF index_count = 6 THEN
    RAISE NOTICE '✓ SUCCESS: All 6 indexes created successfully';
  ELSE
    RAISE WARNING '⚠ WARNING: Only % of 6 indexes were created', index_count;
  END IF;
END $$;

-- =====================================================
-- PART 4: Display index statistics
-- =====================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(schemaname || '.' || indexname)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexname LIKE 'idx_pi%_region_code'
     OR indexname LIKE 'idx_pi%_unit_code'
     OR indexname LIKE 'idx_pi%_muni_code'
     OR indexname LIKE 'idx_pi%_composite')
ORDER BY tablename, indexname;

-- =====================================================
-- Migration Complete
-- =====================================================
-- To rollback, run:
-- DROP INDEX IF EXISTS idx_pir_region_code;
-- DROP INDEX IF EXISTS idx_piu_unit_code;
-- DROP INDEX IF EXISTS idx_pim_muni_code;
-- DROP INDEX IF EXISTS idx_pir_composite;
-- DROP INDEX IF EXISTS idx_piu_composite;
-- DROP INDEX IF EXISTS idx_pim_composite;
