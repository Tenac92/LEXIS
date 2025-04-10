import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../config/db";

/**
 * Attachments Controller
 * Provides API endpoints for fetching document attachment requirements
 * based on expenditure type only (installment is no longer required)
 */

const router = Router();

// Define fallback attachments if database fails
const DEFAULT_ATTACHMENTS = ['Διαβιβαστικό', 'ΔΚΑ'];

/**
 * Fetch attachments for a specific expenditure type
 * @param expenditureType - The expenditure type
 * @returns Attachments data
 */
async function fetchAttachments(expenditureType: string) {
  console.log(`[Attachments] Fetching attachments for type: ${expenditureType}`);
  
  try {
    // Try to fetch specific attachments for this expenditure type
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', expenditureType)  // Note the column name: expediture_type (without 'n')
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // Not found error is expected
        console.error('[Attachments] Database error:', error);
      }
      console.log(`[Attachments] No attachments found for ${expenditureType}`);
    }
    
    // Return specific attachments if found
    if (data?.attachments) {
      console.log(`[Attachments] Found attachments for ${expenditureType}`);
      return { 
        status: 'success',
        attachments: data.attachments 
      };
    }
    
    // Try to fetch default attachments
    console.log(`[Attachments] No specific attachments found for ${expenditureType}, using defaults`);
    const { data: defaultData, error: defaultError } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', 'default')
      .single();
    
    if (defaultError) {
      console.error('[Attachments] Error fetching default attachments:', defaultError);
    }
    
    // Return default attachments if found
    if (defaultData?.attachments) {
      console.log('[Attachments] Using default attachments');
      return { 
        status: 'success',
        attachments: defaultData.attachments 
      };
    }
    
    // Return empty attachments with message if nothing found
    console.log('[Attachments] Falling back to hardcoded default attachments');
    return { 
      status: 'success',
      message: 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.',
      attachments: DEFAULT_ATTACHMENTS
    };
    
  } catch (error) {
    console.error('[Attachments] Error in fetchAttachments:', error);
    // Return fallback attachments on error
    return { 
      status: 'success',
      attachments: DEFAULT_ATTACHMENTS
    };
  }
}

/**
 * GET /api/attachments
 * Return default attachments list
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await fetchAttachments('default');
    res.json(result);
  } catch (error) {
    console.error('[Attachments] Error in default route:', error);
    res.json({
      status: 'success',
      attachments: DEFAULT_ATTACHMENTS
    });
  }
});

/**
 * GET /api/attachments/:type
 * Return attachments for a specific expenditure type
 */
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }
    
    const decodedType = decodeURIComponent(type).trim();
    const result = await fetchAttachments(decodedType);
    res.json(result);
    
  } catch (error) {
    console.error('[Attachments] Error in type route:', error);
    res.json({
      status: 'success',
      attachments: DEFAULT_ATTACHMENTS
    });
  }
});

/**
 * GET /api/attachments/:type/:installment
 * Return attachments for a specific expenditure type
 * This endpoint now ignores the installment parameter for backward compatibility
 */
router.get('/:type/:installment', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }
    
    const decodedType = decodeURIComponent(type).trim();
    console.log(`[Attachments] Request received for type: ${decodedType}, installment parameter ignored`);
    
    const result = await fetchAttachments(decodedType);
    res.json(result);
    
  } catch (error) {
    console.error('[Attachments] Error processing request:', error);
    res.json({
      status: 'success',
      attachments: DEFAULT_ATTACHMENTS
    });
  }
});

export default router;
