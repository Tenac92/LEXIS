/**
 * API Health Check for Supabase Migration Verification
 */
import fetch from 'node-fetch';

// Define endpoints to test
const endpoints = [
  { url: 'http://localhost:5173/api/health', method: 'GET', name: 'Health Check' },
  { url: 'http://localhost:5173/api/auth/me', method: 'GET', name: 'Auth Status' }
];

async function testEndpoints() {
  console.log('Testing API endpoints...');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name} (${endpoint.method} ${endpoint.url})...`);
      
      const response = await fetch(endpoint.url, { method: endpoint.method });
      const status = response.status;
      
      let body = '';
      try {
        body = await response.text();
        if (body && body.length > 100) {
          body = body.substring(0, 100) + '...';
        }
      } catch (e) {
        body = '[Error reading response body]';
      }
      
      console.log(`Status: ${status}`);
      console.log(`Response: ${body}`);
      console.log('-----------------------------------');
    } catch (error) {
      console.error(`Error testing ${endpoint.name}: ${error.message}`);
      console.log('-----------------------------------');
    }
  }
}

// Run all tests
testEndpoints().catch(err => {
  console.error('Unhandled error:', err);
});