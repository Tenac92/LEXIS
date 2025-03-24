/**
 * Documents API Routes
 * Centralizes all document-related endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, supabase } from '../../data';
import { log } from '../../vite';
import { AuthenticatedRequest } from '../../auth';
import { 
  User, 
  insertGeneratedDocumentSchema, 
  GeneratedDocument,
  generatedDocuments
} from '@shared/schema';
import { BudgetService } from '../../services/budgetService';
import { DocumentManager } from '../../utils/DocumentManager';
import { createWebSocketServer } from '../../websocket';
import { eq } from 'drizzle-orm';

// Document manager instance
const documentManager = new DocumentManager();

// Create router
const router = Router();

/**
 * Get all documents with optional filtering
 * GET /api/documents
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      unit,
      status,
      dateFrom,
      dateTo,
      amountFrom,
      amountTo,
      recipient,
      afm
    } = req.query;
    
    // Build filters based on query parameters
    const filters: Record<string, any> = {};
    
    if (unit) filters.unit = unit;
    if (status) filters.status = status;
    
    // User role-based filtering
    if (req.user?.role !== 'admin') {
      // Regular users can only see documents from their units
      if (!req.user?.units || req.user.units.length === 0) {
        return res.status(403).json({ message: 'No units assigned to user' });
      }
      
      // Apply unit filtering based on user's assigned units
      filters.unit = req.user.units;
    }
    
    log(`[Documents] Fetching documents with filters: ${JSON.stringify(filters)}`, 'db');
    
    // Load documents with filters
    const documents = await documentManager.loadDocuments(filters);
    
    // Return documents
    res.status(200).json(documents);
  } catch (error) {
    log(`[Documents] Error fetching documents: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get a specific document by ID
 * GET /api/documents/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    
    // Fetch document data
    const [document] = await db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, parseInt(documentId)));
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Fetch document fields including recipients
    const documentData = await documentManager.fetchDocumentFields(documentId);
    
    res.status(200).json(documentData);
  } catch (error) {
    log(`[Documents] Error fetching document ${req.params.id}: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a new document
 * POST /api/documents
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    log('[Documents] Document creation request received', 'info');
    
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const {
      unit,
      project_id,
      expenditure_type,
      recipients,
      total_amount,
      region,
      attachments
    } = req.body;
    
    // Basic validation of required fields
    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }
    
    // Get project NA853
    const { data: projectData, error: projectError } = await supabase
      .from('Projects')
      .select('budget_na853')
      .eq('mis', project_id)
      .single();
    
    if (projectError || !projectData) {
      return res.status(404).json({ message: 'Project not found', error: projectError?.message });
    }
    
    // Validate budget
    const validationResult = await BudgetService.validateBudget(project_id, parseFloat(total_amount));
    
    // WARNING: Handle budget validation result
    if (!validationResult.canCreate) {
      return res.status(403).json({
        message: validationResult.message || 'Budget validation failed',
        status: validationResult.status,
        requiresNotification: validationResult.requiresNotification,
        notificationType: validationResult.notificationType
      });
    }
    
    // Prepare document data
    const documentData = {
      unit,
      project_id,
      project_na853: projectData.budget_na853,
      expenditure_type,
      recipients,
      total_amount: parseFloat(total_amount),
      status: 'draft',
      region: region || '',
      department: req.user.department,
      user_name: req.user.name,
      contact_number: req.user.telephone
    };
    
    // Create document
    const result = await documentManager.createDocument(documentData);
    
    // If there are attachments, add them
    if (attachments && attachments.length > 0) {
      await documentManager.addAttachments(result.id.toString(), attachments);
    }
    
    // Return created document
    res.status(201).json(result);
  } catch (error) {
    log(`[Documents] Error creating document: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update an existing document
 * PATCH /api/documents/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const updates = req.body;
    
    // Validate document exists
    const [document] = await db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, parseInt(documentId)));
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Update document
    const updatedDocument = await documentManager.updateDocument(documentId, updates);
    
    res.status(200).json(updatedDocument);
  } catch (error) {
    log(`[Documents] Error updating document ${req.params.id}: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to update document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update document protocol information
 * PATCH /api/documents/:id/protocol
 */
router.patch('/:id/protocol', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const { protocol_number, protocol_date } = req.body;
    
    if (!protocol_number) {
      return res.status(400).json({ message: 'Protocol number is required' });
    }
    
    // Format protocol data
    const protocolData = {
      protocol_number_input: protocol_number,
      protocol_date: protocol_date ? new Date(protocol_date) : new Date(),
      status: 'approved' // Updating protocol means approving the document
    };
    
    // Update document
    const updatedDocument = await documentManager.updateDocument(documentId, protocolData);
    
    res.status(200).json(updatedDocument);
  } catch (error) {
    log(`[Documents] Error updating protocol for document ${req.params.id}: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to update document protocol',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export document to DOCX format
 * GET /api/documents/:id/export
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    
    // Fetch document data
    const [document] = await db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, parseInt(documentId)));
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Get document fields
    const documentData = await documentManager.fetchDocumentFields(documentId);
    
    // TODO: Implement document export logic
    // This would typically involve generating a DOCX file and returning it
    
    res.status(501).json({
      message: 'Document export functionality is not yet implemented',
      documentId,
      documentData
    });
  } catch (error) {
    log(`[Documents] Error exporting document ${req.params.id}: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;