/**
 * Check Projects Table Columns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProjectsColumns() {
  try {
    console.log('🔍 Checking Projects table structure...\n');
    
    // Get sample project data
    const { data: project, error } = await supabase
      .from('Projects')
      .select('*')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('📋 Available columns in Projects table:');
    console.log('=====================================');
    
    const columns = Object.keys(project);
    columns.forEach((column, index) => {
      const value = project[column];
      const type = typeof value;
      console.log(`${index + 1}. ${column} (${type}): ${value !== null ? String(value).slice(0, 50) : 'null'}`);
    });
    
    console.log(`\n📊 Total columns: ${columns.length}`);
    
    // Check for duplicated columns that should be removed
    const duplicatedColumns = ['kya', 'fek', 'ada', 'ada_import_sana271', 'ada_import_sana853', 'budget_decision', 'funding_decision', 'allocation_decision'];
    const presentDuplicatedColumns = duplicatedColumns.filter(col => columns.includes(col));
    
    console.log(`\n🔍 Duplicated columns still present: ${presentDuplicatedColumns.length}`);
    if (presentDuplicatedColumns.length > 0) {
      console.log('   - ' + presentDuplicatedColumns.join('\n   - '));
    }
    
    // Check project_history data
    console.log('\n🔍 Checking project_history for this project...');
    const { data: history, error: historyError } = await supabase
      .from('project_history')
      .select('*')
      .eq('project_id', project.id)
      .single();
    
    if (historyError) {
      console.log('⚠️ No project_history found:', historyError.message);
    } else {
      console.log('✅ Project history found');
      console.log('   - Decisions:', history.decisions?.length || 0);
      console.log('   - Formulation:', history.formulation?.length || 0);
      console.log('   - Changes:', history.changes?.length || 0);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkProjectsColumns();