/**
 * Add metadata column migration
 * Run with: npx tsx scripts/add-metadata-column.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔄 Adding metadata column to budget_history table...\n');
  
  try {
    // Add metadata column
    console.log('1️⃣ Adding metadata column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE budget_history 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;
      `
    });
    
    if (alterError) {
      console.error('❌ Error adding column:', alterError);
      console.log('\n⚠️  Trying alternative method...\n');
      
      // Alternative: Use raw SQL
      const { error: rawError } = await supabase
        .from('budget_history')
        .select('metadata')
        .limit(1);
      
      if (rawError && rawError.message.includes('does not exist')) {
        console.error('❌ Column still does not exist. Please run this SQL manually in Supabase Dashboard:\n');
        console.log('```sql');
        console.log('ALTER TABLE budget_history');
        console.log("ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;");
        console.log('');
        console.log('CREATE INDEX IF NOT EXISTS idx_budget_history_metadata');
        console.log('ON budget_history USING GIN (metadata);');
        console.log('```\n');
        console.log('📍 Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
        process.exit(1);
      } else {
        console.log('✅ Column already exists!');
      }
    } else {
      console.log('✅ Column added successfully');
    }
    
    // Create index
    console.log('2️⃣ Creating GIN index on metadata...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_budget_history_metadata 
        ON budget_history USING GIN (metadata);
      `
    });
    
    if (indexError) {
      console.log('⚠️  Index creation may need manual execution');
    } else {
      console.log('✅ Index created successfully');
    }
    
    // Verify
    console.log('3️⃣ Verifying column exists...');
    const { data, error: verifyError } = await supabase
      .from('budget_history')
      .select('metadata')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      process.exit(1);
    }
    
    console.log('✅ Metadata column verified!\n');
    console.log('✨ Migration complete! You can now restart the server.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
