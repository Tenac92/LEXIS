/**
 * Test Controller for Document Recipient Secondary Text Feature
 * 
 * This is a temporary controller to help diagnose issues with the secondary_text field
 * in recipient data structures.
 */
import { Request, Response } from 'express';
import { supabase } from '../config/db';

export const testSecondaryTextEndpoint = async (req: Request, res: Response) => {
  try {
    console.log('[TEST] Secondary text test endpoint received body:', JSON.stringify(req.body, null, 2));
    
    const { recipients } = req.body;
    
    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required'
      });
    }
    
    // Format recipients with explicit handling of secondary_text field
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname || '').trim(),
      lastname: String(r.lastname || '').trim(),
      fathername: String(r.fathername || '').trim(),
      afm: String(r.afm || '').trim(),
      amount: parseFloat(String(r.amount || 0)),
      installment: String(r.installment || 'Α').trim(),
      secondary_text: r.secondary_text ? String(r.secondary_text).trim() : undefined
    }));
    
    console.log('[TEST] Formatted recipients array:', JSON.stringify(formattedRecipients, null, 2));
    
    // Create a test record in the database to verify storage
    const testPayload = {
      test_id: `test-${Date.now()}`,
      created_at: new Date().toISOString(),
      recipients: formattedRecipients
    };
    
    console.log('[TEST] Inserting test payload:', JSON.stringify(testPayload, null, 2));
    
    const { data, error } = await supabase
      .from('test_recipients')
      .insert([testPayload])
      .select('*')
      .single();
      
    if (error) {
      // If table doesn't exist, try using a different table or just return the data without storing
      if (error.code === '42P01') { // relation does not exist
        console.log('[TEST] Table not found, using generated_documents_debug table');
        
        // Try with generated_documents table but with debug prefix to avoid confusion
        const { data: debugData, error: debugError } = await supabase
          .from('generated_documents_debug')
          .insert([{
            unit: 'TEST',
            mis: 'TEST-MIS',
            expenditure_type: 'TEST TYPE',
            status: 'test',
            recipients: formattedRecipients,
            total_amount: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select('id, recipients')
          .single();
          
        if (debugError) {
          console.error('[TEST] Secondary table error:', debugError);
          
          // If that also fails, don't actually store, just return the formatted data
          return res.status(200).json({
            success: true,
            message: 'Tables do not exist, but formatting successful',
            debug: {
              input: recipients,
              formatted: formattedRecipients
            }
          });
        }
        
        console.log('[TEST] Debug insert successful:', debugData);
        return res.status(200).json({
          success: true,
          message: 'Test data stored in debug table',
          data: debugData
        });
      }
      
      console.error('[TEST] Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message,
        details: error.details
      });
    }
    
    console.log('[TEST] Test record created successfully:', data);
    
    // Compare the original and retrieved data to verify secondary_text preservation
    const retrievedRecipients = data.recipients;
    const secondaryTextPresent = retrievedRecipients.some((r: any) => r.secondary_text !== undefined);
    
    res.status(200).json({
      success: true,
      message: 'Test completed successfully',
      hasSecondaryText: secondaryTextPresent,
      original: formattedRecipients,
      stored: retrievedRecipients
    });
    
  } catch (error) {
    console.error('[TEST] Unexpected error:', error);
    res.status(500).json({
      success: false,
      message: 'Unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET test secondary text
 * Simply reads all test table data to verify stored format
 */
export const getTestSecondaryText = async (_req: Request, res: Response) => {
  try {
    console.log('[TEST] Getting test secondary text data');
    
    // First try the dedicated test table
    let { data, error } = await supabase
      .from('test_recipients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error && error.code === '42P01') {
      // If table doesn't exist, try the debug table
      console.log('[TEST] Test table not found, checking debug table');
      const { data: debugData, error: debugError } = await supabase
        .from('generated_documents_debug')
        .select('id, recipients, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (debugError) {
        console.error('[TEST] Debug table error:', debugError);
        return res.status(200).json({
          success: true,
          message: 'No test tables exist',
          data: []
        });
      }
      
      data = debugData;
    } else if (error) {
      console.error('[TEST] Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }
    
    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
    
  } catch (error) {
    console.error('[TEST] Unexpected error:', error);
    res.status(500).json({
      success: false,
      message: 'Unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET document by ID with explicit secondary_text check
 */
export const getDocumentSecondaryTextDebug = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('[TEST] Getting document with ID for secondary_text debug:', id);
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID'
      });
    }
    
    // Fetch document with recipients
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();
      
    if (error) {
      console.error('[TEST] Document fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching document',
        error: error.message
      });
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Extract and analyze recipients data
    const recipients = data.recipients;
    const secondaryTextAnalysis = Array.isArray(recipients) 
      ? recipients.map((r: any) => ({
          name: `${r.lastname} ${r.firstname}`,
          hasSecondaryText: 'secondary_text' in r,
          secondaryTextValue: r.secondary_text,
          allFields: Object.keys(r)
        }))
      : [];
      
    res.status(200).json({
      success: true,
      document: {
        id: data.id,
        unit: data.unit,
        expenditure_type: data.expenditure_type,
        created_at: data.created_at
      },
      recipients: {
        count: Array.isArray(recipients) ? recipients.length : 0,
        hasSecondaryText: secondaryTextAnalysis.some(r => r.hasSecondaryText),
        analysis: secondaryTextAnalysis
      }
    });
    
  } catch (error) {
    console.error('[TEST] Unexpected error:', error);
    res.status(500).json({
      success: false, 
      message: 'Unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};