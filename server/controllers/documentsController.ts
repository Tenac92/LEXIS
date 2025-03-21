import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import { authenticateSession } from '../auth';
import { DocumentManager } from '../utils/DocumentManager';

// Create a single router instance
const router = Router();
const documentManager = new DocumentManager();

// List documents with filters
router.get('/', authenticateSession, async (req: Request, res: Response) => {
  try {
    console.log('[Documents] Starting document fetch request');
    console.log('[Documents] Query parameters:', req.query);

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
    console.error('[Documents] Error fetching documents:', error);
    return res.status(500).json({
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new document
router.post('/', authenticateSession, async (req: Request, res: Response) => {
  try {
    console.log('[Documents] Creating new document:', JSON.stringify(req.body, null, 2));

    const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!recipients?.length || !project_id || !unit || !expenditure_type || !project_mis) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, project_mis, unit, and expenditure_type are required'
      });
    }

    // Get project NA853
    const { data: projectData, error: projectError } = await supabase
      .from('project_catalog')
      .select('na853')
      .eq('mis', project_mis)
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

    // Create document
    const documentPayload = {
      unit,
      project_id,
      project_na853: projectData.na853,
      expenditure_type,
      status: 'pending',
      recipients: formattedRecipients,
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: req.user.id,
      department: req.user.department || null,
      attachments: attachments || [],
      created_at: now,
      updated_at: now
    };

    console.log('[Documents] Document payload:', JSON.stringify(documentPayload, null, 2));

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

    return res.status(201).json(data);
  } catch (error) {
    console.error('[Documents] Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Single export of the router
export { router };