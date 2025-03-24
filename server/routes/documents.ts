import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import { DocumentManager } from '../utils/DocumentManager';

// Create the router
export const router = Router();
const documentManager = new DocumentManager();

// List documents with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Processing document fetch with filters

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
    // Documents retrieved successfully

    res.json(documents);
  } catch (error) {
    console.error('[Documents] Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get single document by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Fetching single document by ID
    
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Document not found' });
    
    // Document retrieved successfully
    res.json(data);
  } catch (error) {
    console.error('[Documents] Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update document
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    // Updating existing document
    
    const { protocol_number, protocol_date, status } = req.body;
    
    const { data, error } = await supabase
      .from('generated_documents')
      .update({ 
        protocol_number, 
        protocol_date, 
        status,
        updated_at: new Date().toISOString() 
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Document updates applied successfully
    res.json(data);
  } catch (error) {
    console.error('[Documents] Error updating document:', error);
    res.status(500).json({ message: 'Error updating document', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create new document
router.post('/', async (req: Request, res: Response) => {
  try {
    // Creating new document with user-submitted data

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

    // Insert into database
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select('id')
      .single();

    if (error) {
      console.error('[Documents] Error creating document:', error);
      return res.status(500).json({ 
        message: 'Error creating document', 
        error: error.message,
        details: error.details
      });
    }

    // Document created successfully with ID
    res.status(201).json({ id: data.id });
  } catch (error) {
    console.error('[Documents] Error creating document:', error);
    res.status(500).json({ 
      message: 'Error creating document', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;