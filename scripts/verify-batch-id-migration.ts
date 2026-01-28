/**
 * Verify the batch_id migration
 */

import { supabase } from '../server/config/db';
import { config } from 'dotenv';

config();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying batch_id migration...\n');
    
    // Check if batch_id column exists by querying budget_history
    const { data, error } = await supabase
      .from('budget_history')
      .select('batch_id')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying budget_history:', error.message);
      process.exit(1);
    }
    
    console.log('✅ batch_id column exists in budget_history table');
    
    // Get statistics
    const { data: stats, error: statsError } = await supabase
      .from('budget_history')
      .select('batch_id', { count: 'exact' });
    
    if (!statsError) {
      const total = stats?.length || 0;
      const withBatchId = stats?.filter(s => s.batch_id)?.length || 0;
      
      console.log('\n📊 Statistics:');
      console.log(`   Total entries: ${total}`);
      console.log(`   With batch_id: ${withBatchId}`);
      console.log(`   Without batch_id: ${total - withBatchId}`);
    }
    
    console.log('\n✅ Migration verified successfully!');
  } catch (err: any) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verifyMigration();
