/**
 * Test Controller for Document Recipient Secondary Text Feature
 * 
 * This is a temporary controller to help diagnose issues with the secondary_text field
 * in recipient data structures.
 */
import { Request, Response } from 'express';
import { supabase } from '../config/db';

interface TestRecipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  secondary_text?: string;
}

const TABLE_NAME = 'test_secondary_text';

/**
 * POST /api/test/secondary-text
 * Creates a test record with recipients having secondary_text
 */
export const testSecondaryTextEndpoint = async (req: Request, res: Response) => {
  try {
    console.log('[Test] Secondary text test endpoint called');
    console.log('[Test] Request body:', JSON.stringify(req.body, null, 2));
    
    const { recipients } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipients array is required and must have at least one item'
      });
    }
    
    // Ensure the test table exists
    const { error: tableCheckError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .limit(1);
    
    // Create table if it doesn't exist
    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      console.log('[Test] Creating test table for secondary_text testing');
      
      // Create the test table directly using SQL
      const { error: createTableError } = await supabase.rpc('execute_sql', {
        query: `CREATE TABLE ${TABLE_NAME} (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          recipients JSONB
        )`
      });
      
      if (createTableError) {
        console.error('[Test] Error creating test table:', createTableError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to create test table',
          error: createTableError.message
        });
      }
      
      console.log('[Test] Test table created successfully');
    }
    
    // Insert the test data with recipients that have secondary_text
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ recipients })
      .select('id, created_at, recipients');
    
    if (error) {
      console.error('[Test] Error inserting test data:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to insert test data',
        error: error.message
      });
    }
    
    // Check if the secondary_text field was properly saved
    let recipientsWithSecondaryText = 0;
    let savedData = data[0];
    if (savedData && savedData.recipients && Array.isArray(savedData.recipients)) {
      for (const recipient of savedData.recipients) {
        if (recipient.secondary_text) {
          recipientsWithSecondaryText++;
        }
      }
    }
    
    console.log(`[Test] Successfully inserted test data. Recipients with secondary_text: ${recipientsWithSecondaryText}/${recipients.length}`);
    
    return res.status(200).json({
      status: 'success',
      message: 'Test data created successfully',
      data: savedData,
      meta: {
        original_request: recipients,
        recipients_count: recipients.length,
        recipients_with_secondary_text: recipientsWithSecondaryText
      }
    });
  } catch (error: any) {
    console.error('[Test] Unexpected error in secondary text test endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * GET test secondary text
 * Simply reads all test table data to verify stored format
 */
export const getTestSecondaryText = async (_req: Request, res: Response) => {
  try {
    console.log('[Test] Getting secondary text test records');
    
    // Check if table exists first
    const { error: tableCheckError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .limit(1);
    
    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      return res.status(404).json({
        status: 'error',
        message: 'Test table does not exist yet. Please create a test record first.'
      });
    }
    
    // Get all test records, ordered by most recent first
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Test] Error fetching test data:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch test data',
        error: error.message
      });
    }
    
    // Count records with secondary_text
    let recordsWithSecondaryText = 0;
    let totalRecipients = 0;
    
    if (data && data.length > 0) {
      for (const record of data) {
        if (record.recipients && Array.isArray(record.recipients)) {
          totalRecipients += record.recipients.length;
          
          for (const recipient of record.recipients) {
            if (recipient.secondary_text) {
              recordsWithSecondaryText++;
            }
          }
        }
      }
    }
    
    console.log(`[Test] Found ${data.length} test records with ${recordsWithSecondaryText}/${totalRecipients} recipients having secondary_text`);
    
    return res.status(200).json({
      status: 'success',
      message: 'Test data retrieved successfully',
      data,
      meta: {
        total_records: data.length,
        total_recipients: totalRecipients,
        recipients_with_secondary_text: recordsWithSecondaryText
      }
    });
  } catch (error: any) {
    console.error('[Test] Unexpected error in getting secondary text test data:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * GET document by ID with explicit secondary_text check
 */
export const getDocumentSecondaryTextDebug = async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    
    if (!documentId || isNaN(parseInt(documentId))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid document ID is required'
      });
    }
    
    console.log(`[Test] Checking document ${documentId} for secondary_text in recipients`);
    
    // Get document from generated_documents table
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (error) {
      console.error(`[Test] Error fetching document ${documentId}:`, error);
      return res.status(error.code === 'PGRST116' ? 404 : 500).json({
        status: 'error',
        message: error.code === 'PGRST116' ? 'Document not found' : 'Failed to fetch document',
        error: error.message
      });
    }
    
    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    // Extract and analyze the recipients
    let recipientsCount = 0;
    let recipientsWithSecondaryText = 0;
    let secondaryTextExamples: string[] = [];
    
    if (data.recipients && Array.isArray(data.recipients)) {
      recipientsCount = data.recipients.length;
      
      for (const recipient of data.recipients) {
        if (recipient.secondary_text) {
          recipientsWithSecondaryText++;
          secondaryTextExamples.push(recipient.secondary_text);
        }
      }
    }
    
    console.log(`[Test] Document ${documentId} has ${recipientsWithSecondaryText}/${recipientsCount} recipients with secondary_text`);
    
    return res.status(200).json({
      status: 'success',
      message: 'Document analysis complete',
      document: {
        id: data.id,
        protocol_number: data.protocol_number,
        created_at: data.created_at,
        recipients_count: recipientsCount,
        has_secondary_text: recipientsWithSecondaryText > 0,
        secondary_text_count: recipientsWithSecondaryText,
        secondary_text_examples: secondaryTextExamples.slice(0, 3) // Show up to 3 examples
      },
      data: {
        ...data,
        // Include original recipients to compare
        original_recipients: data.recipients
      }
    });
  } catch (error: any) {
    console.error('[Test] Unexpected error in document secondary text debug:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
};