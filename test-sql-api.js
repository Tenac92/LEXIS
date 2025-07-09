#!/usr/bin/env node
/**
 * Test SQL API Endpoint
 * Tests the new SQL execution API endpoint
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 TESTING SQL API ENDPOINT');
console.log('===========================\n');

const API_BASE = 'http://localhost:3000';

async function testSQLAPI() {
  try {
    // Test 1: Count query
    console.log('📋 Test 1: Count Projects');
    const countResponse = await fetch(`${API_BASE}/api/sql/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT count(*) FROM Projects'
      })
    });
    
    const countResult = await countResponse.json();
    console.log('Result:', JSON.stringify(countResult, null, 2));
    console.log('');

    // Test 2: Select query
    console.log('📋 Test 2: Select Projects');
    const selectResponse = await fetch(`${API_BASE}/api/sql/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT id, mis, project_title FROM Projects LIMIT 3'
      })
    });
    
    const selectResult = await selectResponse.json();
    console.log('Result:', JSON.stringify(selectResult, null, 2));
    console.log('');

    // Test 3: System query
    console.log('📋 Test 3: System Information');
    const systemResponse = await fetch(`${API_BASE}/api/sql/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT current_database(), version()'
      })
    });
    
    const systemResult = await systemResponse.json();
    console.log('Result:', JSON.stringify(systemResult, null, 2));
    console.log('');

    console.log('✅ All API tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
    process.exit(1);
  }
}

// Run the test
testSQLAPI();