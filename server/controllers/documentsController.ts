import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import { authenticateSession } from '../auth';
import { DocumentManager } from '../utils/DocumentManager';

// Create the router
export const router = Router();
const documentManager = new DocumentManager();

// Export the router as default
export default router;

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
      .select()
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
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: document, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date()
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('[Documents] Error updating document:', error);
    res.status(500).json({
      error: 'Failed to update document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document protocol
router.patch('/generated/:id/protocol', async (req: Request, res: Response) => {
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
      console.error('[Documents] Error fetching document:', fetchError);
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
      console.error('[Documents] Protocol update error:', updateError);
      throw updateError;
    }

    // Protocol updated successfully
    return res.json({
      success: true,
      message: 'Protocol updated successfully',
      data: updatedDocument
    });
  } catch (error) {
    console.error('[Documents] Protocol update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update protocol',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new document
router.post('/', async (req: Request, res: Response) => {
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

    // Get project NA853
    const { data: projectData, error: projectError } = await supabase
      .from('project_catalog')
      .select('na853')
      .eq('mis', project_id)
      .single();

    if (projectError || !projectData) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Format recipients data
    const formattedRecipients = recipients.map(r => ({
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
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };

    // Document payload prepared with normalized data and pending status

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select()
      .single();

    if (error) {
      console.error('[Documents] Creation error:', error);
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
          attachments.map(att => ({
            document_id: data.id,
            file_path: att.path,
            type: att.type,
            created_by: req.user?.id,
            created_at: now
          }))
        );

      if (attachError) {
        console.error('[Documents] Attachment creation error:', attachError);
        // Continue even if attachment creation fails
      }
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('[Documents] Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export document
router.get('/generated/:id/export', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Get document with user details
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select(`
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name
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

    // Prepare document data with user name
    const documentData = {
      ...document,
      user_name: document.generated_by?.name || 'Unknown User'
    };

    // Get unit details
    //const unitDetails = await DocumentFormatter.getUnitDetails(document.unit);
    //if (!unitDetails) {
    //  throw new Error('Unit details not found');
    //}

    // Create and send document
    //const buffer = await DocumentFormatter.generateDocument(documentData, unitDetails);

    // Set response headers
    //res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    //res.setHeader('Content-Disposition', `attachment; filename=document-${id}.docx`);
    //res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});