import { supabase } from './server/config/db.ts';

async function testBudgetData() {
  console.log('Testing budget data retrieval...');
  
  // Test 1: Check if any budget data exists
  console.log('\n=== TEST 1: Check total budget records ===');
  const { data: allBudgets, error: allBudgetsError } = await supabase
    .from('project_budget')
    .select('*')
    .limit(5);
  
  if (allBudgetsError) {
    console.error('Error fetching all budgets:', allBudgetsError);
  } else {
    console.log(`Found ${allBudgets?.length || 0} total budget records`);
    if (allBudgets && allBudgets.length > 0) {
      console.log('Sample budget record:', allBudgets[0]);
    }
  }
  
  // Test 2: Check for project 29 specifically
  console.log('\n=== TEST 2: Check project 29 budget ===');
  const { data: project29Budget, error: project29Error } = await supabase
    .from('project_budget')
    .select('*')
    .eq('project_id', 29)
    .single();
  
  if (project29Error) {
    console.log('Project 29 budget error:', project29Error.message);
  } else {
    console.log('Project 29 budget data:', project29Budget);
  }
  
  // Test 3: Check for MIS-based lookup
  console.log('\n=== TEST 3: Check MIS-based lookup for "29" ===');
  const { data: misBudget, error: misError } = await supabase
    .from('project_budget')
    .select('*')
    .eq('mis', '29')
    .single();
  
  if (misError) {
    console.log('MIS "29" budget error:', misError.message);
  } else {
    console.log('MIS "29" budget data:', misBudget);
  }
  
  // Test 4: Check project existence
  console.log('\n=== TEST 4: Check if project 29 exists in Projects table ===');
  const { data: project29, error: projectError } = await supabase
    .from('Projects')
    .select('id, mis, na853, project_title')
    .eq('id', 29)
    .single();
  
  if (projectError) {
    console.log('Project 29 error:', projectError.message);
  } else {
    console.log('Project 29 data:', project29);
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

testBudgetData().catch(console.error);