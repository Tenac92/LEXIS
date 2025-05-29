/**
 * Import Documents Script
 * 
 * This script imports generated documents from CSV into the database
 * to ensure the dashboard shows accurate data for each unit.
 */

import fs from 'fs';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function importDocuments() {
  try {
    console.log('Starting document import...');
    
    const csvFile = 'attached_assets/generated_documents_rows (4).csv';
    const records = [];
    
    // Read and parse CSV file
    const parser = fs.createReadStream(csvFile)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }));
    
    for await (const record of parser) {
      // Convert CSV record to database format
      const document = {
        id: parseInt(record.id),
        created_at: record.created_at,
        generated_by: record.generated_by ? parseInt(record.generated_by) : null,
        recipients: record.recipients ? JSON.parse(record.recipients) : [],
        protocol_date: record.protocol_date || null,
        total_amount: record.total_amount ? parseFloat(record.total_amount) : null,
        document_date: record.document_date || null,
        status: record.status || 'pending',
        protocol_number_input: record.protocol_number_input || null,
        expenditure_type: record.expenditure_type,
        mis: record.mis,
        project_na853: record.project_na853,
        unit: record.unit,
        original_protocol_number: record.original_protocol_number || null,
        original_protocol_date: record.original_protocol_date || null,
        is_correction: record.is_correction === 'true',
        department: record.department || null,
        comments: record.comments || null,
        original_document_id: record.original_document_id ? parseInt(record.original_document_id) : null,
        updated_by: record.updated_by ? parseInt(record.updated_by) : null,
        attachments: record.attachments ? JSON.parse(record.attachments) : [],
        updated_at: record.updated_at,
        region: record.region || null
      };
      
      records.push(document);
    }
    
    console.log(`Parsed ${records.length} documents from CSV`);
    
    // Count documents by unit
    const unitCounts = {};
    records.forEach(doc => {
      unitCounts[doc.unit] = (unitCounts[doc.unit] || 0) + 1;
    });
    
    console.log('Documents by unit:');
    Object.entries(unitCounts).forEach(([unit, count]) => {
      console.log(`  ${unit}: ${count} documents`);
    });
    
    // Clear existing documents and insert new ones
    console.log('Clearing existing documents...');
    await supabase.from('generated_documents').delete().neq('id', 0);
    
    console.log('Inserting documents...');
    const { data, error } = await supabase
      .from('generated_documents')
      .insert(records);
    
    if (error) {
      console.error('Error inserting documents:', error);
      return;
    }
    
    console.log('Documents imported successfully!');
    
    // Verify the import
    const { data: verifyData } = await supabase
      .from('generated_documents')
      .select('unit')
      .eq('unit', 'ΔΑΕΦΚ-ΔΕ');
    
    console.log(`Verification: Found ${verifyData?.length || 0} ΔΑΕΦΚ-ΔΕ documents in database`);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

importDocuments();