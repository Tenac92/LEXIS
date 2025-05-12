/**
 * Budget Lookup Test Script
 * Tests multiple ways to search for budget data with various formats
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

// Test cases with different MIS formats
const TEST_CASES = [
  {
    name: 'Alphanumeric with special chars (NA853 code)',
    mis: '2024ΝΑ85300001',
    expectedMatch: true,
    expectedNumericMis: 5174692 // The numeric MIS that should match this NA853 code
  },
  {
    name: 'Numeric MIS only',
    mis: '5174692',
    expectedMatch: true
  },
  {
    name: 'Invalid MIS format',
    mis: 'INVALID-FORMAT',
    expectedMatch: false
  }
];

async function testBudgetLookup() {
  console.log('===== BUDGET LOOKUP TEST =====');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing different MIS formats for budget lookup...\n');

  for (const testCase of TEST_CASES) {
    console.log(`\nTest case: ${testCase.name}`);
    console.log(`MIS value: ${testCase.mis}`);
    
    try {
      // Make the API request
      const url = `${BASE_URL}/api/budget/${encodeURIComponent(testCase.mis)}`;
      console.log(`Request URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Log the response
      console.log(`Response status: ${response.status}`);
      console.log(`Response data status: ${data.status}`);
      
      // Check if we got budget data
      const hasBudgetData = data.data && (
        parseFloat(data.data.total_budget) > 0 || 
        parseFloat(data.data.user_view) > 0
      );
      
      console.log(`Budget data found: ${hasBudgetData ? 'YES' : 'NO'}`);
      
      if (hasBudgetData) {
        console.log(`User view amount: ${data.data.user_view}`);
        console.log(`Total budget: ${data.data.total_budget}`);
        console.log(`Annual budget: ${data.data.annual_budget}`);
      } else {
        console.log('No budget data found in response');
      }
      
      // Verify against expected result
      if (hasBudgetData === testCase.expectedMatch) {
        console.log('✅ Test PASSED - Match result matches expectations');
      } else {
        console.log('❌ Test FAILED - Expected', testCase.expectedMatch ? 'to find' : 'not to find', 'budget data');
      }
      
    } catch (error) {
      console.error(`Error testing ${testCase.name}:`, error.message);
      console.log('❌ Test FAILED due to error');
    }
  }
  
  console.log('\n===== TEST SUMMARY =====');
  console.log(`Total test cases: ${TEST_CASES.length}`);
}

testBudgetLookup().catch(console.error);