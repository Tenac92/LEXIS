import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import type { User } from '@shared/schema';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authenticateSession } from '../auth';
import { authenticateToken } from '../middleware/auth';
import { DocumentManager } from '../utils/DocumentManager';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { broadcastDocumentUpdate } from '../services/websocketService';

// Create the router
export const router = Router();
const documentManager = new DocumentManager();

// Export the router as default
export default router;

/**
 * POST /api/documents
 * Direct document creation route (V1)
 * Priority route that handles document creation from the main application
 */
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[DocumentsController] Document creation request received:', JSON.stringify(req.body));

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { unit, project_id, expenditure_type, recipients, total_amount, attachments } = req.body;

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }

    // Get project NA853
    const { data: projectData, error: projectError } = await supabase
      .from('Projects')
      .select('na853')
      .eq('mis', project_id)
      .single();

    if (projectError || !projectData) {
      return res.status(404).json({ message: 'Project not found', error: projectError?.message });
    }

    // Format recipients data
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname).trim(),
      lastname: String(r.lastname).trim(),
      fathername: String(r.fathername).trim(),
      afm: String(r.afm).trim(),
      amount: parseFloat(String(r.amount)),
      installment: String(r.installment).trim()
    }));

    const now = new Date().toISOString();

    // Create document with exact schema match and set initial status to pending
    const documentPayload = {
      unit,
      project_id,
      project_na853: projectData.na853,
      expenditure_type,
      status: 'pending', // Always set initial status to pending
      recipients: formattedRecipients,
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: req.user.id,
      department: req.user.department || null,
      contact_number: req.user.telephone || null,
      user_name: req.user.name || null,
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };

    console.log('[DocumentsController] Document payload prepared:', documentPayload);

    // Insert into database
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select('id')
      .single();

    if (error) {
      console.error('[DocumentsController] Error creating document:', error);
      return res.status(500).json({ 
        message: 'Error creating document', 
        error: error.message,
        details: error.details
      });
    }

    console.log('[DocumentsController] Document created successfully:', data.id);
    res.status(201).json({ id: data.id });
  } catch (error) {
    console.error('[DocumentsController] Error creating document:', error);
    res.status(500).json({ 
      message: 'Error creating document', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /api/v2-documents
 * Document creation route (V2)
 * Alternative endpoint with different input validation
 */
router.post('/v2', async (req: Request, res: Response) => {
  try {
    console.log('[DocumentsController] V2 Document creation request with body:', req.body);
    
    // Check if there's a session but don't require auth for testing
    console.log('[DocumentsController] V2 Session info:', (req as any).session);
    
    const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [] } = req.body;
    
    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }
    
    // Get project NA853 from Supabase if not provided
    let project_na853 = req.body.project_na853;
    if (!project_na853) {
      console.log('[DocumentsController] V2 Fetching NA853 for project with MIS:', project_id);
      
      try {
        // Look up in the Projects table - using the project_id as the MIS value
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('na853')
          .eq('mis', project_id)
          .single();
        
        if (!projectError && projectData && projectData.na853) {
          // Extract only numeric parts for database compatibility
          const numericNA853 = String(projectData.na853).replace(/\D/g, '');
          if (numericNA853) {
            project_na853 = numericNA853;
            console.log('[DocumentsController] V2 Retrieved and converted NA853 from Projects table:', project_na853);
          } else {
            console.error('[DocumentsController] V2 Could not extract numeric value from NA853:', projectData.na853);
            // Try to use project_mis as numeric fallback
            if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
              project_na853 = req.body.project_mis;
              console.log('[DocumentsController] V2 Using project_mis as numeric fallback:', req.body.project_mis);
            } else {
              // Last resort - use 0 as safe fallback
              project_na853 = '0';
              console.log('[DocumentsController] V2 Using safe numeric fallback: 0');
            }
          }
        } else {
          // If no data found in Projects table, use project_mis as fallback
          if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
            console.log('[DocumentsController] V2 Using project_mis directly as numeric fallback:', req.body.project_mis);
            project_na853 = req.body.project_mis;
          } else {
            console.error('[DocumentsController] V2 Could not find project in Projects table:', projectError);
            return res.status(400).json({ 
              message: 'Project not found in Projects table and no fallback available', 
              error: 'Project NA853 could not be determined'
            });
          }
        }
      } catch (error) {
        console.error('[DocumentsController] V2 Error during project lookup:', error);
        
        // If error happens, use project_mis as numeric fallback if available and valid
        if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
          console.log('[DocumentsController] V2 Using project_mis as numeric fallback due to error:', req.body.project_mis);
          project_na853 = req.body.project_mis;
        } else {
          console.error('[DocumentsController] V2 No valid numeric fallback available');
          // Last resort - use 0 as safe numeric value
          project_na853 = '0';
          console.log('[DocumentsController] V2 Using safe numeric fallback in error handler: 0');
        }
      }
    }
    
    // Format recipients data consistently
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname || '').trim(),
      lastname: String(r.lastname || '').trim(),
      fathername: String(r.fathername || '').trim(),
      afm: String(r.afm || '').trim(),
      amount: parseFloat(String(r.amount || 0)),
      installment: String(r.installment || 'Α').trim()
    }));
    
    const now = new Date().toISOString();
    
    // Create document with exact schema match and default values where needed
    const documentPayload = {
      unit,
      project_id,
      project_na853,
      expenditure_type,
      status: 'pending', // Always set initial status to pending
      recipients: formattedRecipients,
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: (req as any).user?.id || null,
      department: (req as any).user?.department || null,
      contact_number: (req as any).user?.telephone || null,
      user_name: (req as any).user?.name || null,
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };
    
    console.log('[DocumentsController] V2 Document payload prepared:', documentPayload);
    
    // Insert into database
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select('id')
      .single();
    
    if (error) {
      console.error('[DocumentsController] V2 Error creating document:', error);
      return res.status(500).json({ 
        message: 'Error creating document', 
        error: error.message,
        details: error.details
      });
    }
    
    console.log('[DocumentsController] V2 Document created successfully:', data.id);
    res.status(201).json({ id: data.id, message: 'Document created successfully' });
  } catch (error) {
    console.error('[DocumentsController] V2 Error creating document:', error);
    res.status(500).json({ 
      message: 'Error creating document', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// List documents with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Starting document fetch with filters
    const filters = {
      unit: req.query.unit as string,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      amountFrom: req.query.amountFrom ? parseFloat(req.query.amountFrom as string) : undefined,
      amountTo: req.query.amountTo ? parseFloat(req.query.amountTo as string) : undefined,
      recipient: req.query.recipient as string,
      afm: req.query.afm as string
    };

    const documents = await documentManager.loadDocuments(filters);

    return res.json(documents || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single document
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select(`
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name,
          email,
          department,
          telephone
        )
      `)
      .eq('id', parseInt(req.params.id))
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user has access to this document's unit
    //if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
    //  return res.status(403).json({ error: 'Access denied to this document' });
    //}

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the document first to check if it exists
    const { data: existingDoc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('id, unit')
      .eq('id', parseInt(req.params.id))
      .single();

    if (fetchError || !existingDoc) {
      console.error('Document not found:', req.params.id);
      return res.status(404).json({ 
        message: 'Document not found',
        error: fetchError?.message 
      });
    }

    // Update the document
    const { data: document, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Broadcast update to connected clients
    broadcastDocumentUpdate({
      type: 'DOCUMENT_UPDATE',
      documentId: document.id,
      data: document
    });

    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      error: 'Failed to update document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document protocol
router.patch('/generated/:id/protocol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { protocol_number, protocol_date } = req.body;

    // Updating protocol information for document

    if (!protocol_number?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Protocol number is required'
      });
    }

    // Check if protocol_date is present and not empty
    if (!protocol_date || protocol_date === '') {
      return res.status(400).json({
        success: false,
        message: 'Protocol date is required'
      });
    }

    // Get the document first to check access rights
    const { data: document, error: fetchError } = await supabase
      .from('generated_documents')
      .select('unit')
      .eq('id', parseInt(id))
      .single();

    if (fetchError) {
      console.error('Error fetching document for protocol update:', fetchError);
      throw fetchError;
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if user has access to this document's unit
    //if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
    //  return res.status(403).json({
    //    success: false,
    //    message: 'Access denied to this document'
    //  });
    //}

    // Update the document
    const updateData: any = {
      status: 'completed', // Set to completed when protocol is added
      updated_by: req.user?.id
    };

    if (protocol_number && protocol_number.trim() !== '') {
      updateData.protocol_number_input = protocol_number.trim();
    }

    if (protocol_date && protocol_date !== '') {
      updateData.protocol_date = protocol_date;
    }

    const { data: updatedDocument, error: updateError } = await supabase
      .from('generated_documents')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError) {
      console.error('Protocol update error:', updateError);
      throw updateError;
    }

    // Broadcast protocol update to connected clients
    if (updatedDocument) {
      broadcastDocumentUpdate({
        type: 'PROTOCOL_UPDATE',
        documentId: parseInt(id),
        data: updatedDocument
      });
    }

    // Protocol updated successfully
    return res.json({
      success: true,
      message: 'Protocol updated successfully',
      data: updatedDocument
    });
  } catch (error) {
    console.error('Protocol update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update protocol',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new document
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Creating new document with provided data
    const { unit, project_id, expenditure_type, recipients, total_amount, attachments } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }

    // Get project NA853 - try project_catalog first
    let projectData: any = null;
    let projectError: any = null;
    let project_na853: string = '';

    try {
      // First attempt to get from project_catalog
      const result = await supabase
        .from('project_catalog')
        .select('na853')
        .eq('mis', project_id)
        .single();
        
      projectData = result.data;
      projectError = result.error;
      
      if (projectError || !projectData) {
        // If not found in project_catalog, try Projects table
        console.log('[DOCUMENT_CONTROLLER] Looking up project in Projects table using MIS:', project_id);
        
        const projectResult = await supabase
          .from('Projects')
          .select('na853')
          .eq('mis', project_id)
          .single();
          
        if (projectResult.data && projectResult.data.na853) {
          // Found in Projects table
          project_na853 = String(projectResult.data.na853);
          console.log('[DOCUMENT_CONTROLLER] Retrieved NA853 from Projects table:', project_na853);
        } else if (project_id && !isNaN(Number(project_id))) {
          // Use MIS as fallback if it's a number
          project_na853 = project_id;
          console.log('[DOCUMENT_CONTROLLER] Using project_id as numeric fallback:', project_id);
        } else {
          return res.status(404).json({ message: 'Project not found and no valid fallback available' });
        }
      } else {
        // Found in project_catalog
        project_na853 = projectData.na853;
      }
    } catch (error) {
      console.error('[DOCUMENT_CONTROLLER] Error during project lookup:', error);
      
      // If error happens, use project_id as numeric fallback if available and valid
      if (project_id && !isNaN(Number(project_id))) {
        project_na853 = project_id;
      } else {
        return res.status(500).json({ 
          message: 'Error looking up project and no valid fallback available',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Format recipients data
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname).trim(),
      lastname: String(r.lastname).trim(),
      fathername: String(r.fathername || '').trim(),
      afm: String(r.afm).trim(),
      amount: parseFloat(String(r.amount)),
      installment: String(r.installment).trim()
    }));

    const now = new Date().toISOString();

    // Create document with exact schema match and set initial status to pending
    const documentPayload = {
      unit,
      project_id,
      project_na853,
      expenditure_type,
      status: 'pending', // Always set initial status to pending
      recipients: formattedRecipients,
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: req.user.id,
      department: req.user.department || null,
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };

    // Insert document
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select()
      .single();

    if (error) {
      console.error('Document creation error:', error);
      return res.status(500).json({
        message: 'Failed to create document',
        error: error.message
      });
    }

    // Create attachment records if provided
    if (attachments?.length && data?.id) {
      const { error: attachError } = await supabase
        .from('attachments')
        .insert(
          attachments.map((att: any) => ({
            document_id: data.id,
            file_path: att.path,
            type: att.type,
            created_by: req.user?.id,
            created_at: now
          }))
        );

      if (attachError) {
        console.error('Attachment creation error:', attachError);
        // Continue even if attachment creation fails
      }
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export document
router.get('/generated/:id/export', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Get document with user details
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select(`
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name,
          email,
          department,
          telephone
        )
      `)
      .eq('id', parseInt(id))
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access rights
    //if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
    //  return res.status(403).json({ error: 'Access denied to this document' });
    //}

    // Prepare document data with user name and contact information
    const documentData = {
      ...document,
      user_name: document.generated_by?.name || 'Unknown User',
      department: document.generated_by?.department || '',
      contact_number: document.generated_by?.telephone || ''
    };

    // Get unit details
    const unitDetails = await DocumentFormatter.getUnitDetails(document.unit);
    if (!unitDetails) {
      throw new Error('Unit details not found');
    }

    // Create and send document
    const documentFormatter = new DocumentFormatter();
    const buffer = await documentFormatter.formatOrthiEpanalipsi({
      originalDocument: documentData,
      comments: 'Διόρθωση στοιχείων',
      project_id: document.project_id || '',
      project_na853: document.project_na853 || '',
      protocol_number_input: document.protocol_number_input || '',
      protocol_date: document.protocol_date || '',
      unit: document.unit || '',
      expenditure_type: document.expenditure_type || '',
      recipients: document.recipients || [],
      total_amount: document.total_amount || 0
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});