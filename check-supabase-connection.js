/**
 * Supabase Connection Diagnostic Tool
 * This script performs detailed diagnostics on your Supabase connection
 * 
 * Run with: node check-supabase-connection.js
 */

// Required dependencies
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns').promises;

// Load environment variables if needed
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not available, using environment variables as is');
}

// ANSI color codes for better output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper for formatted output
function log(type, message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] [${type}]${colors.reset} ${message}`);
}

// Test network connectivity to a domain
async function testDomainConnectivity(domain, port = 443) {
  log('Network', `Testing connectivity to ${domain}:${port}...`, colors.blue);
  
  try {
    // First, try to resolve DNS
    log('Network', `Looking up DNS for ${domain}...`, colors.blue);
    const addresses = await dns.resolve4(domain);
    log('Network', `DNS resolved: ${addresses.join(', ')}`, colors.green);
    
    // Then try to open a connection
    return new Promise((resolve) => {
      const req = https.request({
        hostname: domain,
        port: port,
        path: '/',
        method: 'HEAD',
        timeout: 5000
      }, (res) => {
        log('Network', `Connection to ${domain}:${port} successful (HTTP ${res.statusCode})`, colors.green);
        resolve(true);
      });
      
      req.on('timeout', () => {
        log('Network', `Connection to ${domain}:${port} timed out`, colors.red);
        req.destroy();
        resolve(false);
      });
      
      req.on('error', (err) => {
        log('Network', `Error connecting to ${domain}:${port}: ${err.message}`, colors.red);
        resolve(false);
      });
      
      req.end();
    });
  } catch (error) {
    log('Network', `DNS lookup failed for ${domain}: ${error.message}`, colors.red);
    return false;
  }
}

// Test environment variables
function checkEnvironmentVariables() {
  log('Config', 'Checking Supabase environment variables...', colors.blue);
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    log('Config', 'ERROR: SUPABASE_URL environment variable is not set', colors.red);
    return false;
  }
  
  if (!supabaseKey) {
    log('Config', 'ERROR: Neither SUPABASE_KEY nor SUPABASE_ANON_KEY environment variables are set', colors.red);
    return false;
  }
  
  log('Config', `SUPABASE_URL found: ${supabaseUrl}`, colors.green);
  log('Config', `SUPABASE_KEY found: ${supabaseKey.substring(0, 8)}...`, colors.green);
  
  return { supabaseUrl, supabaseKey };
}

// Test Supabase API
async function testSupabaseAPI(supabaseUrl, supabaseKey) {
  log('Supabase', 'Testing Supabase API access...', colors.blue);
  
  // Extract the domain from the Supabase URL
  let domain;
  try {
    domain = new URL(supabaseUrl).hostname;
    log('Supabase', `Extracted domain: ${domain}`, colors.blue);
  } catch (error) {
    log('Supabase', `Invalid Supabase URL format: ${error.message}`, colors.red);
    return false;
  }
  
  // Test domain connectivity first
  const canConnect = await testDomainConnectivity(domain);
  if (!canConnect) {
    log('Supabase', `Cannot connect to Supabase domain: ${domain}`, colors.red);
    log('Supabase', 'This could be due to network restrictions, firewall rules, or DNS issues', colors.yellow);
    return false;
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  
  log('Supabase', 'Supabase client initialized, testing authentication...', colors.blue);
  
  try {
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      log('Supabase', `Auth error: ${authError.message}`, colors.red);
    } else {
      log('Supabase', 'Auth endpoint accessible', colors.green);
    }
  } catch (error) {
    log('Supabase', `Auth test exception: ${error.message}`, colors.red);
  }
  
  log('Supabase', 'Testing database access...', colors.blue);
  
  try {
    // Testing a simple query to 'users' table
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      log('Supabase', `Database error: ${usersError.message}`, colors.red);
      if (usersError.code) {
        log('Supabase', `Error code: ${usersError.code}`, colors.red);
      }
      if (usersError.details) {
        log('Supabase', `Error details: ${usersError.details}`, colors.red);
      }
      return false;
    }
    
    log('Supabase', `Database access successful: Found ${usersData.length} user records`, colors.green);
    
    // Get and test additional tables
    try {
      log('Supabase', 'Testing access to other important tables...', colors.blue);
      
      const tables = [
        'projects', 
        'generatedDocuments',
        'budgetNA853Split',
        'Monada'
      ];
      
      for (const table of tables) {
        log('Supabase', `Testing access to "${table}" table...`, colors.blue);
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          log('Supabase', `Table "${table}" access error: ${error.message}`, colors.red);
        } else {
          log('Supabase', `Table "${table}" is accessible`, colors.green);
        }
      }
    } catch (tableError) {
      log('Supabase', `Error testing tables: ${tableError.message}`, colors.red);
    }
    
    return true;
  } catch (error) {
    log('Supabase', `Database test exception: ${error.message}`, colors.red);
    if (error.stack) {
      log('Supabase', `Stack trace: ${error.stack}`, colors.yellow);
    }
    return false;
  }
}

// Main function
async function runDiagnostics() {
  log('Diagnostics', '🔍 Starting Supabase connection diagnostics...', colors.bright + colors.cyan);
  
  // Check for environment variables
  const envConfig = checkEnvironmentVariables();
  if (!envConfig) {
    log('Diagnostics', '❌ Environment variable check failed', colors.red);
    return;
  }
  
  const { supabaseUrl, supabaseKey } = envConfig;
  
  // Test network connectivity to Supabase
  const domainBase = new URL(supabaseUrl).hostname;
  log('Diagnostics', `Testing network connectivity to Supabase domain...`, colors.blue);
  const networkOk = await testDomainConnectivity(domainBase);
  
  if (!networkOk) {
    log('Diagnostics', '❌ Network connectivity test failed', colors.red);
    log('Diagnostics', 'Recommendations:', colors.yellow);
    log('Diagnostics', '1. Check if your server can reach the internet', colors.yellow);
    log('Diagnostics', '2. Verify if there are any firewall rules blocking outbound connections', colors.yellow);
    log('Diagnostics', '3. Check if your DNS resolution is working correctly', colors.yellow);
    log('Diagnostics', '4. If behind a proxy, make sure it\'s configured correctly', colors.yellow);
    return;
  }
  
  log('Diagnostics', '✅ Network connectivity test passed', colors.green);
  
  // Test Supabase API
  log('Diagnostics', 'Testing Supabase API access...', colors.blue);
  const apiOk = await testSupabaseAPI(supabaseUrl, supabaseKey);
  
  if (!apiOk) {
    log('Diagnostics', '❌ Supabase API test failed', colors.red);
    log('Diagnostics', 'Recommendations:', colors.yellow);
    log('Diagnostics', '1. Verify your SUPABASE_KEY is correct and has appropriate permissions', colors.yellow);
    log('Diagnostics', '2. Check if your Supabase project is active and not in maintenance mode', colors.yellow);
    log('Diagnostics', '3. Verify the database schema matches what your application expects', colors.yellow);
    return;
  }
  
  log('Diagnostics', '✅ Supabase API test passed', colors.green);
  log('Diagnostics', '🎉 All diagnostics passed! Your Supabase connection is working correctly.', colors.bright + colors.green);
}

// Run the diagnostics
runDiagnostics().catch(error => {
  log('Diagnostics', `Uncaught error: ${error.message}`, colors.red);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});