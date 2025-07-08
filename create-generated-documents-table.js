/**
 * Create Generated Documents Table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function createGeneratedDocumentsTable() {
  console.log('🔨 Creating generated_documents table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.generated_documents (
      id bigserial NOT NULL,
      created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
      generated_by bigint NULL,
      recipients jsonb NOT NULL,
      protocol_date date NULL,
      total_amount numeric(10, 2) NULL,
      document_date date NULL,
      status character varying(50) NULL DEFAULT 'pending'::character varying,
      protocol_number_input text NULL,
      expenditure_type text NULL,
      mis text NULL,
      project_na853 text NULL,
      original_protocol_number character varying(255) NULL,
      original_protocol_date date NULL,
      is_correction boolean NULL DEFAULT false,
      department text NULL,
      comments text NULL,
      original_document_id bigint NULL,
      updated_by text NULL,
      attachments jsonb[] NULL,
      updated_at timestamp with time zone NULL,
      region jsonb NULL,
      esdian text[] NULL,
      director_signature jsonb NULL,
      unit_id integer NULL,
      CONSTRAINT generated_documents_pkey PRIMARY KEY (id),
      CONSTRAINT generated_documents_protocol_number_input_key UNIQUE (protocol_number_input)
    );
    
    -- Add foreign key constraints separately to handle dependencies
    -- Note: We'll skip the foreign keys for now to avoid dependency issues
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });
    
    if (error) {
      console.error('Error creating table:', error);
      return false;
    }
    
    console.log('✅ Generated_documents table created successfully');
    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function main() {
  await createGeneratedDocumentsTable();
}

main().catch(console.error);