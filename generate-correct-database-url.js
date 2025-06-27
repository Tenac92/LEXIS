import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 GENERATING CORRECT DATABASE_URL FOR SUPABASE');
console.log('==============================================\n');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing required environment variables');
  console.log('SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✓ Set' : '✗ Missing');
  process.exit(1);
}

// Extract project reference from Supabase URL
// Format: https://rlzrtiufwxlljrtmpwsr.supabase.co
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Generate the correct PostgreSQL connection string for Supabase
// Format: postgresql://postgres:[SERVICE_KEY]@db.[project-ref].supabase.co:5432/postgres
const correctDatabaseUrl = `postgresql://postgres:${supabaseServiceKey}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('📋 CURRENT CONFIGURATION ANALYSIS:');
console.log('----------------------------------');
console.log('Project Reference:', projectRef);
console.log('Supabase URL:', supabaseUrl);
console.log('Service Key Length:', supabaseServiceKey.length, 'characters');
console.log('');

console.log('🎯 CORRECT DATABASE_URL:');
console.log('------------------------');
console.log(correctDatabaseUrl);
console.log('');

console.log('📝 ACTION REQUIRED:');
console.log('------------------');
console.log('1. Go to Replit Secrets in your project');
console.log('2. Update the DATABASE_URL secret with the value above');
console.log('3. This will fix the SQL execution tool');
console.log('');

console.log('🔍 VERIFICATION:');
console.log('After updating, run this command to verify:');
console.log('node test-sql-connection.js');