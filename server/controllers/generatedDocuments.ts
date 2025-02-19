
import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";

const router = Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount } = req.body;

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({ 
        message: 'Missing required fields'
      });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .insert([{
        unit,
        project_id,
        expenditure_type,
        status: status || 'draft',
        recipients,
        total_amount,
        created_by: req.user?.id
      }])
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
