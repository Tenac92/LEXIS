import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
);

async function runMigration() {
  console.log('\n=== Running Migration 014: Employees monada_id FK ===\n');

  const migrationSql = fs.readFileSync(
    './migrations/014_add_employees_monada_id_fk.sql',
    'utf-8',
  );

  let errorCount = 0;

  try {
    console.log('Executing full migration SQL block...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });

    if (error) {
      console.log(`❌ Migration execution failed: ${error.message}`);
      errorCount++;
    } else {
      console.log('✅ Migration executed successfully');
    }
  } catch (err) {
    console.log(`❌ Exception during migration execution: ${err.message}`);
    errorCount++;
  }

  console.log('\n=== Migration Results ===');
  console.log(`❌ Failed: ${errorCount}`);

  console.log('\n=== Verification ===');
  const { data, error } = await supabase
    .from('Employees')
    .select('id, monada, monada_id')
    .limit(10);

  if (error) {
    console.log(`❌ Verification failed: ${error.message}`);
  } else {
    console.log(`✅ Verification sample rows: ${data?.length || 0}`);
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

runMigration().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
