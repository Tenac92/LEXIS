import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import { Document, Packer } from "docx";
import type { GeneratedDocument, User } from "@shared/schema";
import { DocumentFormatter } from "../utils/DocumentFormatter";
import { DocumentValidator } from "../utils/DocumentValidator";

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

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: any) => {
  // For now, we'll allow all requests through since auth is handled by Supabase
  next();
};

const router = Router();

// Define interfaces
interface Recipient {
  lastname: string;
  firstname: string;
  fathername: string;
  amount: number;
  installment: number;
  afm: string;
}


// Document creation route
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount, attachments } = req.body;

    console.log('Received document creation request:', {
      unit,
      project_id,
      expenditure_type,
      recipients: recipients?.length,
      total_amount
    });

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
      console.error('Project fetch error:', projectError);
      return res.status(404).json({ message: 'Project not found' });
    }

    // Create document record
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([{
        unit,
        project_id,
        project_na853: projectData.na853,
        expenditure_type,
        status: status || 'draft',
        recipients: recipients.map(r => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        })),
        total_amount: parseFloat(String(total_amount)) || 0,
        attachments: attachments || [],
        created_at: new Date().toISOString(),
        department: 'ΤΜΗΜΑ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ ΑΠΟΚΑΤΑΣΤΑΣΗΣ & ΕΚΠΑΙΔΕΥΣΗΣ (Π.Α.Ε.)',
        is_correction: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Document creation error:', error);
      return res.status(500).json({
        message: 'Failed to create document',
        error: error.message
      });
    }

    console.log('Document created successfully:', data);
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List documents with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    await listDocuments(req, res);
});

// Get single document
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    await getDocument(req, res);
});

// Update document
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    await updateDocument(req, res);
});

// Export document
router.get('/generated/:id/export', authenticateToken, async (req: AuthRequest, res: Response) => {
    await exportDocument(req, res);
});


// List documents with filters
async function listDocuments(req: AuthRequest, res: Response) {
  try {
    const { 
      status, 
      unit, 
      dateFrom, 
      dateTo, 
      amountFrom, 
      amountTo, 
      user: recipientSearch 
    } = req.query as DocumentQueryParams;

    console.log('Document List Request:', {
      userRole: req.user?.role,
      userUnits: req.user?.units,
      requestedUnit: unit,
      filters: { status, dateFrom, dateTo, amountFrom, amountTo, recipientSearch }
    });

    let query = supabase
      .from('generated_documents')
      .select('*');

    // Filter by unit based on user role
    if (req.user?.role === 'user' && req.user?.units?.length) {
      console.log('Applying user unit filter:', req.user.units[0]);
      query = query.eq('unit', req.user.units[0]);
    } else if (unit && unit !== 'all') {
      console.log('Applying requested unit filter:', unit);
      query = query.eq('unit', unit);
    }

    // Apply other filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (amountFrom && !isNaN(Number(amountFrom))) {
      query = query.gte('total_amount', Number(amountFrom));
    }
    if (amountTo && !isNaN(Number(amountTo))) {
      query = query.lte('total_amount', Number(amountTo));
    }

    if (recipientSearch && recipientSearch !== 'all') {
      query = query.textSearch('recipients', recipientSearch.toString().toLowerCase().trim());
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log('Documents found:', data?.length || 0);

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Get single document
async function getDocument(req: AuthRequest, res: Response) {
  try {
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
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
    console.error('Error fetching document:', error);
    res.status(500).json({ 
      error: 'Failed to fetch document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Update document
async function updateDocument(req: AuthRequest, res: Response) {
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
    console.error('Error updating document:', error);
    res.status(500).json({ 
      error: 'Failed to update document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Export document
async function exportDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
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

    // Get unit details
    const unitDetails = await DocumentFormatter.getUnitDetails(document.unit);
    if (!unitDetails) {
      throw new Error('Unit details not found');
    }

    // Create document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: DocumentFormatter.getDefaultMargins()
          }
        },
        children: [
          await DocumentFormatter.createHeader(document, unitDetails),
          DocumentFormatter.createPaymentTable(document.recipients),
          await DocumentFormatter.createFooter(document)
        ]
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

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
}

export default router;