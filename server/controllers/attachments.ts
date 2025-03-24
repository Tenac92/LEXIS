import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import type { Request, Response } from "express";

const router = Router();

// Add a default route that returns generic attachments
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  console.log('[Attachments] Default attachments route accessed');
  
  try {
    // Return default attachments from the expenditure_attachments table
    const { data, error } = await supabase
      .from('expenditure_attachments')
      .select('*')
      .eq('expediture_type', 'default')
      .eq('installment', '1')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Database error',
        error: error.message 
      });
    }

    res.json({
      status: 'success',
      attachments: data?.attachments || ['Διαβιβαστικό', 'ΔΚΑ', 'Πρακτικό παραλαβής', 'Τιμολόγιο']
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
    
    // Try with default 'Α' installment first (for Greek)
    const { data: dataA, error: errorA } = await supabase
      .from('expenditure_attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', 'Α')
      .single();
    
    if (!errorA && dataA?.attachments) {
      console.log(`[Attachments] Found attachments for ${decodedType} with installment 'Α':`, dataA.attachments);
      return res.json({
        status: 'success',
        attachments: dataA.attachments
      });
    }
    
    // If not found with 'Α', try with '1'
    const { data, error } = await supabase
      .from('expenditure_attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', '1')
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
    if (!data?.attachments || !Array.isArray(data.attachments) || data.attachments.length === 0) {
      const { data: defaultData } = await supabase
        .from('expenditure_attachments')
        .select('*')
        .eq('expediture_type', 'default')
        .eq('installment', '1')
        .single();
      
      console.log('[Attachments] Using default attachments:', defaultData?.attachments);
      return res.json({
        status: 'success',
        attachments: defaultData?.attachments || ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }
    
    console.log(`[Attachments] Found attachments for ${decodedType}:`, data.attachments);
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
    
    // Fix for Greek alphabet installments 
    let formattedInstallment = installment;
    if (!installment || installment === 'undefined' || installment === 'null') {
      formattedInstallment = 'Α'; // Default to Greek alpha for first installment
      console.log(`[Attachments] Using default installment (Α) for type: ${decodedType}`);
    } else if (installment === '1') {
      formattedInstallment = 'Α';
    } else if (installment === '2') {
      formattedInstallment = 'Β';
    } else if (installment === '3') {
      formattedInstallment = 'Γ';
    } else if (installment === '4') {
      formattedInstallment = 'Δ';
    }
    
    console.log(`[Attachments] Fetching attachments for type: ${decodedType}, installment: ${formattedInstallment}`);
  
    // First try with the formatted installment (e.g., 'Α', 'Β', etc.)
    const { data, error } = await supabase
      .from('expenditure_attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', formattedInstallment)
      .single();

    if (!error && data?.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
      console.log(`[Attachments] Found attachments for ${decodedType}, installment ${formattedInstallment}:`, data.attachments);
      return res.json({
        status: 'success',
        attachments: data.attachments
      });
    }

    // If not found with the formatted installment, try with the original installment
    if (formattedInstallment !== installment) {
      const { data: dataOriginal, error: errorOriginal } = await supabase
        .from('expenditure_attachments')
        .select('*')
        .eq('expediture_type', decodedType)
        .eq('installment', installment)
        .single();

      if (!errorOriginal && dataOriginal?.attachments && Array.isArray(dataOriginal.attachments) && dataOriginal.attachments.length > 0) {
        console.log(`[Attachments] Found attachments with original installment format for ${decodedType}, installment ${installment}:`, dataOriginal.attachments);
        return res.json({
          status: 'success',
          attachments: dataOriginal.attachments
        });
      }
    }

    // Get default attachments if no specific ones found
    console.log(`[Attachments] No specific attachments found for ${decodedType}, installment ${formattedInstallment}. Using defaults.`);
    const { data: defaultData } = await supabase
      .from('expenditure_attachments')
      .select('*')
      .eq('expediture_type', 'default')
      .eq('installment', '1')
      .single();

    return res.json({
      status: 'success',
      attachments: defaultData?.attachments || ['Διαβιβαστικό', 'ΔΚΑ']
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
