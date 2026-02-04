-- ============================================================================
-- Migration: Add Metadata JSONB Column to Budget History
-- Date: 2026-01-28
-- Purpose: Store additional context (document amounts, batch info, sequence, audit flags)
-- ============================================================================

-- Add metadata column to budget_history table
-- JSONB format allows flexible storage of structured data
-- Default to empty object for new entries
ALTER TABLE budget_history 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Create GIN index for efficient JSONB queries
-- Enables fast filtering and searching within metadata
CREATE INDEX IF NOT EXISTS idx_budget_history_metadata 
ON budget_history USING GIN (metadata);

-- Add comment to explain the column
COMMENT ON COLUMN budget_history.metadata IS 
'Flexible JSONB storage for additional context: document_amount, available_before, available_after, batch_info, sequence_in_batch, retroactive_flag, audit_warning, etc.';

-- Verify the changes
DO $$ 
BEGIN
  -- Check if column was added
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'budget_history' 
    AND column_name = 'metadata'
  ) THEN
    RAISE NOTICE 'SUCCESS: metadata column added to budget_history table';
  ELSE
    RAISE EXCEPTION 'FAILED: metadata column not found in budget_history table';
  END IF;

  -- Check if index was created
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'budget_history' 
    AND indexname = 'idx_budget_history_metadata'
  ) THEN
    RAISE NOTICE 'SUCCESS: Index idx_budget_history_metadata created';
  ELSE
    RAISE EXCEPTION 'FAILED: Index idx_budget_history_metadata not found';
  END IF;
END $$;

-- Show sample of existing data
SELECT 
  id, 
  project_id, 
  change_type,
  metadata,
  created_at
FROM budget_history
ORDER BY created_at DESC
LIMIT 5;

-- Count rows with non-empty metadata
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN metadata != '{}'::JSONB THEN 1 END) as entries_with_metadata,
  COUNT(CASE WHEN metadata = '{}'::JSONB THEN 1 END) as entries_without_metadata
FROM budget_history;
