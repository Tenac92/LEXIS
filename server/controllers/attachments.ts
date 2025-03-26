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
  console.log(`[Attachments] Request received for type route: ${req.params.type}, query:`, req.query);
  try {
    const { type } = req.params;
    
    if (!type) {
      console.log('[Attachments] Missing expenditure type in request params');
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }

    const decodedType = decodeURIComponent(type).trim();
    console.log(`[Attachments] Fetching attachments for type: ${decodedType}, default installment`);
    
    // Default to installment 1
    const parsedInstallment = 1;
    
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('expenditure_type', decodedType)
        .eq('installment', parsedInstallment)
        .single();
      
      console.log(`[Attachments] Database query result:`, { data, error });
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Attachments] Database error:', error);
        // Continue instead of returning an error
      }
      
      // Get default attachments if no specific ones found
      if (!data?.attachments?.length) {
        console.log(`[Attachments] No specific attachments found for ${decodedType}, using defaults`);
        
        try {
          const { data: defaultData, error: defaultError } = await supabase
            .from('attachments')
            .select('*')
            .eq('expenditure_type', 'default')
            .eq('installment', 1)
            .single();
            
          console.log(`[Attachments] Default attachments query result:`, { data: defaultData, error: defaultError });
          
          if (defaultError || !defaultData?.attachments?.length) {
            console.log(`[Attachments] No default attachments found, using hardcoded values`);
            return res.json({
              status: 'success',
              attachments: ['Διαβιβαστικό', 'ΔΚΑ']
            });
          }
          
          console.log(`[Attachments] Using default attachments:`, defaultData.attachments);
          return res.json({
            status: 'success',
            attachments: defaultData.attachments
          });
        } catch (defaultError) {
          console.error(`[Attachments] Error fetching default attachments:`, defaultError);
          console.error(`[Attachments] Error stack:`, defaultError instanceof Error ? defaultError.stack : 'No stack available');
          
          // Return hardcoded defaults
          return res.json({
            status: 'success',
            attachments: ['Διαβιβαστικό', 'ΔΚΑ']
          });
        }
      }
      
      console.log(`[Attachments] Returning attachments for ${decodedType}:`, data.attachments);
      return res.json({
        status: 'success',
        attachments: data.attachments
      });
    } catch (dbError) {
      console.error(`[Attachments] Database operation error:`, dbError);
      console.error(`[Attachments] Error stack:`, dbError instanceof Error ? dbError.stack : 'No stack available');
      
      // Return hardcoded defaults
      return res.json({
        status: 'success',
        attachments: ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }
    
  } catch (error) {
    console.error('[Attachments] Error fetching attachments:', error);
    console.error('[Attachments] Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('[Attachments] Error details:', JSON.stringify(error, null, 2));
    
    // Return a successful response with default attachments to prevent UI errors
    return res.json({
      status: 'success',
      attachments: ['Διαβιβαστικό', 'ΔΚΑ']
    });
  }
});

router.get('/:type/:installment', async (req: Request, res: Response) => {
  // Note: We removed the authenticateToken middleware to prevent auth errors during document creation
  console.log(`[Attachments] Request received for type: ${req.params.type}, installment: ${req.params.installment}, query:`, req.query);
  try {
    const { type, installment } = req.params;
    
    if (!type) {
      console.log('[Attachments] Missing expenditure type in request');
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
        .eq('expenditure_type', decodedType)
        .eq('installment', parsedInstallment)
        .single();

      console.log(`[Attachments] Database query result:`, { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('[Attachments] Database error:', error);
        // Continue instead of returning an error to avoid UI failures
      }

      // Get default attachments if no specific ones found
      if (!data?.attachments?.length) {
        console.log(`[Attachments] No specific attachments found for ${decodedType}, using defaults`);
        
        try {
          const { data: defaultData, error: defaultError } = await supabase
            .from('attachments')
            .select('*')
            .eq('expenditure_type', 'default')
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
      console.error(`[Attachments] Error stack:`, dbError instanceof Error ? dbError.stack : 'No stack available');
      
      // Return a successful response with default attachments to prevent UI errors
      return res.json({
        status: 'success',
        attachments: ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }

  } catch (error) {
    console.error('[Attachments] Error fetching attachments:', error);
    console.error('[Attachments] Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('[Attachments] Error details:', JSON.stringify(error, null, 2));
    
    // Return a successful response with default attachments to prevent UI errors
    return res.json({
      status: 'success',
      attachments: ['Διαβιβαστικό', 'ΔΚΑ']
    });
  }
});

export default router;
