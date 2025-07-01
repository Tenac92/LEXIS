# Linear Project History Migration Guide

This guide will help you migrate the project_history table from complex JSONB structure to a simple linear column-based structure in Supabase.

## What This Migration Does

**Before (Complex JSONB):**
```sql
decisions: {
  "kya": ["ΔΑΕΦΚ-ΚΕ/52548/Α325"],
  "fek": ["962/Β/2022"],
  "ada": [],
  "budget_decision": ["99ΚΧΗ-ΖΣΘ"]
}
formulation: {
  "project_title": "Δωρεάν κρατική αρωγή...",
  "budget_na853": 7357747.94,
  "project_details": {...}
}
```

**After (Simple Linear Columns):**
```sql
protocol_number: "ΔΑΕΦΚ-ΚΕ/52548/Α325"
fek: "962/Β/2022"
ada: NULL
budget_decision: "99ΚΧΗ-ΖΣΘ"
project_title: "Δωρεάν κρατική αρωγή..."
budget_na853: 7357747.94
```

## Steps to Migrate

### 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### 2. Run the Migration SQL
Copy and paste the entire content of `scripts/supabase-linear-schema.sql` into the SQL editor and run it.

The migration will:
1. ✅ Backup your existing data to `project_history_jsonb_backup`
2. ✅ Drop the old JSONB table
3. ✅ Create new linear table with individual columns
4. ✅ Migrate all 195 entries from JSONB to linear format
5. ✅ Create performance indexes
6. ✅ Verify the migration worked

### 3. Verify Migration Success
After running the SQL, you should see output like:
```
total_entries: 195
unique_projects: 195
entries_with_title: 195
entries_with_protocol: 45
total_budget_na853: 967388539.71
```

### 4. Test the New Structure
Run this query to see the new linear structure:
```sql
SELECT 
  project_title,
  budget_na853,
  protocol_number,
  fek,
  status,
  event_year
FROM project_history 
LIMIT 3;
```

## Benefits of Linear Structure

### ✅ Simple Queries
**Old JSONB way:**
```sql
SELECT formulation->>'project_title' FROM project_history;
SELECT decisions->'kya'->>0 FROM project_history;
```

**New Linear way:**
```sql
SELECT project_title FROM project_history;
SELECT protocol_number FROM project_history;
```

### ✅ Better Performance
- Direct column indexes instead of JSONB path indexes
- Standard SQL operations instead of JSON functions
- Faster aggregations and filtering

### ✅ Easier Analysis
```sql
-- Find projects over €1M budget
SELECT * FROM project_history WHERE budget_na853 > 1000000;

-- Count projects by status
SELECT status, COUNT(*) FROM project_history GROUP BY status;

-- Average budget by year
SELECT event_year, AVG(budget_na853) FROM project_history GROUP BY event_year;
```

## New Table Schema

The new `project_history` table has these individual columns:

**Core Fields:**
- `project_title` (TEXT)
- `project_description` (TEXT)
- `event_description` (TEXT)
- `status` (TEXT)

**Financial Data:**
- `budget_na853` (DECIMAL)
- `budget_na271` (DECIMAL)
- `budget_e069` (DECIMAL)

**Document References:**
- `protocol_number` (TEXT)
- `fek` (TEXT)
- `ada` (TEXT)
- `budget_decision` (TEXT)

**Event Information:**
- `event_year` (TEXT)
- `event_name` (TEXT)
- `event_type_id` (INTEGER, FK)

**And many more individual columns...**

## Rollback Plan

If something goes wrong, you can restore from backup:
```sql
DROP TABLE project_history;
ALTER TABLE project_history_jsonb_backup RENAME TO project_history;
```

## Post-Migration

After successful migration:
1. Update your application code to use the new linear column structure
2. Remove any JSONB parsing logic
3. Use direct column access instead of JSON path queries
4. Optionally drop the backup table: `DROP TABLE project_history_jsonb_backup;`

The linear structure will make your project history much easier to work with!