/**
 * Run a SQL migration file using the app's database connection
 * Usage: npx tsx scripts/run-sql-file.ts migrations/009_add_batch_id_to_budget_history.sql
 */

import { readFile } from 'fs/promises';
import { supabase } from '../server/config/db';
import { config } from 'dotenv';

config();

async function runSqlFile(filePath: string) {
  try {
    console.log(`📄 Reading SQL file: ${filePath}`);
    const sqlContent = await readFile(filePath, 'utf-8');
    
    // Split by semicolon and filter out comments and empty statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Remove comments
        const lines = s.split('\n');
        const cleanedLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('--');
        });
        return cleanedLines.length > 0 && cleanedLines.join('\n').trim().length > 0;
      });
    
    console.log(`🔄 Executing ${statements.length} SQL statement(s)...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`  ▶ Statement ${i + 1}/${statements.length}`);
        const preview = statement.replace(/\s+/g, ' ').substring(0, 80);
        console.log(`     ${preview}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql_string: statement });
          
          if (error) {
            // If exec_sql doesn't work, the migration might need to be run via Supabase dashboard
            console.error(`  ❌ Error:`, error.message);
            console.error(`\n⚠️  Note: Some migrations require service role privileges.`);
            console.error(`     You may need to run this in the Supabase SQL Editor.`);
            throw error;
          }
          
          console.log(`  ✅ Completed`);
        } catch (error: any) {
          console.error(`  ❌ Error in statement ${i + 1}:`, error.message || error);
          throw error;
        }
      }
    }
    
    console.log(`\n✅ Migration completed successfully!`);
  } catch (err: any) {
    console.error(`\n❌ Failed to run migration:`, err.message || err);
    process.exit(1);
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Usage: npx tsx scripts/run-sql-file.ts <path-to-sql-file>');
  process.exit(1);
}

runSqlFile(filePath);
