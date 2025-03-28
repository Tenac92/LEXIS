/**
 * Enhanced Supabase Connection Test
 * 
 * This script performs a comprehensive test of Supabase connectivity
 * including network connectivity, authentication, and database access.
 * 
 * Run with: node check-supabase-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import dns from 'dns';
import { createConnection } from 'net';
import { exec } from 'child_process';
import https from 'https';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Color formatting for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(type, message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] [${type}] ${message}${colors.reset}`);
}

// Step 1: Test basic domain connectivity
async function testDomainConnectivity(domain, port = 443) {
  log('Network', `Testing DNS resolution for ${domain}...`, colors.cyan);
  
  try {
    // DNS lookup
    const addresses = await promisify(dns.lookup)(domain, { all: true });
    log('Network', `DNS resolved ${domain} to:`, colors.green);
    addresses.forEach(addr => log('Network', `  - ${addr.address} (${addr.family === 6 ? 'IPv6' : 'IPv4'})`, colors.green));
    
    // TCP connection test
    log('Network', `Testing TCP connectivity to ${domain}:${port}...`, colors.cyan);
    const connected = await new Promise((resolve) => {
      const socket = createConnection(port, domain);
      
      socket.on('connect', () => {
        log('Network', `TCP connection to ${domain}:${port} successful`, colors.green);
        socket.end();
        resolve(true);
      });
      
      socket.on('error', (err) => {
        log('Network', `TCP connection to ${domain}:${port} failed: ${err.message}`, colors.red);
        resolve(false);
      });
      
      // Set a timeout for the connection attempt
      socket.setTimeout(5000, () => {
        log('Network', `TCP connection to ${domain}:${port} timed out`, colors.red);
        socket.destroy();
        resolve(false);
      });
    });
    
    // HTTP connectivity test
    if (connected) {
      log('Network', `Testing HTTPS connectivity to ${domain}...`, colors.cyan);
      const httpConnected = await new Promise((resolve) => {
        const req = https.request({
          hostname: domain,
          port: 443,
          path: '/',
          method: 'HEAD',
          timeout: 5000,
        }, (res) => {
          log('Network', `HTTPS connection successful: ${res.statusCode} ${res.statusMessage}`, colors.green);
          resolve(true);
        });
        
        req.on('error', (err) => {
          log('Network', `HTTPS request failed: ${err.message}`, colors.red);
          resolve(false);
        });
        
        req.on('timeout', () => {
          log('Network', 'HTTPS request timed out', colors.red);
          req.destroy();
          resolve(false);
        });
        
        req.end();
      });
      
      return connected && httpConnected;
    }
    
    return false;
  } catch (err) {
    log('Network', `Domain connectivity test failed: ${err.message}`, colors.red);
    return false;
  }
}

// Step 2: Check environment variables
function checkEnvironmentVariables() {
  log('Config', 'Checking environment variables...', colors.cyan);
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl) {
    log('Config', 'SUPABASE_URL is missing', colors.red);
  } else {
    log('Config', `SUPABASE_URL: ${supabaseUrl}`, colors.green);
  }
  
  if (!supabaseKey) {
    log('Config', 'SUPABASE_KEY is missing', colors.red);
  } else {
    const maskedKey = supabaseKey.substring(0, 4) + '...' + supabaseKey.substring(supabaseKey.length - 4);
    log('Config', `SUPABASE_KEY: ${maskedKey}`, colors.green);
  }
  
  return { supabaseUrl, supabaseKey };
}

// Step 3: Test Supabase API access
async function testSupabaseAPI(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) {
    log('Supabase', 'Cannot test Supabase API: Missing configuration', colors.red);
    return false;
  }
  
  log('Supabase', 'Creating Supabase client...', colors.cyan);
  
  try {
    // Create a Supabase client with enhanced options
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { 'x-application-name': 'connection-test' },
      },
    });
    
    log('Supabase', 'Testing API connection...', colors.cyan);
    
    // Test 1: Basic API connection
    const { data: healthData, error: healthError } = await supabase.from('users').select('count(*)');
    
    if (healthError) {
      log('Supabase', `API connection test failed: ${healthError.message}`, colors.red);
      
      // Show more details about the error
      if (healthError.code) {
        log('Supabase', `Error code: ${healthError.code}`, colors.red);
      }
      if (healthError.details) {
        log('Supabase', `Error details: ${healthError.details}`, colors.red);
      }
      
      return false;
    }
    
    log('Supabase', 'API connection test passed', colors.green);
    
    // Test 2: RLS policy test - try fetching a specific table that has RLS
    log('Supabase', 'Testing Row Level Security policy access...', colors.cyan);
    
    try {
      const { data: rlsData, error: rlsError } = await supabase
        .from('Projects')
        .select('count(*)')
        .limit(1);
        
      if (rlsError) {
        log('Supabase', `RLS test resulted in error: ${rlsError.message}`, colors.yellow);
        log('Supabase', 'This may be expected if RLS policies are enforced and you are not authenticated', colors.yellow);
      } else {
        log('Supabase', 'RLS test passed or RLS not enforced for this table', colors.green);
      }
    } catch (rlsTestErr) {
      log('Supabase', `RLS test exception: ${rlsTestErr.message}`, colors.yellow);
    }
    
    return true;
  } catch (error) {
    log('Supabase', `Supabase client error: ${error.message}`, colors.red);
    
    // Show stack trace for debugging
    if (error.stack) {
      log('Supabase', `Stack trace: ${error.stack}`, colors.red);
    }
    
    return false;
  }
}

// Main function to run all diagnostics
async function runDiagnostics() {
  log('System', 'Starting Supabase connection diagnostics', colors.bright);
  log('System', `Node.js version: ${process.version}`, colors.cyan);
  log('System', `Platform: ${process.platform}`, colors.cyan);
  
  // Extract domain from Supabase URL
  const { supabaseUrl, supabaseKey } = checkEnvironmentVariables();
  let domain = '';
  
  if (supabaseUrl) {
    try {
      domain = new URL(supabaseUrl).hostname;
      log('Config', `Extracted domain: ${domain}`, colors.cyan);
    } catch (err) {
      log('Config', `Failed to parse Supabase URL: ${err.message}`, colors.red);
    }
  }
  
  // Network connectivity tests
  if (domain) {
    const domainConnected = await testDomainConnectivity(domain);
    if (!domainConnected) {
      log('Network', 'Domain connectivity test failed - this indicates network issues', colors.red);
      process.exit(1);
    }
  } else {
    log('Network', 'Skipping network tests due to missing domain', colors.yellow);
  }
  
  // Supabase API tests
  const apiConnected = await testSupabaseAPI(supabaseUrl, supabaseKey);
  
  if (apiConnected) {
    log('System', 'All Supabase API tests passed successfully!', colors.green);
  } else {
    log('System', 'Some Supabase API tests failed - see above for details', colors.red);
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics().catch(err => {
  log('System', `Unhandled error: ${err.message}`, colors.red);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});