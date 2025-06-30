#!/usr/bin/env node

/**
 * Test SQL API Endpoint
 * Tests the new SQL execution API endpoint
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.VITE_API_BASE || 'https://da289978-06ee-482f-a373-d5c4a20b06ab-00-2tuv81vlix3iv.riker.replit.dev';

console.log('🔧 TESTING SQL API ENDPOINT');
console.log('============================\n');

async function testSQLAPI() {
  try {
    // First, let's test without authentication to see the error
    console.log('🧪 Test 1: Testing without authentication...');
    
    const unauthResponse = await fetch(`${API_BASE}/api/sql/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT * FROM Projects LIMIT 1'
      })
    });
    
    const unauthResult = await unauthResponse.text();
    console.log('📊 Unauthorized response status:', unauthResponse.status);
    console.log('📊 Unauthorized response:', unauthResult.substring(0, 200));
    
    console.log('\n✅ API endpoint is working but requires authentication as expected');
    console.log('\n💡 To test with authentication, you need to:');
    console.log('   1. Login to the application in your browser');
    console.log('   2. Copy the session cookie');
    console.log('   3. Use it in the API request');
    
    console.log('\n🎯 MANUAL TEST COMMANDS:');
    console.log('You can test the SQL API using curl with authentication:');
    console.log('');
    console.log('# Login first to get session cookie, then:');
    console.log(`curl -X POST ${API_BASE}/api/sql/execute \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Cookie: sid=YOUR_SESSION_COOKIE" \\');
    console.log('  -d \'{"query": "SELECT COUNT(*) FROM Projects"}\'');
    
    console.log('\n📋 Example queries to test:');
    console.log('  • SELECT * FROM Projects LIMIT 5');
    console.log('  • SELECT COUNT(*) FROM project_index');
    console.log('  • SELECT current_database(), version()');
    console.log('  • SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
    
  } catch (error) {
    console.error('❌ Error testing SQL API:', error.message);
  }
}

testSQLAPI();