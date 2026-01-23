# Database Migration Scripts - Region Architecture Refactor

## Overview

This directory contains SQL migration scripts to refactor the region data architecture from a legacy JSONB-based model to a fully normalized, referentially-intact design.

## Migration Timeline

| Migration | Name | Risk | Downtime | Status |
|-----------|------|------|----------|--------|
| 001 | Add Region Indexes | LOW | NONE | ✅ Ready |
| 002 | Validate Region Data | NONE | NONE | ✅ Ready |
| 003 | Add Region Constraints | MEDIUM | LOW | ✅ Ready |
| 004 | Deprecate Legacy Field | LOW | BRIEF | ✅ Ready |
| 005 | Remove Deprecated Field | HIGH | BRIEF | ⏳ Wait 30 days |

## Execution Order

### Phase 1: Immediate (Week 1)

```bash
# 1. Add performance indexes (zero risk)
psql -d lexis_db -f migrations/001_add_region_indexes.sql

# 2. Run data integrity audit
psql -d lexis_db -f migrations/002_validate_region_data.sql > audit_report.txt

# 3. Fix any issues found in audit report (manual)
# Review audit_report.txt and fix data issues

# 4. Add data constraints
psql -d lexis_db -f migrations/003_add_region_constraints.sql
```

### Phase 2: Deprecation (Week 2)

```bash
# IMPORTANT: Update application code first!
# Ensure no code references project_catalog.region

# 5. Deprecate legacy field
psql -d lexis_db -f migrations/004_deprecate_legacy_region_field.sql
```

### Phase 3: Cleanup (After 30 days)

```bash
# CRITICAL: Wait at least 30 days after Phase 2
# Verify no issues reported during waiting period

# 6. Permanently remove deprecated field
psql -d lexis_db -f migrations/005_remove_deprecated_field.sql
```

## Detailed Migration Guide

### Migration 001: Add Region Indexes

**Purpose**: Optimize region-based filtering queries

**What it does**:
- Adds 6 new indexes on junction tables
- Enables fast lookups by region/unit/municipality code
- Uses `CREATE INDEX CONCURRENTLY` for zero downtime

**Expected execution time**: 1-5 minutes (depends on data size)

**How to run**:
```bash
psql -d lexis_db -f migrations/001_add_region_indexes.sql
```

**How to verify**:
```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE indexname LIKE 'idx_pi%';
```

**Rollback** (if needed):
```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_pir_region_code;
DROP INDEX CONCURRENTLY IF EXISTS idx_piu_unit_code;
DROP INDEX CONCURRENTLY IF EXISTS idx_pim_muni_code;
DROP INDEX CONCURRENTLY IF EXISTS idx_pir_composite;
DROP INDEX CONCURRENTLY IF EXISTS idx_piu_composite;
DROP INDEX CONCURRENTLY IF EXISTS idx_pim_composite;
```

---

### Migration 002: Validate Region Data

**Purpose**: Audit data integrity before adding constraints

**What it does**:
- Checks for orphaned records
- Identifies invalid foreign key references
- Reports on legacy field usage
- Generates cleanup scripts if issues found

**Expected execution time**: < 1 minute

**How to run**:
```bash
psql -d lexis_db -f migrations/002_validate_region_data.sql > audit_report.txt
cat audit_report.txt  # Review results
```

**Expected output**:
- 8 test result tables
- Statistics summary
- Cleanup SQL (if issues found)

**Action required**:
- If issues found, run cleanup queries (provided in script)
- Re-run validation until all tests pass

---

### Migration 003: Add Region Constraints

**Purpose**: Enforce data integrity at database level

**What it does**:
- Adds CHECK constraints (positive codes, non-empty names)
- Creates unique indexes on names
- Adds audit logging triggers
- Creates validation functions

**Expected execution time**: < 1 minute

**Prerequisites**:
- Migration 002 must show ZERO issues
- All orphaned data must be cleaned up

**How to run**:
```bash
# Backup first!
pg_dump lexis_db > backup_before_constraints.sql

# Run migration
psql -d lexis_db -f migrations/003_add_region_constraints.sql
```

**How to verify**:
```sql
-- Check constraints were added
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'regions'::regclass;

-- Check audit log is working
SELECT * FROM region_audit_log ORDER BY id DESC LIMIT 5;
```

**Rollback** (see script for full commands):
```sql
-- Drop constraints, triggers, and audit table
-- Full rollback SQL provided in migration script
```

---

### Migration 004: Deprecate Legacy Field

**Purpose**: Rename `project_catalog.region` to `region_deprecated`

**What it does**:
- Audits current usage of JSONB region field
- Renames column to `region_deprecated`
- Adds deprecation warning in comments
- Creates helper view for data migration
- Generates SQL to migrate remaining data

**Expected execution time**: < 1 minute

**Prerequisites**:
- Application code must NOT reference `project_catalog.region`
- Grep codebase for references: `grep -r "project_catalog.*region" .`

**How to run**:
```bash
# Verify no code uses the field
grep -r "project_catalog.*region" server/ client/ shared/

# Run migration
psql -d lexis_db -f migrations/004_deprecate_legacy_region_field.sql
```

**Post-migration tasks**:
1. Review generated migration SQL (if any data needs migrating)
2. Run generated SQL to move legacy data to `project_index_regions`
3. Update schema.ts to remove `region` field:
   ```typescript
   // Remove this line:
   // region: jsonb("region").default({}),
   ```

**Rollback**:
```sql
ALTER TABLE project_catalog RENAME COLUMN region_deprecated TO region;
```

---

### Migration 005: Remove Deprecated Field

**Purpose**: Permanently delete `region_deprecated` column

**⚠️ CRITICAL**: This is irreversible - only run after 30-day verification period

**What it does**:
- Final audit of field usage
- Archives data to audit log
- Permanently drops column
- Vacuums table to reclaim space

**Expected execution time**: 1-5 minutes

**Prerequisites**:
- Wait MINIMUM 30 days after Migration 004
- Zero reported issues during waiting period
- NO code references `region_deprecated`
- FULL database backup

**How to run**:
```bash
# BACKUP FIRST!
pg_dump lexis_db > backup_before_deletion_$(date +%Y%m%d).sql

# Verify backup
psql -d lexis_db -c "SELECT COUNT(*) FROM project_catalog"

# Run migration (will prompt for confirmation)
psql -d lexis_db -f migrations/005_remove_deprecated_field.sql
```

**Rollback**: NOT POSSIBLE - restore from backup

**Data recovery** (if needed after deletion):
```sql
-- Archived data can be retrieved from audit log
SELECT 
  (old_data->>'id')::integer AS id,
  old_data->>'mis' AS mis,
  old_data->'region_deprecated' AS region_data
FROM region_audit_log
WHERE operation = 'ARCHIVE_BEFORE_DROP';
```

---

## Pre-Execution Checklist

Before running ANY migration:

- [ ] Database backup completed
- [ ] Backup verified (test restore)
- [ ] Migrations tested on development environment
- [ ] Team notified of maintenance window (if applicable)
- [ ] Rollback scripts prepared
- [ ] Monitoring dashboard open
- [ ] Database user has necessary privileges

---

## Post-Execution Verification

After each migration:

```sql
-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('regions', 'project_index_regions', 'project_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_pi%'
ORDER BY idx_scan DESC;

-- Check for slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%project_index_regions%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Common Issues & Solutions

### Issue 1: Migration 003 fails with "violates check constraint"

**Cause**: Existing data has negative codes or empty names

**Solution**:
```sql
-- Find problematic records
SELECT * FROM regions WHERE code <= 0;
SELECT * FROM regions WHERE LENGTH(TRIM(name)) = 0;

-- Fix or delete bad records
UPDATE regions SET code = ABS(code) WHERE code < 0;
DELETE FROM regions WHERE LENGTH(TRIM(name)) = 0;

-- Re-run migration
```

### Issue 2: Migration 004 shows populated region fields

**Cause**: Legacy data still exists in `project_catalog.region`

**Solution**:
```sql
-- Use helper view to generate migration SQL
SELECT * FROM project_catalog_region_migration_helper;

-- Run generated INSERT statements
-- Then re-run migration 004
```

### Issue 3: Index creation is slow

**Cause**: Large tables or low maintenance_work_mem

**Solution**:
```sql
-- Increase memory for index building
SET maintenance_work_mem = '2GB';

-- Then re-run migration 001
```

### Issue 4: Cannot drop column in migration 005

**Cause**: Dependent views or functions still reference the column

**Solution**:
```sql
-- Find dependencies
SELECT DISTINCT
  dependent_ns.nspname AS schema,
  dependent_view.relname AS view
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
JOIN pg_namespace AS dependent_ns ON dependent_ns.oid = dependent_view.relnamespace 
WHERE pg_depend.refobjid = 'project_catalog'::regclass;

-- Drop or update dependent objects
-- Then re-run migration
```

---

## Monitoring & Alerts

After migrations, monitor:

1. **Query performance**
   ```sql
   -- Slow queries on geographic tables
   SELECT * FROM pg_stat_activity 
   WHERE query ILIKE '%project_index_regions%' 
     AND state = 'active';
   ```

2. **Index usage**
   ```sql
   -- Unused indexes (consider dropping after 30 days)
   SELECT * FROM pg_stat_user_indexes 
   WHERE idx_scan = 0 
     AND indexrelname LIKE 'idx_pi%';
   ```

3. **Table bloat**
   ```sql
   -- Check for bloat after VACUUM
   SELECT
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
     round(100 * pg_relation_size(schemaname||'.'||tablename) / 
       NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0), 2) AS table_pct
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename = 'project_catalog';
   ```

---

## Success Criteria

After all migrations complete:

- ✅ All 6 region indexes exist and are used by queries
- ✅ Zero orphaned records in junction tables
- ✅ All geographic codes are positive integers
- ✅ All geographic names are non-empty
- ✅ Audit log shows all region changes
- ✅ `project_catalog.region` field removed
- ✅ Application code uses only normalized tables
- ✅ Query performance improved (measure before/after)

---

## Support & Escalation

If migrations fail:

1. **DO NOT PANIC** - check rollback scripts in each migration file
2. **DO NOT PROCEED** to next migration if current one fails
3. **ROLLBACK IMMEDIATELY** and investigate
4. **REVIEW LOGS**: Check PostgreSQL logs for detailed error messages
5. **RESTORE FROM BACKUP** if rollback fails

Contact: Database team / Senior backend engineer

---

## Change Log

| Date | Migration | Author | Notes |
|------|-----------|--------|-------|
| 2026-01-23 | 001-005 | System | Initial migration suite created |

---

## References

- [PostgreSQL CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/trigger-definition.html)
- [Kallikratis Administrative Structure](https://en.wikipedia.org/wiki/Kallikratis_Programme)
- Database Architecture Audit Report (2026-01-23)
