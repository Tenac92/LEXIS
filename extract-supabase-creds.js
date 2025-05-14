/**
 * Extract Supabase credentials from DATABASE_URL
 * 
 * This script extracts Supabase URL and key from the DATABASE_URL environment variable
 * and sets them as SUPABASE_URL and SUPABASE_KEY environment variables.
 */

// Parse the DATABASE_URL to extract Supabase credentials
function extractSupabaseCredentials(databaseUrl) {
  try {
    console.log('Extracting Supabase credentials from DATABASE_URL...');
    
    // Parse PostgreSQL URL format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    const urlPattern = /postgresql:\/\/postgres:(.+)@db\.(.+)\.supabase\.co/;
    const matches = databaseUrl.match(urlPattern);
    
    if (!matches || matches.length < 3) {
      throw new Error('Invalid DATABASE_URL format for Supabase');
    }
    
    const supabaseKey = matches[1]; // Password is the Supabase key
    const projectRef = matches[2]; // Project reference is part of the hostname
    const supabaseUrl = `https://${projectRef}.supabase.co`;
    
    return { supabaseUrl, supabaseKey };
  } catch (error) {
    console.error('Failed to extract Supabase credentials:', error);
    return { supabaseUrl: null, supabaseKey: null };
  }
}

// Get the DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

// Extract credentials and set environment variables
const { supabaseUrl, supabaseKey } = extractSupabaseCredentials(databaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error('Failed to extract valid Supabase credentials');
  process.exit(1);
}

// Set environment variables
process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_KEY = supabaseKey;

console.log('Supabase credentials extracted successfully:');
console.log(`SUPABASE_URL: ${supabaseUrl}`);
const maskedKey = supabaseKey.substring(0, 4) + '...' + supabaseKey.substring(supabaseKey.length - 4);
console.log(`SUPABASE_KEY: ${maskedKey} (masked for security)`);

// Export for use in other modules
module.exports = { supabaseUrl, supabaseKey };