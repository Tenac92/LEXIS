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
    // First, get the expenditure type ID
    const { data: expenditureTypeData, error: expenditureTypeError } = await supabase
      .from('expediture_types')
      .select('id')
      .eq('expediture_types', expenditureType)
      .single();
    
    if (expenditureTypeError) {
      console.log(`[Attachments] Expenditure type not found: ${expenditureType}`);
      return { 
        status: 'success',
        message: 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.',
        attachments: []
      };
    }
    
    const expenditureTypeId = expenditureTypeData.id;
    console.log(`[Attachments] Found expenditure type ID: ${expenditureTypeId} for ${expenditureType}`);
    
    // Fetch attachments that have this expenditure type ID in their array
    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from('attachments')
      .select('id, atachments, expediture_type_id')
      .contains('expediture_type_id', [expenditureTypeId]);
    
    if (attachmentsError) {
      console.error('[Attachments] Error fetching attachments:', attachmentsError);
      return { 
        status: 'success',
        message: 'Σφάλμα κατά την εύρεση συνημμένων.',
        attachments: DEFAULT_ATTACHMENTS
      };
    }
    
    if (attachmentsData && attachmentsData.length > 0) {
      console.log(`[Attachments] Found ${attachmentsData.length} attachments for ${expenditureType}`);
      const attachmentNames = attachmentsData.map(attachment => attachment.atachments);
      
      return { 
        status: 'success',
        attachments: attachmentNames
      };
    }
    
    // Return empty attachments with message if nothing found
    console.log(`[Attachments] No attachments found for ${expenditureType}`);
    return { 
      status: 'success',
      message: 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.',
      attachments: []
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
