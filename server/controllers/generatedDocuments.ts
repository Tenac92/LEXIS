import { Router, Request } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    id: number;
    role?: string;
    units?: string[];
  };
}

const router = Router();

// List generated documents
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status, unit, dateFrom, dateTo } = req.query;
    let query = supabase.from('generated_documents').select('*');

    // Filter by user's assigned units unless they're admin
    if (req.user?.role !== 'admin' && req.user?.units?.length) {
      query = query.in('unit', req.user.units);
    }

    if (status) {
      query = query.eq('status', status);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit);
    }

    // Date filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom as string);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo as string);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      status: 'success',
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// Create new document
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount } = req.body;

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          hasRecipients: !!recipients?.length,
          hasProjectId: !!project_id,
          hasUnit: !!unit,
          hasExpenditureType: !!expenditure_type
        }
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get project NA853 from project catalog
    const { data: projectData, error: projectError } = await supabase
      .from('project_catalog')
      .select('na853')
      .eq('mis', project_id)
      .single();

    if (projectError || !projectData) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const documentData = {
      unit,
      project_id,
      project_na853: projectData.na853,
      expenditure_type,
      status: status || 'draft',
      recipients,
      total_amount: parseFloat(total_amount) || 0,
      generated_by: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentData])
      .select()
      .single();

    if (error) {
      console.error('Document creation error:', error);
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ 
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;