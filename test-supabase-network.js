/**
 * Supabase Network Connectivity Test
 * This script performs basic network tests to diagnose connectivity issues
 * 
 * Run with: node test-supabase-network.js
 */

import * as dotenv from 'dotenv';
import dns from 'dns';
import { createConnection } from 'net';
import https from 'https';
import { promisify } from 'util';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

// Extract Supabase domain from URL
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : '';

if (!supabaseDomain) {
  console.error('Error: Could not extract Supabase domain from SUPABASE_URL environment variable');
  process.exit(1);
}

// DNS test
async function testDns(domain) {
  console.log(`\n[DNS] Testing DNS resolution for ${domain}...`);
  
  try {
    const addresses = await promisify(dns.lookup)(domain, { all: true });
    console.log(`[DNS] ✅ Successfully resolved ${domain} to:`);
    addresses.forEach(addr => {
      console.log(`[DNS]   - ${addr.address} (${addr.family === 6 ? 'IPv6' : 'IPv4'})`);
    });
    return addresses;
  } catch (err) {
    console.error(`[DNS] ❌ DNS resolution failed: ${err.message}`);
    return null;
  }
}

// TCP connection test
function testTcpConnection(domain, port = 443) {
  console.log(`\n[TCP] Testing TCP connectivity to ${domain}:${port}...`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = createConnection(port, domain);
    
    socket.on('connect', () => {
      const duration = Date.now() - startTime;
      console.log(`[TCP] ✅ TCP connection successful (${duration}ms)`);
      socket.end();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      console.error(`[TCP] ❌ TCP connection failed: ${err.message}`);
      resolve(false);
    });
    
    socket.setTimeout(5000, () => {
      console.error('[TCP] ❌ TCP connection timed out after 5 seconds');
      socket.destroy();
      resolve(false);
    });
  });
}

// Get server's public IP
function getServerPublicIp() {
  console.log('\n[Network] Determining server public IP...');
  
  return new Promise((resolve) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`[Network] ✅ Server public IP: ${data}`);
        resolve(data);
      });
    }).on('error', (err) => {
      console.error(`[Network] ❌ Failed to get public IP: ${err.message}`);
      resolve(null);
    });
  });
}

// HTTP connection test
async function testHttpConnection(domain) {
  console.log(`\n[HTTP] Testing HTTPS connectivity to ${domain}...`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = https.request({
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 5000,
    }, (res) => {
      const duration = Date.now() - startTime;
      console.log(`[HTTP] ✅ HTTPS connection successful: ${res.statusCode} ${res.statusMessage} (${duration}ms)`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.error(`[HTTP] ❌ HTTPS request failed: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.error('[HTTP] ❌ HTTPS request timed out after 5 seconds');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Run traceroute to Supabase domain
function runTraceroute(domain) {
  console.log(`\n[Traceroute] Running traceroute to ${domain}...`);
  
  return new Promise((resolve) => {
    // Use traceroute on Unix-like systems or tracert on Windows
    const cmd = process.platform === 'win32'
      ? `tracert -d -h 15 ${domain}`
      : `traceroute -n -m 15 ${domain}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Traceroute] ⚠️ Error running traceroute: ${error.message}`);
        resolve(false);
        return;
      }
      
      console.log('[Traceroute] Results:');
      const lines = stdout.split('\n').slice(0, 20); // Limit output to first 20 lines
      lines.forEach(line => console.log(`[Traceroute] ${line}`));
      
      if (lines.length > 20) {
        console.log('[Traceroute] ... (output truncated)');
      }
      
      resolve(true);
    });
  });
}

// Check network settings
function checkNetworkSettings() {
  console.log('\n[Network] Checking network settings...');
  
  // Check if we're running on a Replit environment
  const isReplit = process.env.REPL_ID || process.env.REPL_OWNER;
  if (isReplit) {
    console.log('[Network] ℹ️ Running in Replit environment');
    console.log('[Network] ℹ️ Replit uses proxies for outbound connections');
  }
  
  // Check for HTTP_PROXY or HTTPS_PROXY environment variables
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  
  if (httpProxy) {
    console.log(`[Network] ℹ️ HTTP_PROXY is set to: ${httpProxy}`);
  }
  
  if (httpsProxy) {
    console.log(`[Network] ℹ️ HTTPS_PROXY is set to: ${httpsProxy}`);
  }
  
  if (!httpProxy && !httpsProxy) {
    console.log('[Network] ℹ️ No proxy environment variables detected');
  }
}

// Run all network tests
async function runNetworkTests() {
  console.log('=== Supabase Network Connectivity Test ===');
  console.log(`Testing connectivity to Supabase domain: ${supabaseDomain}`);
  
  // Check environment
  checkNetworkSettings();
  
  // Get server public IP
  await getServerPublicIp();
  
  // DNS test
  const dnsResults = await testDns(supabaseDomain);
  
  // TCP connection test
  const tcpResult = await testTcpConnection(supabaseDomain);
  
  // HTTP connection test
  const httpResult = await testHttpConnection(supabaseDomain);
  
  // Run traceroute if any tests failed
  if (!dnsResults || !tcpResult || !httpResult) {
    console.log('\n[Network] ⚠️ Some connectivity tests failed, running traceroute for additional diagnostics...');
    await runTraceroute(supabaseDomain);
  }
  
  // Show summary
  console.log('\n=== Summary ===');
  console.log(`Supabase Domain: ${supabaseDomain}`);
  console.log(`DNS Resolution: ${dnsResults ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`TCP Connection: ${tcpResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`HTTP Connection: ${httpResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  // Provide recommendation
  if (dnsResults && tcpResult && httpResult) {
    console.log('\n✅ All network tests passed. Network connectivity to Supabase looks good!');
    console.log('If you are still experiencing issues connecting to Supabase, the problem may be related to:');
    console.log('- API key permissions or configuration');
    console.log('- Database permissions or Row Level Security (RLS) policies');
    console.log('- Rate limiting or IP restrictions on the Supabase project');
  } else {
    console.log('\n⚠️ Some network tests failed. This indicates network connectivity issues to Supabase.');
    console.log('Recommendations:');
    console.log('- Check your firewall or network security settings');
    console.log('- If using a proxy, ensure it allows connections to Supabase domains');
    console.log('- Check if your hosting provider restricts outbound connections');
    console.log('- Verify if the Supabase service is operational (status.supabase.com)');
  }
}

// Run the network tests
runNetworkTests().catch(err => {
  console.error(`Unhandled error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});