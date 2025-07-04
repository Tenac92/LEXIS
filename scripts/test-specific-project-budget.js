/**
 * Test Specific Project Budget Lookup
 * Debug why project ID 2 (MIS 5174076) is not finding budget data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testSpecificProjectBudget() {
  try {
    console.log('[Test] Testing budget lookup for Project ID 2 (MIS 5174076)...');
    
    // Step 1: Check project exists
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis, na853')
      .eq('id', 2)
      .single();
    
    if (projectError) {
      console.log('[Test] ❌ Project lookup failed:', projectError.message);
      return;
    }
    
    console.log('[Test] ✓ Project found:', project);
    
    // Step 2: Check budget via optimized project_id lookup
    const { data: budget1, error: error1 } = await supabase
      .from('project_budget')
      .select('*')
      .eq('project_id', 2)
      .single();
    
    console.log('[Test] Budget via project_id (OPTIMIZED):', budget1 ? 'FOUND' : 'NOT FOUND');
    if (error1) console.log('[Test] Error:', error1.message);
    
    // Step 3: Check budget via MIS lookup
    const { data: budget2, error: error2 } = await supabase
      .from('project_budget')
      .select('*')
      .eq('mis', 5174076)
      .single();
    
    console.log('[Test] Budget via MIS (legacy):', budget2 ? 'FOUND' : 'NOT FOUND');
    if (error2) console.log('[Test] Error:', error2.message);
    
    // Step 4: Check if any budget exists for this project
    const { data: allBudgets, error: allError } = await supabase
      .from('project_budget')
      .select('id, project_id, mis, na853')
      .or(`project_id.eq.2,mis.eq.5174076,na853.eq.${project.na853}`)
      .limit(5);
    
    console.log('[Test] All matching budgets:', allBudgets);
    if (allError) console.log('[Test] Error:', allError.message);
    
    // Step 5: Check if budget exists with different identifiers
    const { data: budgetByNa853, error: na853Error } = await supabase
      .from('project_budget')
      .select('*')
      .eq('na853', project.na853)
      .single();
    
    console.log('[Test] Budget via NA853:', budgetByNa853 ? 'FOUND' : 'NOT FOUND');
    if (na853Error) console.log('[Test] Error:', na853Error.message);
    
    // Step 6: Show project_id foreign key relationship status
    const { data: budgetWithProject, error: relationError } = await supabase
      .from('project_budget')
      .select(`
        id,
        project_id,
        mis,
        na853,
        Projects!project_budget_project_id_fkey(id, mis, na853)
      `)
      .eq('project_id', 2)
      .single();
    
    console.log('[Test] Budget with project relation:', budgetWithProject);
    if (relationError) console.log('[Test] Relation error:', relationError.message);
    
    // Conclusion
    if (budget1) {
      console.log('[Test] ✅ SUCCESS: Optimized lookup working correctly');
    } else if (budget2 || budgetByNa853) {
      console.log('[Test] ⚠️  ISSUE: Budget exists but project_id relationship missing');
    } else {
      console.log('[Test] ❌ PROBLEM: No budget data exists for this project');
    }
    
  } catch (error) {
    console.error('[Test] Critical error:', error);
  }
}

// Run the test
testSpecificProjectBudget()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[Test] Test failed:', error);
    process.exit(1);
  });