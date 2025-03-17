import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import { broadcastDocumentUpdate } from "../services/websocketService";
import { DocumentManager } from "../utils/DocumentManager";

const router = Router();

// Make sure to export the router at the end of the file
const documentManager = new DocumentManager();

// Create new document
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('Creating document with data:', JSON.stringify(req.body, null, 2));

    const { unit, project_id, expenditure_type, status, recipients, total_amount, attachments } = req.body;

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
      afm: String(r.afm).trim(),
      amount: parseFloat(String(r.amount)),
      installment: parseInt(String(r.installment))
    }));

    const now = new Date().toISOString();

    // Create document with exact schema match
    const documentPayload = {
      unit,
      project_id,
      project_na853: projectData.na853,
      expenditure_type,
      status: status || 'draft',
      recipients: formattedRecipients,
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: req.user.id,
      department: req.user.department || null,
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };

    console.log('Document payload:', JSON.stringify(documentPayload, null, 2));

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
          attachments.map(att => ({
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

    // Broadcast update
    broadcastDocumentUpdate({
      type: 'DOCUMENT_UPDATE',
      documentId: data.id,
      data
    });

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ message: 'Failed to create document' });
  }
});

// Get single generated document
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Generated Documents] Fetching document with ID: ${id}`);

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
      console.error('[Generated Documents] Database query error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch document',
        details: error.message
      });
    }

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Prepare document data with user name
    const documentData = {
      ...document,
      user_name: document.generated_by?.name || 'Unknown User'
    };

    res.json(documentData);
  } catch (error) {
    console.error('[Generated Documents] Error fetching document:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('[Documents] Updating document:', req.params.id, req.body);

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get the document first to check if it exists
    const { data: existingDoc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('id, unit')
      .eq('id', parseInt(req.params.id))
      .single();

    if (fetchError || !existingDoc) {
      console.error('[Documents] Document not found:', req.params.id);
      return res.status(404).json({ 
        message: 'Document not found',
        error: fetchError?.message 
      });
    }

    // Update the document
    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) {
      console.error('[Documents] Update error:', error);
      return res.status(500).json({
        message: 'Failed to update document',
        error: error.message
      });
    }

    // Broadcast update
    broadcastDocumentUpdate({
      type: 'DOCUMENT_UPDATE',
      documentId: parseInt(req.params.id),
      data
    });

    return res.json(data);
  } catch (error) {
    console.error('[Documents] Error updating document:', error);
    return res.status(500).json({
      message: 'Failed to update document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update protocol number and date
router.patch('/:id/protocol', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { protocol_number, protocol_date } = req.body;

    if (!protocol_number || !protocol_date) {
      return res.status(400).json({ 
        success: false,
        message: 'Protocol number and date are required' 
      });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        protocol_number_input: protocol_number,
        protocol_date: protocol_date,
        status: 'approved'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Protocol update error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to update protocol',
        error: error.message 
      });
    }

    // Broadcast the protocol update
    broadcastDocumentUpdate({
      type: 'PROTOCOL_UPDATE',
      documentId: parseInt(id),
      data
    });

    return res.json({ 
      success: true,
      message: 'Protocol updated successfully',
      data 
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// Update the orthi epanalipsi endpoint
router.post('/:id/orthi-epanalipsi', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Controllers] Starting orthi epanalipsi update for document:', id);
    console.log('[Controllers] Request body:', JSON.stringify(req.body, null, 2));

    // Get the original document first
    const { data: existingDoc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !existingDoc) {
      console.error('[Controllers] Original document not found:', id, fetchError);
      return res.status(404).json({ 
        message: 'Original document not found',
        error: fetchError?.message 
      });
    }

    try {
      // Update document and generate orthi epanalipsi
      const result = await documentManager.generateOrthiEpanalipsi({
        ...req.body,
        original_document_id: parseInt(id)
      });

      // Check if we got both document and buffer
      if (!result?.document || !result?.buffer) {
        throw new Error('Failed to generate orthi epanalipsi document');
      }

      // Broadcast update
      broadcastDocumentUpdate({
        type: 'DOCUMENT_UPDATE',
        documentId: parseInt(id),
        data: result.document
      });

      console.log('[Controllers] Orthi epanalipsi updated successfully:', {
        id: result.document.id,
        bufferSize: result.buffer.length
      });

      // Set response headers for Word document download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="orthi-epanalipsi-${id}.docx"`);
      return res.send(result.buffer);

    } catch (generateError) {
      console.error('[Controllers] Error in document generation:', generateError);
      return res.status(500).json({
        message: 'Failed to generate orthi epanalipsi',
        error: generateError instanceof Error ? generateError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('[Controllers] Error handling orthi epanalipsi request:', error);
    return res.status(500).json({
      message: 'Failed to process orthi epanalipsi request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export {router};