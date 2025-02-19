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
      created_by: req.user?.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentData])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ message: 'Failed to create document' });
  }
});

export default router;