import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import type { User } from '@shared/schema';
import type { AuthenticatedRequest } from "../authentication"
import { authenticateSession } from "../authentication"
import { DocumentGenerator } from '../utils/document-generator';
import { broadcastDocumentUpdate } from '../services/websocketService';
import JSZip from 'jszip';

// Create the router
export const router = Router();

// Export the router as default
export default router;

/**
 * POST /api/documents
 * Direct document creation route (V1)
 * Priority route that handles document creation from the main application
 */
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Request logging removed for cleaner console output

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { unit, project_id, expenditure_type, recipients, total_amount, attachments, esdian_field1, esdian_field2 } = req.body;

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }

    // Get project data with enhanced information using optimized schema
    const [projectRes, eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('Projects').select('*').eq('mis', project_id).single(),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('Monada').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    if (projectRes.error || !projectRes.data) {
      return res.status(404).json({ message: 'Project not found', error: projectRes.error?.message });
    }

    const projectData = projectRes.data;
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const monadaData = monadaRes.data || [];
    const kallikratisData = kallikratisRes.data || [];
    const indexData = indexRes.data || [];

    // Get enhanced data for this project
    const projectIndexItems = indexData.filter(idx => idx.project_id === projectData.id);
    const eventType = projectIndexItems.length > 0 ? 
      eventTypes.find(et => et.id === projectIndexItems[0].event_types_id) : null;
    const expenditureTypeData = projectIndexItems.length > 0 ? 
      expenditureTypes.find(et => et.id === projectIndexItems[0].expediture_type_id) : null;
    const monadaItem = projectIndexItems.length > 0 ? 
      monadaData.find(m => m.id === projectIndexItems[0].monada_id) : null;
    const kallikratisItem = projectIndexItems.length > 0 ? 
      kallikratisData.find(k => k.id === projectIndexItems[0].kallikratis_id) : null;
    
    // Project data logging removed for cleaner console output

    // Format recipients data
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname).trim(),
      lastname: String(r.lastname).trim(),
      fathername: String(r.fathername).trim(),
      afm: String(r.afm).trim(),
      amount: parseFloat(String(r.amount)),
      installment: String(r.installment).trim(),
      secondary_text: r.secondary_text ? String(r.secondary_text).trim() : undefined
    }));

    const now = new Date().toISOString();

    // Create document with enhanced normalized schema structure
    const documentPayload = {
      // Core document fields
      status: 'pending',
      total_amount: parseFloat(String(total_amount)) || 0,
      esdian: esdian_field1 || esdian_field2 ? [esdian_field1, esdian_field2].filter(Boolean) : [],
      created_at: now,
      updated_at: now,
      
      // Enhanced foreign key relationships
      generated_by: req.user.id,
      unit_id: parseInt(unit), // Foreign key to monada table
      project_index_id: projectIndexItems.length > 0 ? projectIndexItems[0].id : null, // Foreign key to project_index table
      attachments_id: null, // Will be populated after attachment processing
      beneficiary_payments_id: [], // Will be populated after beneficiary processing
    };

    // Payload logging removed for cleaner console output

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

    // Success logging removed for cleaner console output
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
    
    const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [], esdian_field1, esdian_field2 } = req.body;
    
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
        // Look up in the Projects table with optimized schema - using the project_id as the MIS value
        const [projectRes, indexRes] = await Promise.all([
          supabase.from('Projects').select('*').eq('mis', project_id).single(),
          supabase.from('project_index').select('*')
        ]);
        
        const projectData = projectRes.data;
        const projectError = projectRes.error;
        
        if (!projectError && projectData) {
          // First try to use the na853 field directly (this is the column referenced in the FK constraint)
          if (projectData.na853) {
            project_na853 = projectData.na853;
            console.log('[DocumentsController] V2 Retrieved NA853 from Projects table:', project_na853);
          } 
          // If na853 is not available, try budget_na853 as a fallback
          else if (projectData.budget_na853) {
            project_na853 = projectData.budget_na853;
            console.log('[DocumentsController] V2 Using budget_na853 as fallback:', project_na853);
          } 
          // No valid NA853 found in project data
          else {
            console.error('[DocumentsController] V2 No NA853 or budget_na853 available in project data');
            // Try to use project_mis as fallback if available
            if (req.body.project_mis) {
              // Look up project by project_mis using optimized schema
              const { data: projectByMis } = await supabase
                .from('Projects')
                .select('id, mis, na853, budget_na853')
                .eq('mis', req.body.project_mis)
                .single();
              
              if (projectByMis && projectByMis.na853) {
                project_na853 = projectByMis.na853;
                console.log('[DocumentsController] V2 Found NA853 using project_mis lookup:', project_na853);
              } else {
                console.error('[DocumentsController] V2 Could not find valid NA853 for project');
                return res.status(400).json({ 
                  message: 'No valid NA853 found for the specified project', 
                  error: 'Project NA853 could not be determined'
                });
              }
            } else {
              console.error('[DocumentsController] V2 No project_mis provided for fallback lookup');
              return res.status(400).json({ 
                message: 'No valid NA853 found and no project_mis provided for fallback', 
                error: 'Project NA853 could not be determined'
              });
            }
          }
        } else {
          // If no data found in Projects table
          console.error('[DocumentsController] V2 Could not find project in Projects table:', projectError);
          return res.status(400).json({ 
            message: 'Project not found in Projects table', 
            error: 'Project NA853 could not be determined'
          });
        }
      } catch (error) {
        console.error('[DocumentsController] V2 Error during project lookup:', error);
        return res.status(500).json({ 
          message: 'Error during project lookup', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Format recipients data consistently
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname || '').trim(),
      lastname: String(r.lastname || '').trim(),
      fathername: String(r.fathername || '').trim(),
      afm: String(r.afm || '').trim(),
      amount: parseFloat(String(r.amount || 0)),
      installment: String(r.installment || 'Α').trim(),
      secondary_text: r.secondary_text ? String(r.secondary_text).trim() : undefined
    }));
    
    const now = new Date().toISOString();
    
    // Get director signature from Monada table
    let directorSignature = null;
    try {
      const { data: monadaData } = await supabase
        .from('Monada')
        .select('director')
        .eq('id', parseInt(unit))
        .single();
      
      if (monadaData && monadaData.director) {
        directorSignature = monadaData.director;
        console.log('[DocumentsController] V2 Found director signature:', directorSignature);
      }
    } catch (error) {
      console.log('[DocumentsController] V2 Could not fetch director signature:', error);
    }

    // Create document with exact schema match and default values where needed
    const documentPayload = {
      unit_id: parseInt(unit), // Convert unit to unit_id as integer
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: (req as any).user?.id || null,
      status: 'pending', // Always set initial status to pending
      protocol_date: new Date().toISOString().split('T')[0], // Set current date
      protocol_number_input: `${Date.now()}`, // Generate protocol number
      is_correction: false,
      comments: `Document created for project ${project_id}`,
      esdian: esdian_field1 || esdian_field2 ? [esdian_field1, esdian_field2].filter(Boolean) : [],
      director_signature: directorSignature,
      beneficiary_payments_id: [], // Will be populated after beneficiary payments creation
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
    
    // Create beneficiary payments for each recipient
    const beneficiaryPaymentsIds = [];
    try {
      for (const recipient of formattedRecipients) {
        const beneficiaryPayment = {
          document_id: data.id,
          beneficiary_id: null, // Will need to be matched later
          amount: recipient.amount,
          status: 'pending',
          installment: recipient.installment,
          unit_id: parseInt(unit),
          project_id: null, // Will need project lookup
          created_at: now,
          updated_at: now
        };
        
        const { data: paymentData, error: paymentError } = await supabase
          .from('beneficiary_payments')
          .insert([beneficiaryPayment])
          .select('id')
          .single();
        
        if (paymentError) {
          console.error('[DocumentsController] V2 Error creating beneficiary payment:', paymentError);
        } else {
          beneficiaryPaymentsIds.push(paymentData.id);
          console.log('[DocumentsController] V2 Created beneficiary payment:', paymentData.id);
        }
      }
      
      // Update document with beneficiary payments IDs
      if (beneficiaryPaymentsIds.length > 0) {
        const { error: updateError } = await supabase
          .from('generated_documents')
          .update({ beneficiary_payments_id: beneficiaryPaymentsIds })
          .eq('id', data.id);
        
        if (updateError) {
          console.error('[DocumentsController] V2 Error updating document with beneficiary payment IDs:', updateError);
        } else {
          console.log('[DocumentsController] V2 Updated document with beneficiary payment IDs:', beneficiaryPaymentsIds);
        }
      }
    } catch (beneficiaryError) {
      console.error('[DocumentsController] V2 Error creating beneficiary payments:', beneficiaryError);
    }
    
    res.status(201).json({ 
      id: data.id, 
      message: 'Document created successfully',
      beneficiary_payments_count: beneficiaryPaymentsIds.length
    });
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
      unit_id: req.query.unit ? parseInt(req.query.unit as string) : undefined,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      amountFrom: req.query.amountFrom ? parseFloat(req.query.amountFrom as string) : undefined,
      amountTo: req.query.amountTo ? parseFloat(req.query.amountTo as string) : undefined,
      recipient: req.query.recipient as string,
      afm: req.query.afm as string
    };

    // Get documents from database directly
    let query = supabase
      .from('generated_documents')
      .select('*');

    // Apply filters only if they exist
    if (filters.unit_id) {
      query = query.eq('unit_id', filters.unit_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        message: 'Database query failed',
        error: error.message
      });
    }

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
    if (req.user?.role === 'user' && !req.user.unit_id?.includes(document.unit_id)) {
      return res.status(403).json({ error: 'Access denied to this document' });
    }

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
    if (req.user?.role === 'user' && !req.user.unit_id?.includes(document.unit_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this document'
      });
    }

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
        .select('budget_na853')
        .eq('mis', project_id)
        .single();
        
      projectData = result.data;
      projectError = result.error;
      
      if (projectError || !projectData) {
        // If not found in project_catalog, try Projects table
        console.log('[DOCUMENT_CONTROLLER] Looking up project in Projects table using MIS:', project_id);
        
        const projectResult = await supabase
          .from('Projects')
          .select('id, mis, na853, budget_na853')
          .eq('mis', project_id)
          .single();
          
        if (projectResult.data) {
          if (projectResult.data.na853) {
            // Found na853 in Projects table - use this as it matches the foreign key constraint
            project_na853 = String(projectResult.data.na853);
            console.log('[DOCUMENT_CONTROLLER] Retrieved na853 from Projects table:', project_na853);
          } else if (projectResult.data.budget_na853) {
            // Fall back to budget_na853 if na853 is not available
            project_na853 = String(projectResult.data.budget_na853);
            console.log('[DOCUMENT_CONTROLLER] Retrieved budget_na853 from Projects table:', project_na853);
          }
        } else if (project_id && !isNaN(Number(project_id))) {
          // Use MIS as fallback if it's a number
          project_na853 = project_id;
          console.log('[DOCUMENT_CONTROLLER] Using project_id as numeric fallback:', project_id);
        } else {
          return res.status(404).json({ message: 'Project not found and no valid fallback available' });
        }
      } else {
        // Found in project_catalog
        project_na853 = projectData.budget_na853;
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
      installment: String(r.installment).trim(),
      secondary_text: r.secondary_text ? String(r.secondary_text).trim() : undefined
    }));

    const now = new Date().toISOString();

    // Create document with exact schema match and set initial status to pending
    const documentPayload = {
      unit_id: parseInt(unit), // Convert unit to unit_id as integer
      mis: project_id, 
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
  // Check format parameter to see if user wants both documents in a ZIP
  const format = req.query.format as string;
  const generateBoth = format === 'both' || format === 'zip';

  console.log('[DocumentsController] Export request for document ID:', id, 'Format:', format, 'Generate both:', generateBoth);

  try {
    // Get document with user details including gender and specialty
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select(`
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name,
          email,
          department,
          telephone,
          details
        )
      `)
      .eq('id', parseInt(id))
      .single();

    if (error) {
      console.error('[DocumentsController] Database query error:', error);
      throw error;
    }

    console.log('[DocumentsController] Raw document from database:', JSON.stringify(document, null, 2));

    if (!document) {
      console.error('[DocumentsController] Document not found:', id);
      return res.status(404).json({ error: 'Document not found' });
    }

    // Prepare document data with user name and contact information
    const documentData = {
      ...document,
      user_name: document.generated_by?.name || 'Unknown User',
      department: document.generated_by?.department || '',
      contact_number: document.generated_by?.telephone || ''
    };

    console.log('[DocumentsController] Document data prepared for export:', documentData.id);
    console.log('[DocumentsController] ESDIAN Debug - Raw ESDIAN field:', document.esdian);
    console.log('[DocumentsController] ESDIAN Debug - ESDIAN type:', typeof document.esdian);
    console.log('[DocumentsController] ESDIAN Debug - ESDIAN is array:', Array.isArray(document.esdian));

    // If generating a single document (old behavior)
    if (!generateBoth) {
      console.log('[DocumentsController] Generating single document for export');
      
      // For regular documents, use the standard document generation
      const primaryBuffer = await DocumentGenerator.generatePrimaryDocument(documentData);
      
      // Set response headers for DOCX file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=document-${id}.docx`);
      res.send(primaryBuffer);
      return;
    }
    
    // If we're here, the user wants both documents in a ZIP file
    console.log('[DocumentsController] Generating both documents for ZIP export');
    
    // Generate primary document
    const primaryBuffer = await DocumentGenerator.generatePrimaryDocument(documentData);
    
    // Generate secondary document
    const { SecondaryDocumentFormatter } = await import('../utils/secondary-document-formatter');
    const secondaryBuffer = await SecondaryDocumentFormatter.generateSecondDocument(documentData);
    
    // Create a ZIP file containing both documents
    const zip = new JSZip();
    
    // Add both documents to the ZIP
    zip.file(`document-primary-${document.id.toString().padStart(6, '0')}.docx`, primaryBuffer);
    zip.file(`document-supplementary-${document.id.toString().padStart(6, '0')}.docx`, secondaryBuffer);
    
    // Generate the ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Set response headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=documents-${id}.zip`);
    res.send(zipBuffer);
    console.log('[DocumentsController] ZIP file with both documents sent successfully');

  } catch (error) {
    console.error('[DocumentsController] Export error:', error);
    res.status(500).json({
      error: 'Failed to export document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});