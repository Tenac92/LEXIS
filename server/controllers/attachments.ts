import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import type { Request, Response } from "express";

const router = Router();

// Add a default route that returns generic attachments
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  console.log('[Attachments] Default attachments route accessed');
  
  try {
    // Return default attachments
    res.json({
      status: 'success',
      attachments: ['Διαβιβαστικό', 'ΔΚΑ', 'Πρακτικό παραλαβής', 'Τιμολόγιο']
    });
  } catch (error) {
    console.error('[Attachments] Error in default attachments route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching default attachments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a route for just the type without installment
router.get('/:type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }

    const decodedType = decodeURIComponent(type).trim();
    console.log(`[Attachments] Fetching attachments for type: ${decodedType}, default installment`);
    
    // Default to installment 1
    const parsedInstallment = 1;
    
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', parsedInstallment)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Database error',
        error: error.message 
      });
    }
    
    // Get default attachments if no specific ones found
    if (!data?.attachments?.length) {
      const { data: defaultData } = await supabase
        .from('attachments')
        .select('*')
        .eq('expediture_type', 'default')
        .eq('installment', 1)
        .single();
      
      return res.json({
        status: 'success',
        attachments: defaultData?.attachments || ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }
    
    res.json({
      status: 'success',
      attachments: data.attachments
    });
    
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch attachments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:type/:installment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, installment } = req.params;
    
    if (!type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }

    const decodedType = decodeURIComponent(type).trim();
    
    // Be more flexible with installment format
    let parsedInstallment: number;
    
    if (!installment || installment === 'undefined' || installment === 'null') {
      // Default to installment 1 if not provided
      parsedInstallment = 1;
      console.log(`[Attachments] Using default installment (1) for type: ${decodedType}`);
    } else {
      parsedInstallment = parseInt(installment);
      
      if (isNaN(parsedInstallment)) {
        // Try to parse the installment from other formats
        if (installment.toLowerCase() === 'first' || installment.toLowerCase() === 'πρώτη') {
          parsedInstallment = 1;
        } else if (installment.toLowerCase() === 'second' || installment.toLowerCase() === 'δεύτερη') {
          parsedInstallment = 2;
        } else if (installment.toLowerCase() === 'third' || installment.toLowerCase() === 'τρίτη') {
          parsedInstallment = 3;
        } else {
          // Still couldn't parse it, default to 1
          parsedInstallment = 1;
          console.log(`[Attachments] Falling back to default installment (1) for type: ${decodedType}, received: ${installment}`);
        }
      }
    }
    
    // Ensure we have a valid positive integer
    if (parsedInstallment < 1) {
      parsedInstallment = 1;
    }
    
    console.log(`[Attachments] Fetching attachments for type: ${decodedType}, installment: ${parsedInstallment}`);
  

    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', parsedInstallment)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Database error',
        error: error.message 
      });
    }

    // Get default attachments if no specific ones found
    if (!data?.attachments?.length) {
      const { data: defaultData } = await supabase
        .from('attachments')
        .select('*')
        .eq('expediture_type', 'default')
        .eq('installment', 1)
        .single();

      return res.json({
        status: 'success',
        attachments: defaultData?.attachments || ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }

    res.json({
      status: 'success',
      attachments: data.attachments
    });

  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch attachments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
