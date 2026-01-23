# Region Architecture Refactor - Action Plan

## ✅ Completed

- [x] Database audit completed
- [x] Migration SQL files generated (001-005)
- [x] TypeScript code fixes applied
- [x] Region validation utility created
- [x] Documentation written

## 🚀 Next Steps (In Order)

### Phase 1: Database Migrations (Week 1)

#### Step 1: Apply Migration 001 (Safe - Do Now)
**What**: Add performance indexes to region junction tables
**Risk**: None - read-only operation
**Time**: 1-5 minutes

**How to do it:**
1. Go to: https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/sql/new
2. Open file: `migrations/001_add_region_indexes.sql`
3. Copy all content
4. Paste into Supabase SQL Editor
5. Click "Run"
6. Wait for success message

**Expected result:** "✓ SUCCESS: All 6 indexes created successfully"

---

#### Step 2: Apply Migration 002 (Safe - Do Now)
**What**: Audit data integrity (read-only)
**Risk**: None - no changes made
**Time**: < 1 minute

**How to do it:**
1. Same Supabase SQL Editor
2. Open file: `migrations/002_validate_region_data.sql`
3. Copy all content
4. Paste and run
5. **CAREFULLY REVIEW RESULTS**

**Expected results:**
- 8 test result tables showing data quality
- Statistics summary
- If issues found: cleanup SQL provided

**If issues found:**
- Copy the cleanup SQL from results
- Run it in a new query
- Re-run migration 002 until all tests pass

---

#### Step 3: Apply Migration 003 (Medium Risk - After 002 Passes)
**What**: Add CHECK constraints and audit triggers
**Risk**: Medium - will fail if bad data exists
**Time**: < 1 minute

**PREREQUISITES:**
- ✅ Migration 002 must show ZERO issues
- ✅ All orphaned data cleaned up

**How to do it:**
1. Same Supabase SQL Editor
2. Open file: `migrations/003_add_region_constraints.sql`
3. Copy all content
4. Paste and run
5. Verify constraint tests pass

**Expected result:** "✓ All constraint tests passed"

---

### Phase 2: Code Testing (Week 1-2)

#### Step 4: Test the Application

**Run development server:**
```powershell
npm run dev
```

**Test checklist:**
- [ ] Create a new project with region assignment
- [ ] Update an existing project's region
- [ ] Filter projects by region
- [ ] View project details (check region display)
- [ ] Export projects to Excel (check region column)
- [ ] Check browser console for errors

**Expected behavior:**
- No console errors about "region" field
- Geographic data displays correctly
- Filtering works
- No database errors

**If errors occur:**
- Check browser console
- Check server logs
- Verify migrations 001-003 completed successfully

---

#### Step 5: Monitor for Issues (Week 2-4)

**What to monitor:**
- Application errors related to regions
- User reports of missing geographic data
- Query performance (should be faster after indexes)

**Query to check index usage:**
```sql
SELECT 
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_pi%'
ORDER BY idx_scan DESC;
```

Run this in Supabase SQL Editor weekly to verify indexes are being used.

---

### Phase 3: Legacy Field Deprecation (Week 4)

#### Step 6: Apply Migration 004 (After 30 Days Testing)
**What**: Rename `project_catalog.region` to `region_deprecated`
**Risk**: Low - renames field, preserves data
**Time**: < 1 minute

**PREREQUISITES:**
- ✅ 30 days passed since Phase 2
- ✅ No issues reported
- ✅ All code using normalized model

**How to do it:**
1. Verify no code uses `project_catalog.region`:
   ```powershell
   Select-String -Path "server\**\*.ts","client\**\*.ts","shared\**\*.ts" -Pattern "project_catalog.*\.region[^_]"
   ```
   Should return 0 results

2. Run migration in Supabase SQL Editor:
   - Open `migrations/004_deprecate_legacy_region_field.sql`
   - Copy and paste
   - Run

3. Review output for any data that needs migration

**Expected result:** Column renamed, deprecation warning added

---

### Phase 4: Final Cleanup (Week 8+)

#### Step 7: Apply Migration 005 (After Another 30 Days)
**What**: Permanently delete `region_deprecated` column
**Risk**: HIGH - irreversible
**Time**: 1-5 minutes

**⚠️ CRITICAL PREREQUISITES:**
- ✅ 60+ days total testing period
- ✅ Full database backup
- ✅ Team approval
- ✅ No references to `region_deprecated` anywhere

**How to do it:**
1. **BACKUP DATABASE FIRST**
2. Verify backup successful
3. Run migration in Supabase SQL Editor:
   - Open `migrations/005_remove_deprecated_field.sql`
   - Follow interactive prompts
   - Type "YES" when prompted

**Expected result:** Column permanently removed

---

## 📋 Quick Reference Checklist

### Today (Do Now)
- [ ] Run migration 001 (indexes)
- [ ] Run migration 002 (audit)
- [ ] Fix any data issues found
- [ ] Run migration 003 (constraints)
- [ ] Test application
- [ ] Commit changes to Git

### This Week
- [ ] Monitor application for issues
- [ ] Check index usage stats
- [ ] Verify query performance improved

### After 30 Days (Week 4)
- [ ] Verify no issues reported
- [ ] Run migration 004 (deprecate field)
- [ ] Continue monitoring

### After 60 Days (Week 8+)
- [ ] Full database backup
- [ ] Get team approval
- [ ] Run migration 005 (remove field)
- [ ] Celebrate! 🎉

---

## 🔧 Troubleshooting

### Issue: Migration 001 fails
**Cause:** Index already exists
**Solution:** Ignore - indexes are idempotent

### Issue: Migration 002 shows orphaned records
**Cause:** Data integrity issues
**Solution:** Run cleanup SQL provided in output

### Issue: Migration 003 fails with "violates check constraint"
**Cause:** Bad data (negative codes, empty names)
**Solution:** 
```sql
-- Find and fix bad data
SELECT * FROM regions WHERE code <= 0;
UPDATE regions SET code = ABS(code) WHERE code < 0;
DELETE FROM regions WHERE LENGTH(TRIM(name)) = 0;
```

### Issue: Application shows "region is undefined"
**Cause:** Code still referencing old `project_catalog.region` field
**Solution:** Already fixed in this commit - just restart server

### Issue: Regions not displaying in UI
**Cause:** Data not migrated from old JSONB field
**Solution:** Run migration 004 helper view to migrate legacy data

---

## 📊 Success Metrics

After all phases complete, you should see:

1. **Performance Improvement**
   - Region filtering queries 3-10x faster
   - Index hit rate > 90%

2. **Data Integrity**
   - Zero orphaned records
   - All geographic codes valid
   - Audit log tracks all changes

3. **Code Quality**
   - No JSONB region fields
   - All lookups use stable codes
   - TypeScript types aligned with DB

4. **Architecture**
   - Single source of truth (normalized tables)
   - Referential integrity enforced
   - Scalable for future features

---

## 🆘 Need Help?

1. Check `migrations/README.md` for detailed guide
2. Review `scripts/apply-migrations-via-supabase.md` for step-by-step
3. Check Supabase logs: https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/logs
4. Rollback scripts included in each migration file

---

## 🎯 Your Current Status

**You are here:** Ready to run migrations

**Next action:** Go to Supabase SQL Editor and run migration 001

**Direct link:** https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/sql/new
