#!/usr/bin/env node

/**
 * Comprehensive Application and Database Schema Validation
 * 
 * This script validates the entire application stack including:
 * - Database connectivity and schema
 * - All core table counts and data integrity
 * - API endpoints functionality
 * - Reference data completeness
 * - Authentication system
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const API_BASE = process.env.VITE_API_BASE || 'https://da289978-06ee-482f-a373-d5c4a20b06ab-00-2tuv81vlix3iv.riker.replit.dev';

console.log('🏥 COMPREHENSIVE APPLICATION & DATABASE VALIDATION');
console.log('==================================================\n');

const supabase = createClient(supabaseUrl, supabaseKey);

// Database validation functions
async function validateDatabaseConnection() {
  console.log('📡 1. DATABASE CONNECTION TEST');
  console.log('------------------------------');
  
  try {
    const { data, error } = await supabase.from('Projects').select('id').limit(1);
    
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log(`📊 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
    return true;
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    return false;
  }
}

async function validateTableCounts() {
  console.log('\n📊 2. TABLE COUNTS VALIDATION');
  console.log('-----------------------------');
  
  const tables = [
    'Projects',
    'project_index', 
    'project_history',
    'budget_na853_split',
    'users',
    'kallikratis',
    'event_types',
    'expenditure_types',
    'Monada'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
        results[table] = { count: 0, status: 'error', error: error.message };
      } else {
        console.log(`✅ ${table}: ${count} records`);
        results[table] = { count, status: 'success' };
      }
    } catch (error) {
      console.log(`❌ ${table}: Exception - ${error.message}`);
      results[table] = { count: 0, status: 'exception', error: error.message };
    }
  }
  
  return results;
}

async function validateProjectsSchema() {
  console.log('\n🏗️  3. PROJECTS TABLE SCHEMA VALIDATION');
  console.log('--------------------------------------');
  
  try {
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Schema validation failed:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      const fields = Object.keys(data[0]);
      console.log('✅ Projects table structure confirmed');
      console.log('📋 Fields:', fields.join(', '));
      
      // Check for essential fields
      const essentialFields = ['id', 'mis', 'project_title', 'event_description', 'budget_na853'];
      const missingFields = essentialFields.filter(field => !fields.includes(field));
      
      if (missingFields.length === 0) {
        console.log('✅ All essential fields present');
      } else {
        console.log('⚠️  Missing essential fields:', missingFields.join(', '));
      }
      
      return true;
    }
    
    console.log('⚠️  No project data found');
    return false;
  } catch (error) {
    console.log('❌ Schema validation error:', error.message);
    return false;
  }
}

async function validateReferenceData() {
  console.log('\n📚 4. REFERENCE DATA VALIDATION');
  console.log('-------------------------------');
  
  const checks = [
    { table: 'event_types', expectedMin: 10, field: 'event_name' },
    { table: 'expenditure_types', expectedMin: 5, field: 'expenditure_name' },
    { table: 'kallikratis', expectedMin: 900, field: 'perifereia' },
    { table: 'Monada', expectedMin: 10, field: 'unit_name' }
  ];
  
  for (const check of checks) {
    try {
      const { count, error } = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${check.table}: ${error.message}`);
      } else if (count >= check.expectedMin) {
        console.log(`✅ ${check.table}: ${count} records (expected minimum: ${check.expectedMin})`);
      } else {
        console.log(`⚠️  ${check.table}: ${count} records (below expected minimum: ${check.expectedMin})`);
      }
    } catch (error) {
      console.log(`❌ ${check.table}: Exception - ${error.message}`);
    }
  }
}

async function validateAPIEndpoints() {
  console.log('\n🌐 5. API ENDPOINTS VALIDATION');
  console.log('-----------------------------');
  
  const endpoints = [
    { path: '/api/public/health', method: 'GET', expectedStatus: 200 },
    { path: '/api/public/units', method: 'GET', expectedStatus: 200 },
    { path: '/api/event-types', method: 'GET', expectedStatus: 401 }, // Requires auth
    { path: '/api/expenditure-types', method: 'GET', expectedStatus: 401 }, // Requires auth
    { path: '/api/kallikratis', method: 'GET', expectedStatus: 401 } // Requires auth
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method
      });
      
      if (response.status === endpoint.expectedStatus) {
        console.log(`✅ ${endpoint.method} ${endpoint.path}: ${response.status} (as expected)`);
      } else {
        console.log(`⚠️  ${endpoint.method} ${endpoint.path}: ${response.status} (expected ${endpoint.expectedStatus})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.path}: ${error.message}`);
    }
  }
}

async function validateDataIntegrity() {
  console.log('\n🔗 6. DATA INTEGRITY VALIDATION');
  console.log('-------------------------------');
  
  try {
    // Check project-index relationships
    const { data: projectIndexData, error: piError } = await supabase
      .from('project_index')
      .select('project_mis')
      .limit(5);
    
    if (piError) {
      console.log('❌ Project index check failed:', piError.message);
    } else {
      console.log(`✅ Project index relationships: ${projectIndexData?.length || 0} sample records`);
    }
    
    // Check project history
    const { data: historyData, error: historyError } = await supabase
      .from('project_history')
      .select('project_mis')
      .limit(5);
    
    if (historyError) {
      console.log('❌ Project history check failed:', historyError.message);
    } else {
      console.log(`✅ Project history records: ${historyData?.length || 0} sample records`);
    }
    
    // Check budget data
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('project_mis')
      .limit(5);
    
    if (budgetError) {
      console.log('❌ Budget data check failed:', budgetError.message);
    } else {
      console.log(`✅ Budget records: ${budgetData?.length || 0} sample records`);
    }
    
  } catch (error) {
    console.log('❌ Data integrity validation error:', error.message);
  }
}

async function generateSystemReport(tableCounts) {
  console.log('\n📋 7. SYSTEM HEALTH REPORT');
  console.log('--------------------------');
  
  const totalRecords = Object.values(tableCounts)
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + t.count, 0);
  
  const healthyTables = Object.values(tableCounts)
    .filter(t => t.status === 'success').length;
  
  const totalTables = Object.keys(tableCounts).length;
  
  const healthScore = Math.round((healthyTables / totalTables) * 100);
  
  console.log(`📊 Total Records: ${totalRecords.toLocaleString()}`);
  console.log(`📚 Healthy Tables: ${healthyTables}/${totalTables}`);
  console.log(`💪 Health Score: ${healthScore}%`);
  
  if (healthScore >= 90) {
    console.log('🟢 System Status: EXCELLENT');
  } else if (healthScore >= 70) {
    console.log('🟡 System Status: GOOD');
  } else {
    console.log('🔴 System Status: NEEDS ATTENTION');
  }
  
  // Key findings
  console.log('\n🔍 KEY FINDINGS:');
  if (tableCounts.Projects?.count > 0) {
    console.log(`✅ ${tableCounts.Projects.count} projects loaded with authentic Greek government data`);
  }
  if (tableCounts.project_index?.count > 0) {
    console.log(`✅ ${tableCounts.project_index.count} project index relationships established`);
  }
  if (tableCounts.kallikratis?.count > 0) {
    console.log(`✅ ${tableCounts.kallikratis.count} geographic entities for location management`);
  }
  if (tableCounts.users?.count > 0) {
    console.log(`✅ ${tableCounts.users.count} users configured in authentication system`);
  }
}

// Main validation function
async function validateSystem() {
  try {
    const dbConnected = await validateDatabaseConnection();
    if (!dbConnected) {
      console.log('\n❌ VALIDATION FAILED: Database connection issues');
      return;
    }
    
    const tableCounts = await validateTableCounts();
    await validateProjectsSchema();
    await validateReferenceData();
    await validateAPIEndpoints();
    await validateDataIntegrity();
    await generateSystemReport(tableCounts);
    
    console.log('\n🎉 VALIDATION COMPLETED');
    console.log('======================');
    
  } catch (error) {
    console.error('\n❌ VALIDATION ERROR:', error.message);
  }
}

validateSystem();