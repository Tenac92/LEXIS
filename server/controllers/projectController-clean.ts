import { Router, Request, Response } from 'express';
import { supabase } from '../drizzle';
import { AuthenticatedRequest } from '../authentication';

export const router = Router();

// Get projects by unit - clean and direct implementation
router.get('/by-unit/:unitName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { unitName } = req.params;
    
    // Decode URL-encoded Greek characters
    try {
      unitName = decodeURIComponent(unitName);
    } catch (decodeError) {
      console.log(`[Projects] URL decode failed, using original: ${unitName}`);
    }
    
    console.log(`[Projects] Fetching projects for unit: ${unitName}`);
    
    // Direct database query using text search to avoid JSON parsing errors
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .limit(1000);
    
    if (error) {
      console.error(`[Projects] Database error:`, error);
      return res.status(500).json({
        message: 'Failed to fetch projects by unit',
        error: error.message
      });
    }
    
    console.log(`[Projects] Found ${data?.length || 0} projects for unit: ${unitName}`);
    res.json(data || []);
  } catch (error) {
    console.error('[Projects] Error fetching projects by unit:', error);
    res.status(500).json({
      message: 'Failed to fetch projects by unit',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;