import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import { broadcastDocumentUpdate } from "../services/websocketService";

const router = Router();

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
      updated_at: now,
      protocol_date: null,
      document_date: null,
      protocol_number_input: null,
      original_protocol_number: null,
      original_protocol_date: null,
      is_correction: false,
      comments: null,
      original_document_id: null,
      updated_by: null
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

export default router;