-- ============================================================================
-- Migration: Add Batch ID to Budget History
-- Date: 2026-01-27
-- Purpose: Link related budget history entries from same operation
-- ============================================================================

-- Add batch_id column to budget_history table
-- UUID format allows unique identification across all operations
-- NULL for existing entries (backwards compatible)
ALTER TABLE budget_history 
ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT NULL;

-- Create index for efficient querying by batch_id
-- This enables fast grouping of related entries
CREATE INDEX IF NOT EXISTS idx_budget_history_batch_id 
ON budget_history(batch_id);

-- Add comment to explain the column
COMMENT ON COLUMN budget_history.batch_id IS 
'Groups related budget history entries from the same operation (e.g., Excel import, bulk update). NULL for single operations or legacy data.';

-- Verify the changes
DO $$ 
BEGIN
  -- Check if column was added
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'budget_history' 
    AND column_name = 'batch_id'
  ) THEN
    RAISE NOTICE 'SUCCESS: batch_id column added to budget_history table';
  ELSE
    RAISE EXCEPTION 'FAILED: batch_id column not found in budget_history table';
  END IF;

  -- Check if index was created
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'budget_history' 
    AND indexname = 'idx_budget_history_batch_id'
  ) THEN
    RAISE NOTICE 'SUCCESS: Index idx_budget_history_batch_id created';
  ELSE
    RAISE EXCEPTION 'FAILED: Index idx_budget_history_batch_id not found';
  END IF;
END $$;

-- Show statistics
SELECT 
  'Budget History Statistics' as info,
  COUNT(*) as total_entries,
  COUNT(batch_id) as entries_with_batch_id,
  COUNT(*) - COUNT(batch_id) as entries_without_batch_id,
  COUNT(DISTINCT batch_id) as unique_batches
FROM budget_history;
