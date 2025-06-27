import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || '';

console.log('🔧 TESTING SQL CONNECTION');
console.log('=========================\n');

if (!databaseUrl) {
  console.log('❌ DATABASE_URL not configured');
  process.exit(1);
}

// Check if DATABASE_URL points to Supabase or Neon
if (databaseUrl.includes('supabase.co')) {
  console.log('✅ DATABASE_URL points to Supabase');
} else if (databaseUrl.includes('neon.tech')) {
  console.log('⚠️ DATABASE_URL still points to old Neon database');
} else {
  console.log('❓ DATABASE_URL points to unknown database');
}

console.log('🔄 Testing connection...\n');

// Test the connection using psql
const psql = spawn('psql', [databaseUrl, '-c', 'SELECT current_database(), version();'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

psql.stdout.on('data', (data) => {
  output += data.toString();
});

psql.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

psql.on('close', (code) => {
  if (code === 0) {
    console.log('✅ CONNECTION SUCCESSFUL!');
    console.log('Output:', output);
    console.log('\n🎯 SQL execution tool should now work properly');
  } else {
    console.log('❌ CONNECTION FAILED');
    console.log('Error:', errorOutput);
    console.log('\n💡 Please update your DATABASE_URL in Replit Secrets');
  }
});

psql.on('error', (error) => {
  console.log('❌ Failed to start psql:', error.message);
});