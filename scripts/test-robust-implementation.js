#!/usr/bin/env node
/**
 * Test Robust Implementation
 * This script tests all the robust implementation features
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const API_BASE = process.env.VITE_API_BASE || 'http://localhost:5000';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseTables() {
  console.log('🔍 Testing Database Tables...\n');
  
  const tables = [
    'users',
    'Projects', 
    'project_budget',
    'generated_documents',
    'beneficiaries',
    'beneficiary_payments',
    'project_history',
    'budget_history',
    'user_preferences',
    'project_index',
    'expediture_types',
    'event_types',
    'kallikratis',
    'attachments',
    'Employees',
    'Monada'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
        results[table] = { status: 'error', error: error.message };
      } else {
        console.log(`✅ ${table}: ${count || 0} records`);
        results[table] = { status: 'success', count: count || 0 };
      }
    } catch (err) {
      console.log(`❌ ${table}: Exception - ${err.message}`);
      results[table] = { status: 'exception', error: err.message };
    }
  }
  
  return results;
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...\n');
  
  const endpoints = [
    '/api/health',
    '/api/public/units',
    '/api/public/monada',
    '/api/public/expenditure-types',
    '/api/expenditure-types'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${endpoint}: ${response.status} - ${data.status || 'success'}`);
        results[endpoint] = { 
          status: 'success', 
          statusCode: response.status,
          dataCount: Array.isArray(data) ? data.length : (data.data?.length || 0)
        };
      } else {
        console.log(`❌ ${endpoint}: ${response.status} - ${data.message || 'error'}`);
        results[endpoint] = { 
          status: 'error', 
          statusCode: response.status, 
          message: data.message 
        };
      }
    } catch (err) {
      console.log(`❌ ${endpoint}: Exception - ${err.message}`);
      results[endpoint] = { status: 'exception', error: err.message };
    }
  }
  
  return results;
}

async function testSchemaValidation() {
  console.log('\n🔒 Testing Schema Validation...\n');
  
  // Test expenditure type creation with validation
  try {
    const response = await fetch(`${API_BASE}/api/expenditure-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Expenditure Type',
        description: 'Test description',
        category: 'test'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Authentication required - validation working');
      return { authentication: 'working' };
    } else if (response.ok) {
      console.log('✅ Schema validation working - test record created');
      return { validation: 'working', created: data };
    } else {
      console.log(`⚠️ Unexpected response: ${response.status} - ${data.message}`);
      return { validation: 'unexpected', response: data };
    }
    
  } catch (err) {
    console.log(`❌ Schema validation test failed: ${err.message}`);
    return { validation: 'error', error: err.message };
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ Testing Error Handling...\n');
  
  // Test invalid endpoint
  try {
    const response = await fetch(`${API_BASE}/api/invalid-endpoint`);
    const data = await response.json();
    
    if (response.status === 404) {
      console.log('✅ 404 error handling working');
    } else {
      console.log(`⚠️ Unexpected status for invalid endpoint: ${response.status}`);
    }
    
    return { errorHandling: response.status === 404 ? 'working' : 'unexpected' };
    
  } catch (err) {
    console.log(`❌ Error handling test failed: ${err.message}`);
    return { errorHandling: 'error', error: err.message };
  }
}

async function generateReport(databaseResults, apiResults, validationResults, errorResults) {
  console.log('\n📊 ROBUST IMPLEMENTATION REPORT');
  console.log('================================\n');
  
  // Database Summary
  const totalTables = Object.keys(databaseResults).length;
  const successfulTables = Object.values(databaseResults).filter(r => r.status === 'success').length;
  const totalRecords = Object.values(databaseResults)
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + (r.count || 0), 0);
  
  console.log(`📦 Database Health: ${successfulTables}/${totalTables} tables accessible`);
  console.log(`📊 Total Records: ${totalRecords.toLocaleString()}`);
  
  // API Summary
  const totalEndpoints = Object.keys(apiResults).length;
  const successfulEndpoints = Object.values(apiResults).filter(r => r.status === 'success').length;
  
  console.log(`🌐 API Health: ${successfulEndpoints}/${totalEndpoints} endpoints working`);
  
  // Validation Summary
  console.log(`🔒 Schema Validation: ${validationResults.authentication || validationResults.validation || 'tested'}`);
  console.log(`🛡️ Error Handling: ${errorResults.errorHandling || 'tested'}`);
  
  // Issues
  const dbIssues = Object.entries(databaseResults).filter(([_, r]) => r.status !== 'success');
  const apiIssues = Object.entries(apiResults).filter(([_, r]) => r.status !== 'success');
  
  if (dbIssues.length > 0 || apiIssues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    
    dbIssues.forEach(([table, result]) => {
      console.log(`   Database: ${table} - ${result.error}`);
    });
    
    apiIssues.forEach(([endpoint, result]) => {
      console.log(`   API: ${endpoint} - ${result.error || result.message}`);
    });
  }
  
  // Health Score
  const totalTests = totalTables + totalEndpoints + 2; // +2 for validation and error handling
  const successfulTests = successfulTables + successfulEndpoints + 
    (validationResults.authentication || validationResults.validation ? 1 : 0) +
    (errorResults.errorHandling === 'working' ? 1 : 0);
  
  const healthScore = Math.round((successfulTests / totalTests) * 100);
  
  console.log(`\n🎯 Overall Health Score: ${healthScore}%`);
  
  if (healthScore >= 90) {
    console.log('🎉 Excellent! Your robust implementation is working great.');
  } else if (healthScore >= 75) {
    console.log('✅ Good! Your implementation is mostly working with minor issues.');
  } else if (healthScore >= 50) {
    console.log('⚠️  Fair. Some components need attention.');
  } else {
    console.log('❌ Poor. Major issues need to be addressed.');
  }
}

async function main() {
  console.log('🚀 Starting Robust Implementation Test...\n');
  
  try {
    const databaseResults = await testDatabaseTables();
    const apiResults = await testAPIEndpoints();
    const validationResults = await testSchemaValidation();
    const errorResults = await testErrorHandling();
    
    await generateReport(databaseResults, apiResults, validationResults, errorResults);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

main().catch(console.error);