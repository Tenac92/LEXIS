import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";

const router = Router();

// Create new document
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount } = req.body;

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
        status: status || 'draft',
        recipients,
        total_amount: parseFloat(total_amount) || 0,
        generated_by: req.user?.id,
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

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ message: 'Failed to create document' });
  }
});

// Update protocol number and date
router.patch('/:id/protocol', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { protocol_number, protocol_date } = req.body;

    if (!protocol_number || !protocol_date) {
      return res.status(400).json({ 
        success: false,
        message: 'Protocol number and date are required' 
      });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        protocol_number_input: protocol_number,
        protocol_date: protocol_date,
        status: 'approved'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Protocol update error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to update protocol',
        error: error.message 
      });
    }

    return res.json({ 
      success: true,
      message: 'Protocol updated successfully',
      data 
    });
  } catch (error) {
    console.error('Protocol update error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to update protocol',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

export default router;