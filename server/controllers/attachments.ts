import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../config/db";

/**
 * Attachments Controller
 * Provides API endpoints for fetching document attachment requirements
 * based on expenditure type and installment number
 */

const router = Router();

// Define fallback attachments if database fails
const DEFAULT_ATTACHMENTS = ['Διαβιβαστικό', 'ΔΚΑ'];

/**
 * Map Greek letters to installment values
 * The database may store installments as letters (e.g., 'Α', 'Β') or numbers
 */
const INSTALLMENT_MAP: Record<string, string> = {
  'α': 'Α', 'a': 'Α', 'first': 'Α', 'πρώτη': 'Α', '1': 'Α', 
  'β': 'Β', 'b': 'Β', 'second': 'Β', 'δεύτερη': 'Β', '2': 'Β',
  'γ': 'Γ', 'c': 'Γ', 'third': 'Γ', 'τρίτη': 'Γ', '3': 'Γ',
  'δ': 'Δ', 'd': 'Δ', 'fourth': 'Δ', 'τέταρτη': 'Δ', '4': 'Δ',
};

/**
 * Parse installment parameter to the format stored in the database
 * @param installment - The installment parameter
 * @returns Parsed installment value (defaults to 'Α')
 */
function parseInstallment(installment: string | undefined): string {
  if (!installment || installment === 'undefined' || installment === 'null') {
    return 'Α'; // Default to first installment
  }
  
  // Try to match against known formats
  const normalized = installment.toLowerCase();
  if (INSTALLMENT_MAP[normalized]) {
    return INSTALLMENT_MAP[normalized];
  }
  
  // If it's already an uppercase Greek letter, use it directly
  if (['Α', 'Β', 'Γ', 'Δ'].includes(installment)) {
    return installment;
  }
  
  // Default fallback to first installment
  return 'Α';
}

/**
 * Fetch attachments for a specific expenditure type and installment
 * @param expenditureType - The expenditure type
 * @param installment - The installment value (e.g. 'Α', 'Β')
 * @returns Attachments data
 */
async function fetchAttachments(expenditureType: string, installment: string) {
  console.log(`[Attachments] Fetching attachments for type: ${expenditureType}, installment: ${installment}`);
  
  try {
    // Try to fetch specific attachments for this expenditure type and installment
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expenditure_type', expenditureType)
      .eq('installment', installment)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // Not found error is expected
        console.error('[Attachments] Database error:', error);
      }
      console.log(`[Attachments] No attachments found for ${expenditureType}, installment ${installment}`);
    }
    
    // Return specific attachments if found
    if (data?.attachments?.length) {
      console.log(`[Attachments] Found attachments for ${expenditureType}, installment ${installment}`);
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
      .eq('expenditure_type', 'default')
      .eq('installment', 'Α')  // Default is first installment with Greek letter
      .single();
    
    if (defaultError) {
      console.error('[Attachments] Error fetching default attachments:', defaultError);
    }
    
    // Return default attachments if found
    if (defaultData?.attachments?.length) {
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
    // Use 'Α' (Greek letter alpha) for default first installment
    const result = await fetchAttachments('default', 'Α');
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
 * Return attachments for a specific expenditure type (using default installment Α)
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
    // Use 'Α' (Greek letter alpha) for default first installment
    const result = await fetchAttachments(decodedType, 'Α');
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
 * Return attachments for a specific expenditure type and installment
 */
router.get('/:type/:installment', async (req: Request, res: Response) => {
  try {
    const { type, installment } = req.params;
    
    if (!type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type is required' 
      });
    }
    
    const decodedType = decodeURIComponent(type).trim();
    const parsedInstallment = parseInstallment(installment);
    
    console.log(`[Attachments] Request received for type: ${decodedType}, parsed installment: ${parsedInstallment}`);
    
    const result = await fetchAttachments(decodedType, parsedInstallment);
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
