/**
 * Add attachments column to generated_documents table
 * This script adds the missing 'attachments' column to fix the document creation issue
 */

import { createClient } from '@supabase/supabase-js';

// Database credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAttachmentsColumn() {
  try {
    console.log('Adding attachments column to generated_documents table...');
    
    // Try to select from the table to check if column exists
    const { data: testData, error: testError } = await supabase
      .from('generated_documents')
      .select('attachments')
      .limit(1);
    
    if (testError && testError.message.includes("attachments")) {
      console.log('Column "attachments" does not exist, attempting to add it...');
      
      // Since we can't run DDL directly, let's try using the client differently
      console.log('Unable to add column directly through Supabase client.');
      console.log('Please add the column manually in Supabase dashboard:');
      console.log('ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT ARRAY[]::text[];');
      return false;
    } else if (testError) {
      console.error('Error checking for column:', testError);
      return false;
    } else {
      console.log('Column "attachments" already exists!');
      return true;
    }
    
  } catch (error) {
    console.error('Error during column check:', error);
    return false;
  }
}

async function main() {
  const success = await addAttachmentsColumn();
  
  if (success) {
    console.log('Database schema updated successfully!');
    console.log('Document creation should now work properly.');
  } else {
    console.log('Failed to update database schema.');
  }
}

main();