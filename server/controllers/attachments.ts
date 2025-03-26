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
 * Map various formats to Greek letter installments
 * The database stores installments as Greek letters ('Α', 'Β', 'Γ', 'Δ')
 */
const INSTALLMENT_MAP: Record<string, string> = {
  // Map numbers and various formats to Greek letters
  '1': 'Α', 'a': 'Α', 'α': 'Α', 'first': 'Α', 'πρώτη': 'Α', 'α\'': 'Α', 'a\'': 'Α',
  '2': 'Β', 'b': 'Β', 'β': 'Β', 'second': 'Β', 'δεύτερη': 'Β', 'β\'': 'Β', 'b\'': 'Β',
  '3': 'Γ', 'c': 'Γ', 'γ': 'Γ', 'third': 'Γ', 'τρίτη': 'Γ', 'γ\'': 'Γ', 'c\'': 'Γ',
  '4': 'Δ', 'd': 'Δ', 'δ': 'Δ', 'fourth': 'Δ', 'τέταρτη': 'Δ', 'δ\'': 'Δ', 'd\'': 'Δ',
};

/**
 * Parse installment parameter to the Greek letter format stored in the database
 * @param installment - The installment parameter (can be Greek letter, number, etc.)
 * @returns Parsed installment as Greek letter (defaults to 'Α')
 */
function parseInstallment(installment: string | undefined): string {
  if (!installment || installment === 'undefined' || installment === 'null') {
    return 'Α'; // Default to first installment (Greek capital Alpha)
  }
  
  // Already in correct format (Α, Β, Γ, Δ)
  if (['Α', 'Β', 'Γ', 'Δ'].includes(installment)) {
    return installment;
  }
  
  // Try to match against known formats
  const normalized = installment.toLowerCase();
  if (INSTALLMENT_MAP[normalized]) {
    return INSTALLMENT_MAP[normalized];
  }
  
  // Try to match number to Greek letter
  if (INSTALLMENT_MAP[installment]) {
    return INSTALLMENT_MAP[installment];
  }
  
  // Default fallback to first installment
  console.log(`[Attachments] Unknown installment format: ${installment}, defaulting to 'Α'`);
  return 'Α';
}

/**
 * Fetch attachments for a specific expenditure type and installment
 * @param expenditureType - The expenditure type
 * @param installment - The installment (Greek letter or other format)
 * @returns Attachments data
 */
async function fetchAttachments(expenditureType: string, installment: string) {
  // Convert to Greek letter format for database query
  const greekInstallment = parseInstallment(installment);
  console.log(`[Attachments] Fetching attachments for type: ${expenditureType}, installment: ${greekInstallment}`);
  
  try {
    // Try to fetch specific attachments for this expenditure type and installment
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', expenditureType)  // Note the column name: expediture_type (without 'n')
      .eq('installment', greekInstallment)     // Using Greek letter format (Α, Β, Γ, Δ)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // Not found error is expected
        console.error('[Attachments] Database error:', error);
      }
      console.log(`[Attachments] No attachments found for ${expenditureType}, installment ${greekInstallment}`);
    }
    
    // Return specific attachments if found
    if (data?.attachments?.length) {
      console.log(`[Attachments] Found attachments for ${expenditureType}, installment ${greekInstallment}`);
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
      .eq('installment', 'Α')  // Default is first installment as Greek letter 'Α'
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
    // Use 'Α' for default first installment (Greek letter Alpha)
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
    // Use 'Α' for default first installment (Greek letter Alpha)
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
