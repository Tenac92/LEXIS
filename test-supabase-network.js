/**
 * Supabase Network Connectivity Test
 * This script performs basic network tests to diagnose connectivity issues
 * 
 * Run with: node test-supabase-network.js
 */

const https = require('https');
const dns = require('dns').promises;
const { execSync } = require('child_process');

// Load environment variables if needed
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not available, using environment variables as is');
}

// Get Supabase URL from environment or use default
const supabaseUrl = process.env.SUPABASE_URL || 'https://rlzrtiufwxlljrtmpwsr.supabase.co';
let supabaseDomain;

try {
  supabaseDomain = new URL(supabaseUrl).hostname;
  console.log(`Testing connectivity to Supabase domain: ${supabaseDomain}`);
} catch (error) {
  console.error(`Invalid Supabase URL: ${supabaseUrl}`);
  process.exit(1);
}

// Test DNS resolution
async function testDns(domain) {
  console.log('\n--- DNS Resolution Test ---');
  try {
    console.log(`Resolving ${domain}...`);
    const addresses = await dns.resolve4(domain);
    console.log(`✅ DNS resolution successful. IP addresses: ${addresses.join(', ')}`);
    return addresses;
  } catch (error) {
    console.error(`❌ DNS resolution failed: ${error.message}`);
    return null;
  }
}

// Test TCP connection
function testTcpConnection(domain, port = 443) {
  console.log(`\n--- TCP Connection Test (Port ${port}) ---`);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: domain,
      port: port,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }, (res) => {
      console.log(`✅ TCP connection successful. Response status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('timeout', () => {
      console.error('❌ Connection timed out');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.error(`❌ Connection error: ${err.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Try to determine the server's public IP
function getServerPublicIp() {
  console.log('\n--- Server Public IP ---');
  try {
    // Try multiple services to determine public IP
    const services = [
      'curl -s https://api.ipify.org',
      'curl -s https://ipinfo.io/ip',
      'curl -s https://icanhazip.com'
    ];
    
    for (const cmd of services) {
      try {
        const ip = execSync(cmd).toString().trim();
        if (ip && /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(ip)) {
          console.log(`✅ Server public IP: ${ip}`);
          return ip;
        }
      } catch (e) {
        // Try next service
      }
    }
    console.error('❌ Could not determine server public IP');
    return null;
  } catch (error) {
    console.error(`❌ Error determining public IP: ${error.message}`);
    return null;
  }
}

// Test HTTP connection
async function testHttpConnection(domain) {
  console.log('\n--- HTTP/HTTPS Connection Test ---');
  
  return new Promise((resolve) => {
    console.log(`Testing HTTPS connection to ${domain}...`);
    
    const req = https.request({
      hostname: domain,
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Supabase Connection Test'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ HTTPS connection successful. Status: ${res.statusCode}`);
        console.log(`Response headers:`, res.headers);
        resolve(true);
      });
    });
    
    req.on('timeout', () => {
      console.error('❌ HTTPS request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.error(`❌ HTTPS request error: ${err.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Run traceroute to identify network path issues
function runTraceroute(domain) {
  console.log('\n--- Network Path Test (Traceroute) ---');
  
  try {
    // Check if traceroute/tracepath is available
    let cmd = 'traceroute';
    try {
      execSync('which traceroute >/dev/null 2>&1');
    } catch (e) {
      try {
        execSync('which tracepath >/dev/null 2>&1');
        cmd = 'tracepath';
      } catch (e2) {
        console.log('❌ Neither traceroute nor tracepath is available');
        return;
      }
    }
    
    // Run the command with a timeout
    console.log(`Running ${cmd} to ${domain}...`);
    const result = execSync(`${cmd} -m 15 ${domain} 2>&1`, { timeout: 15000 }).toString();
    console.log(result);
    
    // Check for timeouts or routing issues in the output
    if (result.includes('* * *')) {
      console.log('⚠️ Some hops are not responding. This could indicate network filtering.');
    }
    
  } catch (error) {
    console.error(`❌ Error running network path test: ${error.message}`);
  }
}

// Check for firewall or proxy settings
function checkNetworkSettings() {
  console.log('\n--- Network Settings Check ---');
  
  // Check for proxy environment variables
  const proxyVars = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY'];
  let proxyFound = false;
  
  for (const proxyVar of proxyVars) {
    if (process.env[proxyVar]) {
      console.log(`⚠️ Proxy setting found: ${proxyVar}=${process.env[proxyVar]}`);
      proxyFound = true;
    }
  }
  
  if (!proxyFound) {
    console.log('✅ No proxy environment variables detected');
  }
  
  // Try to check iptables if available
  try {
    console.log('\nChecking for firewall rules (requires root/sudo access):');
    const iptables = execSync('iptables -L -n 2>/dev/null || echo "Permission denied"').toString();
    
    if (iptables.includes('Permission denied')) {
      console.log('⚠️ Cannot check firewall rules - insufficient permissions');
    } else if (iptables.includes('Chain') && iptables.includes('policy')) {
      console.log('✅ Firewall rules accessible. Look for any rules that might block outbound HTTPS (port 443)');
      // Look for any DROP rules
      if (iptables.includes('DROP')) {
        console.log('⚠️ Firewall has DROP rules which might affect outbound connections');
      }
    }
  } catch (error) {
    console.log('⚠️ Cannot check firewall rules - iptables not available');
  }
}

// Main function
async function runNetworkTests() {
  console.log('=======================================================');
  console.log('🔍 SUPABASE NETWORK CONNECTIVITY DIAGNOSTIC TOOL');
  console.log('=======================================================');
  console.log(`Testing connection to: ${supabaseUrl}`);
  console.log('=======================================================');
  
  // Get server's public IP
  const publicIp = getServerPublicIp();
  
  // Test DNS resolution
  const ipAddresses = await testDns(supabaseDomain);
  
  // Test TCP connection
  const tcpResult = await testTcpConnection(supabaseDomain);
  
  // Test HTTP connection
  const httpResult = await testHttpConnection(supabaseDomain);
  
  // Network path analysis
  if (!tcpResult || !httpResult) {
    runTraceroute(supabaseDomain);
  }
  
  // Check network settings
  checkNetworkSettings();
  
  // Summary and recommendations
  console.log('\n=======================================================');
  console.log('📊 TEST SUMMARY');
  console.log('=======================================================');
  
  if (ipAddresses) {
    console.log('✅ DNS Resolution: SUCCESS');
  } else {
    console.log('❌ DNS Resolution: FAILED');
  }
  
  if (tcpResult) {
    console.log('✅ TCP Connection: SUCCESS');
  } else {
    console.log('❌ TCP Connection: FAILED');
  }
  
  if (httpResult) {
    console.log('✅ HTTP Connection: SUCCESS');
  } else {
    console.log('❌ HTTP Connection: FAILED');
  }
  
  console.log('\n=======================================================');
  console.log('🧠 RECOMMENDATIONS');
  console.log('=======================================================');
  
  if (!ipAddresses) {
    console.log('• Check your DNS server configuration');
    console.log('• Ensure DNS resolution is working on this server');
    console.log('• Try adding an entry to /etc/hosts for quick testing');
  }
  
  if (!tcpResult) {
    console.log('• Check if port 443 (HTTPS) is blocked by firewall');
    console.log('• Verify outbound connections are allowed from this server');
    console.log('• Check if a proxy server is required for external connections');
  }
  
  if (!httpResult && tcpResult) {
    console.log('• TCP works but HTTP fails - could be protocol filtering');
    console.log('• Check for SSL/TLS inspection or HTTPS proxy requirements');
    console.log('• Verify TLS versions supported by your server');
  }
  
  if (tcpResult && httpResult) {
    console.log('✅ Network connectivity to Supabase appears to be working correctly!');
    console.log('• If you still have issues, check your SUPABASE_URL and SUPABASE_KEY values');
    console.log('• Make sure your Supabase project is active and not in maintenance mode');
    console.log('• Verify IP allow lists in Supabase dashboard if you have them enabled');
  }
  
  console.log('\nFor further diagnostics, run the full check-supabase-connection.js script.');
}

// Run the network tests
runNetworkTests().catch(error => {
  console.error(`Uncaught error: ${error.message}`);
  process.exit(1);
});