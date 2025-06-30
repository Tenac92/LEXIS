/**
 * Check Import Status Script
 * 
 * This script checks the status of the project data import
 * and provides statistics about what was imported.
 */

import { createClient } from '@supabase/supabase-js';

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImportStatus() {
  console.log('📊 Checking project import status...\n');
  
  try {
    // Get project count
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, na853, project_title, event_description, budget_na853')
      .order('mis');
      
    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return;
    }
    
    console.log(`✅ Total projects in database: ${projects.length}`);
    
    // Get budget data count
    const { data: budgets, error: budgetsError } = await supabase
      .from('budget_na853_split')
      .select('project_id, na853, ethsia_pistosi');
      
    if (!budgetsError) {
      console.log(`✅ Budget records: ${budgets.length}`);
    }
    
    // Get project index count
    const { data: projectIndex, error: indexError } = await supabase
      .from('project_index')
      .select('project_id');
      
    if (!indexError) {
      console.log(`✅ Project index records: ${projectIndex.length}`);
    }
    
    // Show sample projects
    console.log('\n📋 Sample imported projects:');
    console.log('='.repeat(80));
    
    projects.slice(0, 10).forEach(project => {
      console.log(`MIS: ${project.mis} | NA853: ${project.na853}`);
      console.log(`Title: ${project.project_title?.substring(0, 60)}...`);
      console.log(`Event: ${project.event_description}`);
      console.log(`Budget: €${project.budget_na853 || 'N/A'}`);
      console.log('─'.repeat(40));
    });
    
    // Get statistics
    console.log('\n📈 Import Statistics:');
    console.log('='.repeat(80));
    
    const projectsWithBudget = projects.filter(p => p.budget_na853 && p.budget_na853 > 0);
    console.log(`Projects with budget data: ${projectsWithBudget.length}/${projects.length} (${((projectsWithBudget.length/projects.length)*100).toFixed(1)}%)`);
    
    const totalBudget = projectsWithBudget.reduce((sum, p) => sum + parseFloat(p.budget_na853 || 0), 0);
    console.log(`Total budget amount: €${totalBudget.toLocaleString()}`);
    
    if (projects.length > 0) {
      const misRange = {
        min: Math.min(...projects.map(p => p.mis)),
        max: Math.max(...projects.map(p => p.mis))
      };
      console.log(`MIS code range: ${misRange.min} - ${misRange.max}`);
    }
    
    console.log('\n✅ Import status check completed');
    
  } catch (error) {
    console.error('❌ Error checking import status:', error);
  }
}

// Run the check
checkImportStatus();