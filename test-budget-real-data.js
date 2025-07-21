import { createClient } from '@supabase/supabase-js';

console.log('Testing budget fetching for projects with real data...');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rlzrtiufwxlljrtmpwsr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function testBudgetData() {
  console.log('\n=== Testing Budget Data Fetching ===');
  
  // Test projects that should have real budget data based on CSV
  const testProjects = [
    { id: 43, mis: 5203811, description: 'Should have €423,118.87 in q2, €400,000 katanomes' },
    { id: 16, mis: 5203814, description: 'Should have €215,498.68 in q2, €215,000 katanomes' },
    { id: 142, mis: 5203848, description: 'Should have €1,254,353.53 in q2, €1,250,000 katanomes' },
    { id: 29, mis: 5174712, description: 'Should have NO budget data (testing fallback)' }
  ];
  
  for (const project of testProjects) {
    console.log(`\n--- Testing Project ${project.id} (MIS: ${project.mis}) ---`);
    console.log(`Expected: ${project.description}`);
    
    try {
      // Test direct database query
      const { data, error } = await supabase
        .from('project_budget')
        .select('*')
        .eq('mis', project.mis)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`✓ No budget data found (expected for projects without allocations)`);
        } else {
          console.log(`✗ Database error:`, error);
        }
      } else if (data) {
        console.log(`✓ FOUND REAL BUDGET DATA:`, {
          ethsia_pistosi: data.ethsia_pistosi,
          katanomes_etous: data.katanomes_etous,
          q1: data.q1,
          q2: data.q2,
          q3: data.q3,
          q4: data.q4,
          user_view: data.user_view,
          available_budget: data.katanomes_etous - (data.user_view || 0)
        });
      }
      
      // Test API endpoint
      console.log(`Testing API endpoint /api/budget/data/${project.mis}...`);
      const response = await fetch(`http://localhost:3000/api/budget/data/${project.mis}`);
      const apiResult = await response.json();
      
      if (response.ok) {
        console.log(`✓ API Response:`, {
          status: apiResult.status,
          has_real_data: apiResult.data && (apiResult.data.ethsia_pistosi > 0 || apiResult.data.katanomes_etous > 0),
          ethsia_pistosi: apiResult.data?.ethsia_pistosi,
          katanomes_etous: apiResult.data?.katanomes_etous,
          available_budget: apiResult.data?.available_budget
        });
      } else {
        console.log(`✗ API Error:`, apiResult);
      }
      
    } catch (error) {
      console.log(`✗ Test failed:`, error.message);
    }
  }
}

testBudgetData().catch(console.error);