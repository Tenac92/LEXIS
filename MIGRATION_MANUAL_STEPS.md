# Manual Migration Required: Add Metadata Column

The `budget_history.metadata` column needs to be added manually in the Supabase Dashboard.

## Steps to Execute

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard
   - Select your project: `rlzrtiufwxlljrtmpwsr`
   - Navigate to: **SQL Editor** (left sidebar)

2. **Run this SQL:**

```sql
-- Add metadata column to budget_history table
ALTER TABLE budget_history 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_budget_history_metadata 
ON budget_history USING GIN (metadata);

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'budget_history' 
AND column_name = 'metadata';

-- Show sample data
SELECT id, project_id, change_type, metadata, created_at
FROM budget_history
ORDER BY created_at DESC
LIMIT 5;
```

3. **Expected Output:**
   - You should see: `ALTER TABLE` and `CREATE INDEX` successful messages
   - The SELECT query should show the metadata column with type `jsonb` and default `'{}'::jsonb`
   - Sample data should show 5 recent entries with empty `{}` metadata

4. **After Migration:**
   - Restart the dev server: `npm run dev`
   - The error should be resolved

## Why Manual Execution?

The Supabase client doesn't have DDL (Data Definition Language) permissions by default. Schema changes like `ALTER TABLE` require service role or direct SQL Editor access.

## Alternative: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push migrations/010_add_metadata_to_budget_history.sql
```

---

**Status**: ⚠️ Awaiting manual execution  
**File**: migrations/010_add_metadata_to_budget_history.sql  
**Impact**: Phase 1 & 2 features depend on this column
