/**
 * Database Schema Analysis Script
 * 
 * This script analyzes the current database structure to understand
 * the exact column names and relationships needed for project_index.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function analyzeTableSchema(tableName) {
  try {
    console.log(`\n=== Analyzing ${tableName} table ===`);
    
    // Get one record to see actual structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      return null;
    }
    
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`${tableName} columns:`, columns.join(', '));
      console.log(`Sample data:`, JSON.stringify(data[0], null, 2));
      return { columns, sampleData: data[0] };
    } else {
      console.log(`${tableName} is empty`);
      return null;
    }
  } catch (error) {
    console.error(`Error analyzing ${tableName}:`, error.message);
    return null;
  }
}

async function checkProjectIndexStructure() {
  try {
    console.log('\n=== Checking project_index table structure ===');
    
    const { data, error } = await supabase
      .from('project_index')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error fetching project_index:', error.message);
      return;
    }
    
    console.log(`project_index has ${data?.length || 0} records`);
    if (data && data.length > 0) {
      console.log('project_index columns:', Object.keys(data[0]).join(', '));
      console.log('Sample data:', JSON.stringify(data[0], null, 2));
    }
  } catch (error) {
    console.error('Error checking project_index:', error.message);
  }
}

async function checkSpecificProject(mis) {
  try {
    console.log(`\n=== Checking project MIS: ${mis} ===`);
    
    // Check if project exists
    const { data: projectData, error: projectError } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', parseInt(mis))
      .single();
    
    if (projectError) {
      console.error('Error fetching project:', projectError.message);
      return;
    }
    
    if (projectData) {
      console.log('Project found, ID:', projectData.id);
      console.log('Project columns:', Object.keys(projectData).join(', '));
      
      // Check if project has any index entries
      const { data: indexData, error: indexError } = await supabase
        .from('project_index')
        .select('*')
        .eq('project_id', projectData.id);
      
      if (indexError) {
        console.error('Error fetching project index:', indexError.message);
      } else {
        console.log(`Project has ${indexData?.length || 0} index entries`);
        if (indexData && indexData.length > 0) {
          console.log('Index entry sample:', JSON.stringify(indexData[0], null, 2));
        }
      }
    }
  } catch (error) {
    console.error('Error checking specific project:', error.message);
  }
}

async function main() {
  console.log('=== DATABASE SCHEMA ANALYSIS ===\n');
  
  // Analyze all relevant tables
  const tables = ['Projects', 'event_types', 'expediture_types', 'Monada', 'kallikratis'];
  
  for (const table of tables) {
    await analyzeTableSchema(table);
  }
  
  // Check project_index structure
  await checkProjectIndexStructure();
  
  // Check specific project
  await checkSpecificProject('5168550');
  
  console.log('\n=== ANALYSIS COMPLETE ===');
}

main().catch(console.error);