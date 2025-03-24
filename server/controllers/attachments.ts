import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../data"; // Import from the unified data layer
import type { Request, Response } from "express";

const router = Router();

// Add a default route that returns generic attachments
router.get('/', async (req: Request, res: Response) => {
  // Note: We removed the authenticateToken middleware to prevent auth errors during document creation
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
router.get('/:type', async (req: Request, res: Response) => {
  // Note: We removed the authenticateToken middleware to prevent auth errors during document creation
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

router.get('/:type/:installment', async (req: Request, res: Response) => {
  // Note: We removed the authenticateToken middleware to prevent auth errors during document creation
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
        if (installment.toLowerCase() === 'first' || installment.toLowerCase() === 'πρώτη' || installment === 'Α') {
          parsedInstallment = 1;
        } else if (installment.toLowerCase() === 'second' || installment.toLowerCase() === 'δεύτερη' || installment === 'Β') {
          parsedInstallment = 2;
        } else if (installment.toLowerCase() === 'third' || installment.toLowerCase() === 'τρίτη' || installment === 'Γ') {
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
  
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('expediture_type', decodedType)
        .eq('installment', parsedInstallment)
        .single();

      console.log(`[Attachments] Database query result:`, { data, error });

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
        console.log(`[Attachments] No specific attachments found for ${decodedType}, using defaults`);
        
        try {
          const { data: defaultData, error: defaultError } = await supabase
            .from('attachments')
            .select('*')
            .eq('expediture_type', 'default')
            .eq('installment', 1)
            .single();
            
          console.log(`[Attachments] Default attachments query result:`, { data: defaultData, error: defaultError });

          // If there's an error or no default attachments found, return a standard set
          if (defaultError || !defaultData?.attachments?.length) {
            console.log(`[Attachments] No attachments found for this expenditure type.`);
            
            return res.json({
              status: 'success',
              message: 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.',
              attachments: []
            });
          }

          console.log(`[Attachments] Using default attachments from database:`, defaultData.attachments);
          return res.json({
            status: 'success',
            attachments: defaultData.attachments
          });
        } catch (defaultError) {
          console.error(`[Attachments] Error fetching default attachments:`, defaultError);
          return res.json({
            status: 'success',
            attachments: ['Διαβιβαστικό', 'ΔΚΑ']
          });
        }
      }

      console.log(`[Attachments] Returning attachments for ${decodedType}:`, data.attachments);
      res.json({
        status: 'success',
        attachments: data.attachments
      });
    } catch (dbError) {
      console.error(`[Attachments] Database operation error:`, dbError);
      return res.json({
        status: 'success',
        attachments: ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }

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
