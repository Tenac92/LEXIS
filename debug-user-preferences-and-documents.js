/**
 * Debug User Preferences and Document Endpoints
 * Check database tables and test API endpoints
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function checkDocumentTables() {
  console.log('🔍 Checking document-related tables...');
  
  // Check what document tables exist
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .like('table_name', '%document%');
    
  if (error) {
    console.error('Error checking tables:', error);
    return;
  }
  
  console.log('Document tables found:', tables?.map(t => t.table_name) || []);
  
  // Check documents table structure
  try {
    const { data: documentsData, error: docsError } = await supabase
      .from('documents')
      .select('id, esdian, project_na853, expenditure_type, created_at')
      .limit(3);
      
    if (docsError) {
      console.error('Error querying documents table:', docsError);
    } else {
      console.log('Documents table sample:', documentsData);
    }
  } catch (e) {
    console.log('Documents table might not exist');
  }
  
  // Check generated_documents table if it exists
  try {
    const { data: genDocsData, error: genDocsError } = await supabase
      .from('generated_documents')
      .select('id, esdian, project_na853, expenditure_type, created_at')
      .limit(3);
      
    if (genDocsError) {
      console.error('Error querying generated_documents table:', genDocsError);
    } else {
      console.log('Generated_documents table sample:', genDocsData);
    }
  } catch (e) {
    console.log('Generated_documents table might not exist');
  }
}

async function testUserPreferencesEndpoint() {
  console.log('\n🧪 Testing user preferences endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/user-preferences/esdian?project_id=2024ΝΑ85300121&expenditure_type=ΔΚΑ+ΑΥΤΟΣΤΕΓΑΣΗ', {
      headers: {
        'Cookie': 'sid=s%3AOKwWPia9MQUSHG2od5oGLm50KheCrVD3.W2yx3weLMVftmnpQi5CoLgs7XvWM6L8zsUnrWYIc0rU',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.text();
    console.log('User preferences response:', response.status, data);
  } catch (error) {
    console.error('Error testing user preferences:', error);
  }
}

async function testDocumentCreation() {
  console.log('\n🧪 Testing document creation endpoint...');
  
  const testPayload = {
    unit: 2,
    project_id: "2024ΝΑ85300121",
    expenditure_type: "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ",
    recipients: [{
      firstname: "Test",
      lastname: "User",
      fathername: "Father",
      afm: "123456789",
      amount: 12,
      installment: "1"
    }],
    total_amount: 12,
    attachments: [],
    esdian_field1: "ΤΜΗΜΑ ΣΤΕΓΑΣΤΙΚΗΣ ΠΟΛΙΤΙΚΗΣ",
    esdian_field2: ""
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sid=s%3AOKwWPia9MQUSHG2od5oGLm50KheCrVD3.W2yx3weLMVftmnpQi5CoLgs7XvWM6L8zsUnrWYIc0rU'
      },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.text();
    console.log('Document creation response:', response.status, data);
  } catch (error) {
    console.error('Error testing document creation:', error);
  }
}

async function main() {
  await checkDocumentTables();
  await testUserPreferencesEndpoint();
  await testDocumentCreation();
}

main().catch(console.error);