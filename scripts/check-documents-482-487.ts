import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDocuments() {
  console.log('\n=== Checking Documents 482 and 487 ===\n');
  
  const documentIds = [482, 487];
  
  for (const docId of documentIds) {
    const { data: doc, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', docId)
      .single();
      
    if (error || !doc) {
      console.error(`Error fetching document ${docId}:`, error);
      continue;
    }
    
    console.log(`\nDocument ${docId}:`);
    console.log(`  Protocol: ${doc.protocol_number_input}`);
    console.log(`  Project Index ID: ${doc.project_index_id}`);
    console.log(`  Total Amount: €${doc.total_amount}`);
    console.log(`  Status: ${doc.status}`);
    console.log(`  Created At: ${doc.created_at}`);
    console.log(`  Updated At: ${doc.updated_at}`);
    
    // Check if it meets the 2026+ filter criteria
    const createdDate = new Date(doc.created_at);
    const is2026Plus = createdDate >= new Date('2026-01-01T00:00:00Z');
    const hasValidStatus = ['approved', 'pending', 'processed'].includes(doc.status);
    const matchesProjectId = doc.project_index_id === 32;
    
    console.log(`  \n  Meets 2026+ criteria: ${is2026Plus}`);
    console.log(`  Has valid status: ${hasValidStatus}`);
    console.log(`  Matches project 32: ${matchesProjectId}`);
    console.log(`  SHOULD BE COUNTED: ${is2026Plus && hasValidStatus && matchesProjectId}`);
  }
  
  // Also check all documents for project 32 regardless of date
  console.log('\n\n=== All Documents for Project 32 (any date) ===\n');
  const { data: allDocs, error: allError } = await supabase
    .from('generated_documents')
    .select('id, protocol_number_input, total_amount, status, created_at')
    .eq('project_index_id', 32)
    .order('created_at', { ascending: false });
    
  if (allError) {
    console.error('Error fetching all documents:', allError);
  } else {
    console.log(`Found ${allDocs?.length || 0} total documents for project 32:`);
    let total = 0;
    allDocs?.forEach((doc, index) => {
      const amount = parseFloat(doc.total_amount || 0);
      total += amount;
      const createdDate = new Date(doc.created_at);
      const is2026 = createdDate >= new Date('2026-01-01');
      console.log(`  ${index + 1}. ID:${doc.id} ${doc.protocol_number_input} - €${amount.toFixed(2)} (${doc.status}) ${is2026 ? '✓2026+' : '✗pre-2026'} - ${doc.created_at}`);
    });
    console.log(`  \n  TOTAL ALL DOCUMENTS: €${total.toFixed(2)}`);
  }
}

checkDocuments()
  .then(() => {
    console.log('\nCheck complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
