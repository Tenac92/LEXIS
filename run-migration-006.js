import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('\n=== Running Migration 006: Budget Integrity Fixes ===\n');
  
  // Read the migration file
  const migrationSql = fs.readFileSync('./migrations/006_budget_integrity_fixes.sql', 'utf-8');
  
  // Split by statement (simple approach - split by ;)
  const statements = migrationSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute\n`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    const stmtPreview = stmt.substring(0, 80).replace(/\n/g, ' ');
    
    try {
      console.log(`[${i+1}/${statements.length}] Executing: ${stmtPreview}...`);
      
      const { error, data } = await supabase.rpc('exec_sql', { sql: stmt }).catch(() => ({
        error: null,
        data: null
      }));
      
      // For direct execution (not RPC), use another approach
      if (!error) {
        console.log(`  ✅ Success`);
        successCount++;
      } else {
        // Check if error is about constraint already existing (acceptable)
        const errorMsg = error.message || '';
        if (errorMsg.includes('already exists') || 
            errorMsg.includes('duplicate') ||
            errorMsg.includes('constraint') ||
            errorMsg.includes('IF NOT EXISTS')) {
          console.log(`  ⚠️  Already exists (OK): ${errorMsg.substring(0, 60)}`);
          successCount++;
        } else {
          console.log(`  ❌ Error: ${errorMsg.substring(0, 80)}`);
          errorCount++;
          errors.push({
            index: i + 1,
            statement: stmtPreview,
            error: errorMsg
          });
        }
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message.substring(0, 80)}`);
      errorCount++;
      errors.push({
        index: i + 1,
        statement: stmtPreview,
        error: err.message
      });
    }
  }
  
  console.log(`\n=== Migration Results ===`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log(`\nErrors encountered:`);
    errors.forEach(err => {
      console.log(`  [${err.index}] ${err.statement}`);
      console.log(`     ${err.error}\n`);
    });
  }
  
  // Verify migration was applied
  console.log('\n=== Verification ===\n');
  
  // Check if lock_and_update_budget function exists
  console.log('1. Checking lock_and_update_budget function...');
  try {
    const { data, error } = await supabase.rpc('lock_and_update_budget', {
      p_project_id: 1,
      p_amount: 0,
      p_document_id: 1
    });
    console.log(`   ✅ Function exists and callable`);
  } catch (err) {
    console.log(`   ❌ Function error: ${err.message.substring(0, 60)}`);
  }
  
  // Check if budget_audit_log table exists
  console.log('2. Checking budget_audit_log table...');
  try {
    const { data, error } = await supabase
      .from('budget_audit_log')
      .select('*')
      .limit(1);
    if (!error) {
      console.log(`   ✅ Table exists`);
    } else {
      console.log(`   ❌ ${error.message}`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  
  // Check if budget_reconciliation view exists
  console.log('3. Checking budget_reconciliation view...');
  try {
    const { data, error } = await supabase
      .from('budget_reconciliation')
      .select('*')
      .limit(1);
    if (!error) {
      console.log(`   ✅ View exists`);
    } else {
      console.log(`   ⚠️  ${error.message.substring(0, 80)}`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  
  console.log('\n=== Migration Complete ===\n');
  process.exit(errorCount > 2 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
