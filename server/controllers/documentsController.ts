import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument, User } from "@shared/schema";
import { authenticateSession } from '../auth';
import { DocumentFormatter } from '../utils/DocumentFormatter';

interface AuthRequest extends Request {
  user?: User;
}

interface DocumentQueryParams {
  unit?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountFrom?: string;
  amountTo?: string;
  user?: string;
}

const router = Router();

// List documents with filters
router.get('/', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    console.log('[Documents] Starting document fetch request');

    // Log query parameters
    console.log('[Documents] Query parameters:', req.query);

    // Test Supabase connection first
    const { data: testData, error: testError } = await supabase
      .from('generated_documents')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('[Documents] Supabase connection test failed:', testError);
      throw testError;
    }

    console.log('[Documents] Supabase connection test successful');

    // Build main query
    let query = supabase
      .from('generated_documents')
      .select(`
        id,
        unit,
        project_id,
        project_na853,
        expenditure_type,
        status,
        recipients,
        total_amount,
        created_at,
        updated_at
      `);

    // Apply filters if they exist
    if (req.query.unit && req.query.unit !== 'all') {
      query = query.eq('unit', req.query.unit);
    }
    if (req.query.status && req.query.status !== 'all') {
      query = query.eq('status', req.query.status);
    }

    // Always order by created_at descending
    query = query.order('created_at', { ascending: false });

    console.log('[Documents] Executing main query...');

    const { data, error } = await query;

    if (error) {
      console.error('[Documents] Query error:', error);
      throw error;
    }

    console.log('[Documents] Query successful:', {
      count: data?.length || 0,
      sample: data?.[0] ? { id: data[0].id, unit: data[0].unit } : null
    });

    return res.json(data || []);
  } catch (error) {
    console.error('[Documents] Error fetching documents:', error);
    return res.status(500).json({
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single document
router.get('/:id', authenticateSession, async (req: AuthRequest, res: Response) => {
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
    if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
      return res.status(403).json({ error: 'Access denied to this document' });
    }

    res.json(document);
  } catch (error) {
    console.error('[Documents] Error fetching document:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document
router.patch('/:id', authenticateSession, async (req: AuthRequest, res: Response) => {
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
router.patch('/generated/:id/protocol', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { protocol_number, protocol_date } = req.body;

    console.log('[Documents] Updating protocol for document:', id, {
      protocol_number,
      protocol_date
    });

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
    if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
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
      console.error('[Documents] Protocol update error:', updateError);
      throw updateError;
    }

    console.log('[Documents] Protocol updated successfully for document:', id);
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

// Create document
router.post('/', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
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

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([{
        unit,
        project_id,
        project_na853: projectData.na853,
        expenditure_type,
        status: 'pending', // Always set initial status to pending
        recipients: recipients.map((r: any) => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        })),
        total_amount: parseFloat(String(total_amount)) || 0,
        generated_by: req.user.id,
        department: req.user.department,
        attachments: attachments || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('[Documents] Creation error:', error);
      return res.status(500).json({
        message: 'Failed to create document',
        error: error.message
      });
    }

    // If attachments were provided, create attachment records
    if (attachments?.length && data?.id) {
      const { error: attachError } = await supabase
        .from('attachments')
        .insert(
          attachments.map(att => ({
            document_id: data.id,
            file_path: att.path,
            type: att.type,
            created_by: req.user?.id,
            created_at: new Date().toISOString()
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
router.get('/generated/:id/export', authenticateSession, async (req: AuthRequest, res: Response) => {
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
    if (req.user?.role === 'user' && !req.user.units?.includes(document.unit)) {
      return res.status(403).json({ error: 'Access denied to this document' });
    }

    // Prepare document data with user name
    const documentData = {
      ...document,
      user_name: document.generated_by?.name || 'Unknown User'
    };

    // Get unit details
    const unitDetails = await DocumentFormatter.getUnitDetails(document.unit);
    if (!unitDetails) {
      throw new Error('Unit details not found');
    }

    // Create and send document
    const buffer = await DocumentFormatter.generateDocument(documentData, unitDetails);

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

export default router;