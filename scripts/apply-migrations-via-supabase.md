# Apply Migrations via Supabase Dashboard

Since you don't have `psql` installed, use the Supabase SQL Editor instead.

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/sql/new

### 2. Run Migration 001 (Add Indexes)

1. Open `migrations/001_add_region_indexes.sql`
2. Copy the entire file content
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Wait for completion (~1-5 minutes)
6. Verify success message appears

### 3. Run Migration 002 (Validate Data)

1. Open `migrations/002_validate_region_data.sql`
2. Copy the entire file content
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Review the audit results
6. **IMPORTANT**: If any issues are found, fix them before proceeding

### 4. Fix Any Data Issues (if needed)

If migration 002 reports issues, you'll see cleanup SQL in the output. Copy and run it.

### 5. Run Migration 003 (Add Constraints)

**Only after migration 002 shows ZERO issues:**

1. Open `migrations/003_add_region_constraints.sql`
2. Copy the entire file content
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Verify constraints were added

## Quick Links

- **SQL Editor**: https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/sql/new
- **Table Editor** (verify changes): https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/editor
- **Logs** (if errors occur): https://supabase.com/dashboard/project/rlzrtiufwxlljrtmpwsr/logs

## What to Do After Migrations

After successfully running migrations 001-003:

1. Update TypeScript code (see next section in main task list)
2. Test the application
3. Wait 30 days before running migration 004
