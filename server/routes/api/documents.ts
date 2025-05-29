/**
 * Documents API Routes
 * Centralizes all document-related endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../../config/db';
import { log } from '../../vite';
import { AuthenticatedRequest } from '../../authentication';
import { 
  User, 
  insertGeneratedDocumentSchema, 
  GeneratedDocument,
  generatedDocuments
} from '@shared/schema';
import { BudgetService } from '../../services/budgetService';
import { validateBudgetAllocation } from '../../services/budgetNotificationService';
import { DocumentManager } from '../../utils/DocumentManager';
import { createWebSocketServer } from '../../websocket';
import { eq } from 'drizzle-orm';
import { enforceUnitAccess, filterByUserUnits, getUnitAbbreviation } from '../../middleware/unitAccessControl';

// Document manager instance
const documentManager = new DocumentManager();

// Create router
const router = Router();

/**
 * Get all documents with optional filtering
 * GET /api/documents
 */
router.get('/', enforceUnitAccess, async (req: AuthenticatedRequest, res: Response) => {
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
    
    if (status) filters.status = status;
    
    // User role-based filtering - enforce unit access control
    if (req.user?.role !== 'admin') {
      // Regular users can only see documents from their units
      const userUnits = req.user?.units || [];
      if (userUnits.length === 0) {
        return res.status(403).json({ message: 'Δεν έχετε εκχωρημένες μονάδες' });
      }
      
      // Filter by user's units - if specific unit requested, validate it's in user's units
      if (unit && typeof unit === 'string' && userUnits.includes(unit)) {
        filters.unit = [unit];
      } else {
        filters.unit = userUnits;
      }
    } else {
      // Admins can see all units, but if unit specified, filter by it
      if (unit) filters.unit = [unit];
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
 * Get documents for the current user with unit-based filtering
 * GET /api/documents/user
 */
router.get('/user', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        message: 'Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.' 
      });
    }
    
    // Get user's units for filtering - this is the critical security requirement
    const userUnits = req.user.units || [];
    if (userUnits.length === 0) {
      log(`[Documents] User ${req.user.id} has no assigned units`, 'warn');
      return res.status(200).json([]);
    }
    
    log(`[Documents] Fetching documents for user ${req.user.id}, authorized units: ${userUnits.join(', ')}`, 'debug');
    
    // Fetch real documents from database with proper user/unit filtering
    const { data: documents, error } = await supabase
      .from('generated_documents')
      .select('*')
      .in('unit', userUnits)
      .eq('generated_by', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log(`[Documents] Database error: ${error.message}`, 'error');
      return res.status(500).json({ 
        message: 'Error fetching documents',
        error: error.message 
      });
    }

    // Format documents for frontend
    const formattedDocuments = documents?.map(doc => ({
      id: doc.id,
      title: doc.title || `Έγγραφο ${doc.id}`,
      status: doc.status,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      unit: doc.unit,
      total_amount: doc.total_amount,
      expenditure_type: doc.expenditure_type,
      recipients: doc.recipients
    })) || [];
    
    log(`[Documents] SECURITY: Returning ${formattedDocuments.length} documents from authorized units only`, 'info');
    return res.status(200).json(formattedDocuments);
    
  } catch (error) {
    log(`[Documents] Error: ${error}`, 'error');
    return res.status(200).json([]); // Return empty array to prevent dashboard errors
  }
});

/**
 * Get a specific document by ID
 * GET /api/documents/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    
    // Fetch document data using Supabase
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', parseInt(documentId))
      .single();
    
    if (error || !document) {
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
    
    // Validate document exists using Supabase
    const { data: documents, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', parseInt(documentId))
      .limit(1);
    
    if (error) throw error;
    const document = documents?.[0];
    
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
    
    // Fetch document data using Supabase
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', parseInt(documentId))
      .single();
    
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