-- Verify batch_id migration succeeded
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'budget_history' 
AND column_name = 'batch_id';

-- Show statistics
SELECT 
  'Budget History Statistics' as info,
  COUNT(*) as total_entries,
  COUNT(batch_id) as entries_with_batch_id,
  COUNT(*) - COUNT(batch_id) as entries_without_batch_id,
  COUNT(DISTINCT batch_id) as unique_batches
FROM budget_history;
