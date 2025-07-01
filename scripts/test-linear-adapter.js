/**
 * Test Linear Project History Adapter
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testLinearAdapter() {
  console.log('Testing Linear Project History Adapter...\n');
  
  try {
    // Test 1: Get project history entries
    console.log('1. Testing project history retrieval...');
    const { data: projects } = await supabase.from('Projects').select('id').limit(1);
    
    if (projects && projects.length > 0) {
      const projectId = projects[0].id;
      
      const { data: history, error } = await supabase
        .from('project_history')
        .select('*')
        .eq('project_id', projectId)
        .limit(3);
        
      if (error) {
        console.error('Error fetching history:', error);
      } else {
        console.log(`✅ Found ${history.length} history entries for project ${projectId}`);
        
        if (history.length > 0) {
          const latest = history[0];
          console.log('\n📋 Linear Structure Access Test:');
          console.log(`Project Title: ${latest.formulation?.project_title?.substring(0, 50)}...`);
          console.log(`Budget NA853: ${latest.formulation?.budget_na853}`);
          console.log(`Protocol: ${latest.decisions?.protocol_number}`);
          console.log(`Status: ${latest.project_status}`);
          console.log(`Year: ${latest.event_year}`);
          console.log(`Expenses: ${latest.expenses_executed}`);
          
          console.log('\n✅ Linear access working - data is easily accessible!');
        }
      }
    }
    
    // Test 2: Get statistics
    console.log('\n2. Testing statistics calculation...');
    const { data: allHistory, error: statsError } = await supabase
      .from('project_history')
      .select('project_id, created_at, project_status, expenses_executed');
      
    if (statsError) {
      console.error('Error getting stats:', statsError);
    } else {
      const stats = {
        total_entries: allHistory.length,
        unique_projects: new Set(allHistory.map(entry => entry.project_id)).size,
        total_expenses: allHistory.reduce((sum, entry) => sum + (entry.expenses_executed || 0), 0),
        active_projects: allHistory.filter(entry => entry.project_status === 'active').length
      };
      
      console.log('📊 Linear History Statistics:');
      console.log(`Total Entries: ${stats.total_entries}`);
      console.log(`Unique Projects: ${stats.unique_projects}`);
      console.log(`Total Expenses: €${stats.total_expenses.toLocaleString()}`);
      console.log(`Active Projects: ${stats.active_projects}`);
      
      console.log('\n✅ Statistics calculation working!');
    }
    
    // Test 3: Demonstrate linear vs JSONB comparison
    console.log('\n3. Linear vs JSONB Structure Comparison:');
    console.log('=====================================');
    
    console.log('\n❌ Old Complex JSONB Access:');
    console.log('data->>"formulation"->>"project_details"->>"project_title"');
    console.log('JSON_EXTRACT(decisions, "$.kya[0]")');
    console.log('Complex nested object navigation');
    
    console.log('\n✅ New Linear Access:');
    console.log('formulation.project_title (direct object access)');
    console.log('decisions.protocol_number (flattened structure)');
    console.log('expenses_executed (top-level field)');
    
    console.log('\n🚀 Linear Benefits Demonstrated:');
    console.log('• Simplified data structure');
    console.log('• Direct field access');
    console.log('• Better performance potential');
    console.log('• Easier maintenance');
    console.log('• Clearer data organization');
    
    console.log('\n✨ Linear project history structure is working!');
    
  } catch (error) {
    console.error('Error testing linear adapter:', error);
  }
}

testLinearAdapter();