import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProject32Budget() {
  console.log('\n=== Checking Project 32 Budget ===\n');
  
  // Get project details
  const { data: project, error: projectError } = await supabase
    .from('Projects')
    .select('id, mis, na853, project_title')
    .eq('id', 32)
    .single();
    
  if (projectError || !project) {
    console.error('Error fetching project:', projectError);
    return;
  }
  
  console.log('Project Details:');
  console.log(`  ID: ${project.id}`);
  console.log(`  MIS: ${project.mis}`);
  console.log(`  NA853: ${project.na853}`);
  console.log(`  Title: ${project.project_title}\n`);
  
  // Get budget details
  const { data: budget, error: budgetError } = await supabase
    .from('project_budget')
    .select('*')
    .eq('project_id', 32)
    .single();
    
  if (budgetError || !budget) {
    console.error('Error fetching budget:', budgetError);
    return;
  }
  
  console.log('Budget Details:');
  console.log(`  ID: ${budget.id}`);
  console.log(`  Project ID: ${budget.project_id}`);
  console.log(`  MIS: ${budget.mis}`);
  console.log(`  user_view (current spending): €${budget.user_view}`);
  console.log(`  katanomes_etous (allocation): €${budget.katanomes_etous}`);
  console.log(`  ethsia_pistosi (yearly credit): €${budget.ethsia_pistosi}`);
  console.log(`  current_quarter_spent: €${budget.current_quarter_spent}`);
  
  const available = parseFloat(budget.katanomes_etous || 0) - parseFloat(budget.user_view || 0);
  console.log(`  \n  CALCULATED AVAILABLE: €${available.toFixed(2)}`);
  console.log(`  Formula: katanomes_etous (${budget.katanomes_etous}) - user_view (${budget.user_view}) = ${available.toFixed(2)}\n`);
  
  // Get recent budget history
  const { data: history, error: historyError } = await supabase
    .from('budget_history')
    .select('*')
    .eq('project_id', 32)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (historyError) {
    console.error('Error fetching history:', historyError);
  } else {
    console.log(`Recent Budget History (${history?.length || 0} entries):`);
    history?.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.created_at}`);
      console.log(`     Previous: €${entry.previous_amount} → New: €${entry.new_amount}`);
      console.log(`     Type: ${entry.change_type}, Reason: ${entry.change_reason}`);
      console.log(`     Document ID: ${entry.document_id}\n`);
    });
  }
  
  // Get 2026+ documents for this project
  const { data: documents, error: docsError } = await supabase
    .from('generated_documents')
    .select('id, protocol_number_input, total_amount, status, created_at')
    .eq('project_index_id', 32)
    .in('status', ['approved', 'pending', 'processed'])
    .gte('created_at', '2026-01-01T00:00:00Z')
    .order('created_at', { ascending: false });
    
  if (docsError) {
    console.error('Error fetching documents:', docsError);
  } else {
    console.log(`2026+ Documents (${documents?.length || 0} total):`);
    let totalAmount = 0;
    documents?.forEach((doc, index) => {
      const amount = parseFloat(doc.total_amount || 0);
      totalAmount += amount;
      console.log(`  ${index + 1}. ${doc.protocol_number_input} - €${amount.toFixed(2)} (${doc.status}) - ${doc.created_at}`);
    });
    console.log(`  \n  TOTAL FROM DOCUMENTS: €${totalAmount.toFixed(2)}`);
    console.log(`  This should match user_view: €${budget.user_view}\n`);
  }
}

checkProject32Budget()
  .then(() => {
    console.log('Check complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
