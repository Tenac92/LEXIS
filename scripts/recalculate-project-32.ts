import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateProject32() {
  console.log('\n=== Recalculating Project 32 Budget ===\n');
  
  // Get project_index records for project 32
  const { data: projectIndexRecords, error: indexError } = await supabase
    .from('project_index')
    .select('id')
    .eq('project_id', 32);
    
  if (indexError) {
    console.error('Error fetching project_index:', indexError);
    return;
  }
  
  const projectIndexIds = projectIndexRecords.map(rec => rec.id);
  console.log(`Project Index IDs for project 32:`, projectIndexIds);
  
  // Get all 2026+ documents for these project_index records
  const { data: documents, error: docsError } = await supabase
    .from('generated_documents')
    .select('id, protocol_number_input, total_amount, status, created_at, project_index_id')
    .in('project_index_id', projectIndexIds)
    .in('status', ['approved', 'pending', 'processed'])
    .gte('created_at', '2026-01-01T00:00:00Z');
    
  if (docsError) {
    console.error('Error fetching documents:', docsError);
    return;
  }
  
  console.log(`\nFound ${documents?.length || 0} documents:`);
  let totalAmount = 0;
  documents?.forEach((doc, index) => {
    const amount = parseFloat(doc.total_amount || 0);
    totalAmount += amount;
    console.log(`  ${index + 1}. ID:${doc.id} (project_index:${doc.project_index_id}) - €${amount.toFixed(2)} (${doc.status})`);
  });
  
  console.log(`\nTotal from documents: €${totalAmount.toFixed(2)}`);
  console.log(`This should be the new user_view value.`);
  
  // Get current budget values
  const { data: budget, error: budgetError } = await supabase
    .from('project_budget')
    .select('user_view, katanomes_etous')
    .eq('project_id', 32)
    .single();
    
  if (budgetError || !budget) {
    console.error('Error fetching budget:', budgetError);
    return;
  }
  
  console.log(`\nCurrent budget state:`);
  console.log(`  user_view: €${budget.user_view}`);
  console.log(`  katanomes_etous: €${budget.katanomes_etous}`);
  console.log(`  Available: €${(parseFloat(budget.katanomes_etous) - parseFloat(budget.user_view)).toFixed(2)}`);
  
  if (parseFloat(budget.user_view) !== totalAmount) {
    console.log(`\n⚠️  MISMATCH DETECTED!`);
    console.log(`  user_view (${budget.user_view}) != calculated (${totalAmount})`);
    console.log(`  Difference: €${Math.abs(parseFloat(budget.user_view) - totalAmount).toFixed(2)}`);
    
    // Update the budget to fix it
    console.log(`\n🔧 Updating user_view to correct value...`);
    const { error: updateError } = await supabase
      .from('project_budget')
      .update({ 
        user_view: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', 32);
      
    if (updateError) {
      console.error('Error updating budget:', updateError);
    } else {
      console.log('✅ Budget updated successfully!');
      console.log(`  New available: €${(parseFloat(budget.katanomes_etous) - totalAmount).toFixed(2)}`);
    }
  } else {
    console.log(`\n✅ Budget is already correct!`);
  }
}

recalculateProject32()
  .then(() => {
    console.log('\nRecalculation complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
