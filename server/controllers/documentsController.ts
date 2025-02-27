import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument, User } from "@shared/schema";
import { DocumentFormatter } from "../utils/DocumentFormatter";

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

// Middleware to check auth status
const authenticateToken = (req: AuthRequest, res: Response, next: any) => {
  if (!req.session?.user) {
    console.log('[Documents] No authenticated user found');
    return res.status(401).json({ message: "Authentication required" });
  }
  req.user = req.session.user;
  next();
};

// List documents with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('[Documents] Request received:', {
      query: req.query,
      user: req.user ? { id: req.user.id, role: req.user.role, units: req.user.units } : 'No user'
    });

    // Start building the query
    let query = supabase.from('generated_documents').select();

    // Log the initial query state
    console.log('[Documents] Initial query state');

    // Apply unit filter based on user role
    if (req.user?.role === 'user' && req.user?.units?.length) {
      const userUnit = req.user.units[0];
      console.log('[Documents] Applying user unit filter:', userUnit);
      query = query.eq('unit', userUnit);
    } else {
      const filterUnit = req.query.unit as string;
      if (filterUnit && filterUnit !== 'all') {
        console.log('[Documents] Applying unit filter:', filterUnit);
        query = query.eq('unit', filterUnit);
      }
    }

    // Apply status filter
    const filterStatus = req.query.status as string;
    if (filterStatus && filterStatus !== 'all') {
      console.log('[Documents] Applying status filter:', filterStatus);
      query = query.eq('status', filterStatus);
    }

    // Always order by created_at descending
    query = query.order('created_at', { ascending: false });

    // Execute the query
    console.log('[Documents] Executing query...');
    const { data, error } = await query;

    if (error) {
      console.error('[Documents] Database error:', error);
      throw error;
    }

    console.log('[Documents] Query results:', {
      success: true,
      count: data?.length || 0,
      firstDocument: data?.[0] ? {
        id: data[0].id,
        unit: data[0].unit,
        status: data[0].status
      } : null
    });

    return res.json(data || []);
  } catch (error) {
    console.error('[Documents] Error in list documents:', error);
    return res.status(500).json({
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single document
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

// Export document
router.get('/generated/:id/export', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const { data: document, error } = await supabase
          .from('generated_documents')
          .select()
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
});


// Create document
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount } = req.body;

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
        status: status || 'draft',
        recipients: recipients.map((r: any) => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        })),
        total_amount: parseFloat(String(total_amount)) || 0,
        created_at: new Date().toISOString(),
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

    return res.status(201).json(data);
  } catch (error) {
    console.error('[Documents] Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;