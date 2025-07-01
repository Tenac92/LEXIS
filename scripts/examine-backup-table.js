/**
 * Examine JSONB Backup Table Structure
 * 
 * This script examines the actual structure and content of the
 * project_history_jsonb_backup table to understand the data format
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Examine table structure and sample data
 */
async function examineBackupTable() {
  console.log('=== Examining project_history_jsonb_backup Table ===\n');
  
  try {
    // Get sample records to understand structure
    const { data: sampleData, error } = await supabase
      .from('project_history_jsonb_backup')
      .select('*')
      .limit(5);
      
    if (error) {
      console.error('Error fetching sample data:', error);
      return;
    }
    
    console.log(`Found ${sampleData.length} sample records`);
    
    if (sampleData.length === 0) {
      console.log('No data in backup table');
      return;
    }
    
    // Analyze first record structure
    console.log('\n=== Sample Record Structure ===');
    const firstRecord = sampleData[0];
    console.log('Columns and values:');
    console.log('==================');
    
    Object.keys(firstRecord).forEach(key => {
      const value = firstRecord[key];
      const type = typeof value;
      const preview = type === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value;
      
      console.log(`${key}: ${type} = ${preview}`);
    });
    
    // Look for all different change_type values
    console.log('\n=== Change Types Analysis ===');
    const { data: changeTypes, error: changeTypesError } = await supabase
      .from('project_history_jsonb_backup')
      .select('change_type')
      .not('change_type', 'is', null);
      
    if (!changeTypesError && changeTypes) {
      const uniqueChangeTypes = [...new Set(changeTypes.map(ct => ct.change_type))];
      console.log('Unique change_type values:', uniqueChangeTypes);
    }
    
    // Check for JSONB columns
    console.log('\n=== JSONB Columns Analysis ===');
    sampleData.forEach((record, idx) => {
      console.log(`\nRecord ${idx + 1} (Project ${record.project_id}):`);
      
      Object.keys(record).forEach(key => {
        const value = record[key];
        if (typeof value === 'object' && value !== null) {
          console.log(`  ${key}: JSONB with keys [${Object.keys(value).join(', ')}]`);
          
          // Show nested structure for important JSONB fields
          if (key === 'formulation_metadata' && value) {
            console.log(`    - decision_details: ${value.decision_details?.length || 0} items`);
            console.log(`    - formulation_details: ${value.formulation_details?.length || 0} items`);
            
            if (value.decision_details?.length > 0) {
              const firstDecision = value.decision_details[0];
              console.log(`    - First decision keys: [${Object.keys(firstDecision).join(', ')}]`);
            }
            
            if (value.formulation_details?.length > 0) {
              const firstFormulation = value.formulation_details[0];
              console.log(`    - First formulation keys: [${Object.keys(firstFormulation).join(', ')}]`);
            }
          }
        }
      });
    });
    
    // Check for entries with actual JSONB data
    console.log('\n=== Looking for Records with JSONB Data ===');
    const { data: jsonbRecords, error: jsonbError } = await supabase
      .from('project_history_jsonb_backup')
      .select('project_id, change_type, formulation_metadata')
      .not('formulation_metadata', 'is', null)
      .limit(10);
      
    if (!jsonbError && jsonbRecords) {
      console.log(`Found ${jsonbRecords.length} records with formulation_metadata`);
      
      jsonbRecords.forEach((record, idx) => {
        console.log(`\nJSONB Record ${idx + 1}:`);
        console.log(`  Project: ${record.project_id}`);
        console.log(`  Change Type: ${record.change_type}`);
        if (record.formulation_metadata) {
          console.log(`  Metadata keys: [${Object.keys(record.formulation_metadata).join(', ')}]`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error examining backup table:', error);
  }
}

/**
 * Count total records by type
 */
async function countRecordsByType() {
  console.log('\n=== Record Counts by Type ===');
  
  try {
    // Total count
    const { count: totalCount, error: totalError } = await supabase
      .from('project_history_jsonb_backup')
      .select('*', { count: 'exact', head: true });
      
    if (totalError) {
      console.error('Error counting total:', totalError);
    } else {
      console.log(`Total records: ${totalCount}`);
    }
    
    // Count by change_type
    const { data: changeTypeCounts, error: changeError } = await supabase
      .rpc('get_change_type_counts');
      
    if (changeError) {
      console.log('Cannot get change type counts (RPC function may not exist)');
      
      // Alternative: Get sample of change types
      const { data: sampleTypes, error: sampleError } = await supabase
        .from('project_history_jsonb_backup')
        .select('change_type')
        .limit(50);
        
      if (!sampleError && sampleTypes) {
        const typeCounts = {};
        sampleTypes.forEach(item => {
          const type = item.change_type || 'null';
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        console.log('Sample change type distribution:');
        Object.entries(typeCounts).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error counting records:', error);
  }
}

/**
 * Main examination function
 */
async function main() {
  await examineBackupTable();
  await countRecordsByType();
  
  console.log('\n=== Examination Complete ===');
  console.log('This analysis will help determine the correct migration approach');
}

// Run examination
main().catch(console.error);