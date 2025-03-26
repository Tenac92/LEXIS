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
 * Map Greek letters and other formats to installment numbers
 * The database stores installments as integers (1, 2, 3, etc.)
 */
const INSTALLMENT_MAP: Record<string, number> = {
  'α': 1, 'a': 1, 'first': 1, 'πρώτη': 1, 'α\'': 1, 'a\'': 1, 'Α': 1, 
  'β': 2, 'b': 2, 'second': 2, 'δεύτερη': 2, 'β\'': 2, 'b\'': 2, 'Β': 2, 
  'γ': 3, 'c': 3, 'third': 3, 'τρίτη': 3, 'γ\'': 3, 'c\'': 3, 'Γ': 3,
  'δ': 4, 'd': 4, 'fourth': 4, 'τέταρτη': 4, 'δ\'': 4, 'd\'': 4, 'Δ': 4,
};

/**
 * Parse installment parameter to the numeric format stored in the database
 * @param installment - The installment parameter (can be Greek letter, number, etc.)
 * @returns Parsed installment number (defaults to 1)
 */
function parseInstallment(installment: string | undefined): number {
  if (!installment || installment === 'undefined' || installment === 'null') {
    return 1; // Default to first installment
  }
  
  // Try to parse as number first
  const parsed = parseInt(installment);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  
  // Try to match against known formats (Greek letters, etc.)
  const normalized = installment.toLowerCase();
  if (INSTALLMENT_MAP[normalized] !== undefined) {
    return INSTALLMENT_MAP[normalized];
  }
  
  // Check uppercase Greek letters
  if (INSTALLMENT_MAP[installment] !== undefined) {
    return INSTALLMENT_MAP[installment];
  }
  
  // Default fallback to first installment
  return 1;
}

/**
 * Fetch attachments for a specific expenditure type and installment
 * @param expenditureType - The expenditure type
 * @param installment - The installment number
 * @returns Attachments data
 */
async function fetchAttachments(expenditureType: string, installment: number | string) {
  // Convert string to number if needed
  if (typeof installment === 'string') {
    installment = parseInstallment(installment);
  }
  console.log(`[Attachments] Fetching attachments for type: ${expenditureType}, installment: ${installment}`);
  
  try {
    // Try to fetch specific attachments for this expenditure type and installment
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', expenditureType)  // Note the column name: expediture_type (without 'n')
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
      .eq('expediture_type', 'default')  // Note the column name: expediture_type (without 'n')
      .eq('installment', 1)  // Default is first installment as integer
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
    // Use 1 for default first installment
    const result = await fetchAttachments('default', 1);
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
 * Return attachments for a specific expenditure type (using default installment 1)
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
    // Use 1 for default first installment
    const result = await fetchAttachments(decodedType, 1);
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
