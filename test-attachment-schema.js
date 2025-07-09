/**
 * Test Attachment Schema Updates & Document Creation
 * Verify that the new attachments schema works correctly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testAttachmentSchema() {
  console.log('🧪 Testing attachment schema updates...');
  
  try {
    // Test 1: Check attachments table structure
    const { data: attachments, error: attachmentError } = await supabase
      .from('attachments')
      .select('*')
      .limit(5);

    if (attachmentError) {
      console.error('❌ Error fetching attachments:', attachmentError);
      return;
    }

    console.log('\n📋 Attachments table structure:');
    if (attachments && attachments.length > 0) {
      console.log(`   Sample attachment:`, attachments[0]);
      console.log(`   Total attachments available: ${attachments.length}`);
    } else {
      console.log('   No attachments found');
    }

    // Test 2: Check generated_documents table structure
    const { data: recentDoc, error: docError } = await supabase
      .from('generated_documents')
      .select('id, attachment_id, project_index_id, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (docError) {
      console.error('❌ Error fetching documents:', docError);
      return;
    }

    console.log('\n📄 Generated documents table structure:');
    if (recentDoc && recentDoc.length > 0) {
      console.log(`   Most recent document:`, recentDoc[0]);
      console.log(`   Has attachment_id field: ${recentDoc[0].attachment_id !== undefined}`);
      console.log(`   Has project_index_id field: ${recentDoc[0].project_index_id !== undefined}`);
    } else {
      console.log('   No documents found');
    }

    // Test 3: Test attachment name to ID mapping
    const testAttachmentNames = [
      'Οι εκδοθείσες αποφάσεις χορήγησης επιδόματος ενοικίου/συγκατοίκησης.',
      'Φωτοτυπίες αστυνομικών ταυτοτήτων των δικαιούχων.',
      'Συγκεντρωτικός  πίνακας των δικαιούχων'
    ];

    console.log('\n🔍 Testing attachment name to ID mapping:');
    const mappedIds = attachments
      .filter(attachment => testAttachmentNames.includes(attachment.atachments))
      .map(attachment => ({ id: attachment.id, name: attachment.atachments }));

    console.log(`   Selected attachment names: ${testAttachmentNames.length}`);
    console.log(`   Mapped to IDs: ${mappedIds.length}`);
    mappedIds.forEach(item => {
      console.log(`   - ID ${item.id}: ${item.name}`);
    });

    // Test 4: Check project_index entries for project 29
    const { data: projectIndex, error: indexError } = await supabase
      .from('project_index')
      .select('*')
      .eq('project_id', 29);

    if (indexError) {
      console.error('❌ Error fetching project index:', indexError);
    } else {
      console.log('\n🏗️ Project index entries for project 29:');
      if (projectIndex && projectIndex.length > 0) {
        projectIndex.forEach(entry => {
          console.log(`   - Index ID: ${entry.id}, Unit: ${entry.monada_id}, Expenditure: ${entry.expediture_type_id}`);
        });
      } else {
        console.log('   No project index entries found');
      }
    }

    console.log('\n✅ Attachment schema test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAttachmentSchema().catch(console.error);