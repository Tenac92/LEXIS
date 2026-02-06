// Simple script to check dashboard data relationships
// Run with: node --loader ./scripts/loader.mjs scripts/check-dashboard-data.js

async function checkDashboardData() {
  // Dynamically import the server config
  const { supabase } = await import('../dist/config/db.js');
  
  if (!supabase) {
    console.error('Could not load supabase client');
    process.exit(1);
  }

  console.log('=== Dashboard Data Verification ===\n');

  // 1. Check a sample user
  const { data: sampleUser } = await supabase
    .from('users')
    .select('id, name, role, unit_id')
    .eq('role', 'user')
    .limit(1)
    .single();

  if (!sampleUser) {
    console.log('No users found');
    return;
  }

  console.log('Sample User:', {
    id: sampleUser.id,
    name: sampleUser.name,
    role: sampleUser.role,
    unit_id: sampleUser.unit_id
  });

  const userUnitId = sampleUser.unit_id?.[0];
  if (!userUnitId) {
    console.log('\nUser has no unit assigned');
    return;
  }

  // 2. Check projects for this unit
  const { data: projectsInUnit } = await supabase
    .from('project_index')
    .select('project_id, monada_id')
    .eq('monada_id', userUnitId);

  console.log(`\nProjects in unit ${userUnitId}:`, projectsInUnit?.length || 0);
  if (projectsInUnit && projectsInUnit.length > 0) {
    console.log('Sample projects:', projectsInUnit.slice(0, 5));
  }

  const projectIds = projectsInUnit?.map(p => p.project_id) || [];

  // 3. Check budget data for these projects
  if (projectIds.length > 0) {
    const { data: budgetData } = await supabase
      .from('project_budget')
      .select('id, na853, project_id, user_view')
      .in('project_id', projectIds)
      .limit(5);

    console.log(`\nBudget records for these projects:`, budgetData?.length || 0);
    if (budgetData && budgetData.length > 0) {
      console.log('Sample budget:', budgetData);
    }
  }

  // 4. Check budget history for these projects
  if (projectIds.length > 0) {
    const { data: historyData } = await supabase
      .from('budget_history')
      .select('id, project_id, change_type, created_at')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`\nBudget history for these projects:`, historyData?.length || 0);
    if (historyData && historyData.length > 0) {
      console.log('Sample history:', historyData);
    }
  }

  // 5. Check documents for this unit
  const { data: documents } = await supabase
    .from('generated_documents')
    .select('id, protocol_number_input, unit_id, status')
    .eq('unit_id', userUnitId)
    .limit(5);

  console.log(`\nDocuments for unit ${userUnitId}:`, documents?.length || 0);
  if (documents && documents.length > 0) {
    console.log('Sample documents:', documents);
  }

  // 6. Check for cross-unit data leaks
  console.log('\n=== Checking for Data Leaks ===');
  
  const { data: allBudgetData } = await supabase
    .from('project_budget')
    .select('id, project_id')
    .limit(10);

  const allProjectIds = allBudgetData?.map(b => b.project_id).filter(Boolean) || [];
  
  if (allProjectIds.length > 0) {
    const { data: projectUnits } = await supabase
      .from('project_index')
      .select('project_id, monada_id')
      .in('project_id', allProjectIds);

    const unitDistribution = {};
    projectUnits?.forEach(p => {
      unitDistribution[p.monada_id] = (unitDistribution[p.monada_id] || 0) + 1;
    });

    console.log('Unit distribution in project_index:', unitDistribution);
    console.log(`User's unit (${userUnitId}) has ${unitDistribution[userUnitId] || 0} projects`);
  }
}

checkDashboardData().catch(console.error);
