# Migration 006: Budget Integrity Fixes

**Date**: January 23, 2026  
**Purpose**: Fix race conditions, improve data integrity, add audit trail

---

## What This Migration Does

### 1. Foreign Key Constraint
- Links `budget_history.project_id` → `Projects.id`
- Ensures history entries reference valid projects
- Cascades deletes (history removed when project deleted)

### 2. Optimistic Locking
- Adds `version` column to `project_budget`
- Enables detection of concurrent updates
- Alternative to row-level locking

### 3. Atomic Budget Update Function
- `lock_and_update_budget()` - PostgreSQL function
- Uses `SELECT FOR UPDATE` to prevent race conditions
- Validates both `ethsia_pistosi` and `katanomes_etous`
- Handles 2026+ government policy (ethsia_pistosi = 0)

### 4. Budget Audit Log
- New table: `budget_audit_log`
- Records ALL budget changes
- Includes user, timestamp, operation, IP address
- For compliance and debugging

### 5. Data Integrity Constraints
- `CHECK` constraint: `user_view >= 0`
- Prevents negative budget balances

### 6. Reconciliation View
- `budget_reconciliation` view
- Compares recorded vs calculated spending
- Identifies mismatches for manual review

---

## How to Apply

### Option A: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `006_budget_integrity_fixes.sql`
3. Execute
4. Verify success (check for errors)

### Option B: Via psql Command Line
```bash
psql -h <your-host> -U <user> -d <database> -f migrations/006_budget_integrity_fixes.sql
```

### Option C: Via Migration Script
```bash
cd scripts
./run-migrations.ps1
```

---

## Testing

After applying migration, run these tests:

### Test 1: Verify Foreign Key
```sql
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE conname = 'fk_budget_history_project';
```

**Expected**: Should return 1 row showing constraint exists

### Test 2: Verify Function
```sql
SELECT proname FROM pg_proc WHERE proname = 'lock_and_update_budget';
```

**Expected**: Should return `lock_and_update_budget`

### Test 3: Check Budget Mismatches
```sql
SELECT * FROM budget_reconciliation WHERE status = 'MISMATCH';
```

**Expected**: Should show any existing budget inconsistencies (fix manually if found)

### Test 4: Test Locking Function
```sql
-- Replace with actual project_id from your database
SELECT * FROM lock_and_update_budget(
  p_project_id := 1,
  p_amount := 100.00,
  p_document_id := NULL,
  p_user_id := NULL
);
```

**Expected**: Should return success=true with updated budget values

### Test 5: Verify Audit Log Table
```sql
SELECT COUNT(*) FROM budget_audit_log;
```

**Expected**: Should return 0 (empty initially)

---

## Using the New Functions

### In Application Code

Update `storage.ts` to use the new function:

```typescript
async updateProjectBudgetSpending(
  projectId: number, 
  amount: number, 
  documentId: number, 
  userId?: number
): Promise<void> {
  // Use the database function with row locking
  const { data, error } = await supabase.rpc('lock_and_update_budget', {
    p_project_id: projectId,
    p_amount: amount,
    p_document_id: documentId,
    p_user_id: userId || null
  });
  
  if (error) {
    console.error('[Storage] Error updating budget:', error);
    throw new Error(`Budget update failed: ${error.message}`);
  }
  
  const result = data[0];
  
  if (!result.success) {
    throw new Error(`BUDGET_EXCEEDED: ${result.message}`);
  }
  
  console.log(`[Storage] Budget updated successfully:`, {
    new_user_view: result.new_user_view,
    available_budget: result.available_budget,
    yearly_available: result.yearly_available
  });
  
  // Log to audit trail
  await supabase.rpc('log_budget_audit', {
    p_project_id: projectId,
    p_operation: 'document_create',
    p_user_id: userId || null,
    p_old_user_view: result.new_user_view - amount,
    p_new_user_view: result.new_user_view,
    p_document_id: documentId
  });
}
```

---

## Rollback Plan

If issues occur, you can rollback:

```sql
-- Remove audit log
DROP TABLE IF EXISTS budget_audit_log CASCADE;

-- Remove functions
DROP FUNCTION IF EXISTS lock_and_update_budget CASCADE;
DROP FUNCTION IF EXISTS log_budget_audit CASCADE;

-- Remove view
DROP VIEW IF EXISTS budget_reconciliation CASCADE;

-- Remove constraints
ALTER TABLE project_budget DROP CONSTRAINT IF EXISTS chk_user_view_non_negative;
ALTER TABLE budget_history DROP CONSTRAINT IF EXISTS fk_budget_history_project;

-- Remove version column
ALTER TABLE project_budget DROP COLUMN IF EXISTS version;

-- Remove indexes
DROP INDEX IF EXISTS idx_budget_history_project_id;
DROP INDEX IF EXISTS idx_project_budget_version;
DROP INDEX IF EXISTS idx_budget_audit_log_project_id;
DROP INDEX IF EXISTS idx_budget_audit_log_created_at;
DROP INDEX IF EXISTS idx_budget_audit_log_operation;
DROP INDEX IF EXISTS idx_budget_audit_log_user_id;
DROP INDEX IF EXISTS idx_budget_audit_log_document_id;
```

---

## Impact Assessment

### Performance
- **Row locking**: Minimal impact (microseconds per transaction)
- **Foreign keys**: Slight overhead on inserts/deletes (acceptable)
- **Indexes**: Improves query performance
- **Audit log**: Small insert overhead (worth it for compliance)

### Race Conditions
- **Before**: Multiple users could create documents exceeding budget
- **After**: Guaranteed atomic updates, impossible to exceed budget

### Data Integrity
- **Before**: Orphaned history entries, negative balances possible
- **After**: Referential integrity enforced, invalid states prevented

---

## Monitoring

### Check Audit Log Size
```sql
SELECT 
  COUNT(*) as total_entries,
  pg_size_pretty(pg_total_relation_size('budget_audit_log')) as table_size
FROM budget_audit_log;
```

### Check for Budget Mismatches Daily
```sql
SELECT * FROM budget_reconciliation 
WHERE status = 'MISMATCH' 
ORDER BY ABS(difference) DESC;
```

### Monitor Lock Contention
```sql
SELECT * FROM pg_stat_database WHERE datname = current_database();
-- Check: conflicts, deadlocks columns
```

---

## Notes

- Migration is **safe** to run on production (adds only, no data changes)
- Existing budget operations will continue to work during migration
- Row locking function is **optional** - can be adopted gradually
- Audit log is **passive** - doesn't affect existing operations
- Reconciliation view is **read-only** - safe to query anytime

---

**Status**: Ready for deployment  
**Risk Level**: LOW (additive changes only)  
**Estimated Downtime**: None (0 seconds)
