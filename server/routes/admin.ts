/**
 * Admin Routes
 * 
 * Secure routes for administrator tasks.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../authentication';
import { manualQuarterTransitionCheck, processQuarterTransition } from '../services/schedulerService';
import { logger } from '../utils/logger';

export function registerAdminRoutes(router: Router, wss: any) {
  // Admin route group with admin authentication requirement
  const adminRouter = Router();
  adminRouter.use(requireAdmin);
  
  /**
   * Trigger a manual quarter transition check and update
   * POST /api/admin/quarter-transition/check
   */
  adminRouter.post('/quarter-transition/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info('[Admin API] Manual quarter transition check requested by admin', { 
        userId: req.user?.id
      });
      
      const result = await manualQuarterTransitionCheck(wss);
      
      return res.status(200).json({
        success: true,
        message: 'Quarter transition check initiated successfully',
        result
      });
    } catch (error) {
      logger.error('[Admin API] Error in manual quarter transition check', error);
      return res.status(500).json({
        success: false,
        message: 'Error initiating quarter transition check',
        error: error.message
      });
    }
  });
  
  /**
   * Force process a quarter transition (for testing or manual intervention)
   * POST /api/admin/quarter-transition/force
   */
  adminRouter.post('/quarter-transition/force', async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Extract quarter from request if provided, otherwise use current date
      const { quarter } = req.body;
      const forceQuarter = quarter ? `q${quarter}` : undefined;
      
      logger.info('[Admin API] Forced quarter transition requested by admin', { 
        userId: req.user?.id,
        forceQuarter
      });
      
      // If forcing a specific quarter, we'd need to extend our processQuarterTransition
      // function to accept a specific quarter parameter
      await processQuarterTransition(wss);
      
      return res.status(200).json({
        success: true,
        message: 'Forced quarter transition processed successfully'
      });
    } catch (error) {
      logger.error('[Admin API] Error in forced quarter transition', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing forced quarter transition',
        error: error.message
      });
    }
  });
  
  /**
   * Get quarter transition status
   * GET /api/admin/quarter-transition/status
   */
  adminRouter.get('/quarter-transition/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get current date and determine the current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const currentQuarterKey = `q${currentQuarterNumber}`;
      
      // For a real implementation, we'd check database for budgets that need updating
      // This is a simplified version
      return res.status(200).json({
        success: true,
        current_quarter: currentQuarterKey,
        current_date: currentDate.toISOString(),
        next_scheduled_check: new Date(
          currentDate.getFullYear(),
          Math.floor(currentMonth / 3) * 3,
          1,
          0, 1, 0
        ).toISOString()
      });
    } catch (error) {
      logger.error('[Admin API] Error getting quarter transition status', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting quarter transition status',
        error: error.message
      });
    }
  });
  
  // Mount the admin routes
  router.use('/admin', adminRouter);
}