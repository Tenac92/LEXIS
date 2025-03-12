import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import { broadcastDocumentUpdate } from "../services/websocketService";
import { DocumentManager } from "../utils/DocumentManager";

const router = Router();
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

// Generate orthi epanalipsi
router.post('/:id/orthi-epanalipsi', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Generating orthi epanalipsi for document:', id, req.body);

    // Get the original document first
    const { data: existingDoc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !existingDoc) {
      console.error('Original document not found:', id);
      return res.status(404).json({ 
        message: 'Original document not found',
        error: fetchError?.message 
      });
    }

    // Create new document for orthi epanalipsi
    const orthiDoc = {
      ...req.body,
      original_document_id: parseInt(id),
      is_orthi_epanalipsi: true,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: req.user?.id,
      updated_by: req.user?.id
    };

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([orthiDoc])
      .select()
      .single();

    if (error) {
      console.error('Error creating orthi epanalipsi:', error);
      return res.status(500).json({
        message: 'Failed to create orthi epanalipsi',
        error: error.message
      });
    }

    // Broadcast update
    broadcastDocumentUpdate({
      type: 'DOCUMENT_UPDATE',
      documentId: data.id,
      data
    });

    // Generate the document file
    const docBuffer = await documentManager.generateOrthiEpanalipsi(data);

    // Set response headers for Word document download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="orthi-epanalipsi-${id}.docx"`);
    return res.send(docBuffer);

  } catch (error) {
    console.error('Error generating orthi epanalipsi:', error);
    return res.status(500).json({
      message: 'Failed to generate orthi epanalipsi',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;