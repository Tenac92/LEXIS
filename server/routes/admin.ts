/**
 * Admin Routes
 * 
 * Secure routes for administrator tasks.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin, authenticateSession, AuthenticatedRequest } from '../authentication';
import { manualQuarterTransitionCheck, processQuarterTransition, manualYearEndClosure } from '../services/schedulerService';
import { createLogger } from '../utils/logger';
import { broadcastAdminOperation } from '../websocket';

const logger = createLogger('AdminRoutes');

export function registerAdminRoutes(router: Router, wss: any) {
  // Admin route group with admin authentication requirement
  const adminRouter = Router();
  adminRouter.use(authenticateSession);
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
      
      broadcastAdminOperation({
        operation: 'quarter_transition',
        status: 'started',
        message: 'Quarter transition check initiated by admin'
      });
      
      const result = await manualQuarterTransitionCheck(wss);
      
      broadcastAdminOperation({
        operation: 'quarter_transition',
        status: 'completed',
        message: 'Quarter transition check completed',
        data: result
      });
      
      return res.status(200).json({
        success: true,
        message: 'Quarter transition check initiated successfully',
        result
      });
    } catch (error) {
      logger.error('[Admin API] Error in manual quarter transition check', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      broadcastAdminOperation({
        operation: 'quarter_transition',
        status: 'error',
        message: errorMessage
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error initiating quarter transition check',
        error: errorMessage
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Error processing forced quarter transition',
        error: errorMessage
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Error getting quarter transition status',
        error: errorMessage
      });
    }
  });
  
  /**
   * Trigger a manual year-end closure
   * POST /api/admin/year-end-closure/run
   */
  adminRouter.post('/year-end-closure/run', async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info('[Admin API] Manual year-end closure requested by admin', { 
        userId: req.user?.id
      });
      
      broadcastAdminOperation({
        operation: 'year_end_closure',
        status: 'started',
        message: 'Year-end closure initiated by admin'
      });
      
      const result = await manualYearEndClosure(wss);
      
      broadcastAdminOperation({
        operation: 'year_end_closure',
        status: result.success ? 'completed' : 'error',
        message: result.message || (result.success ? 'Year-end closure completed' : 'Year-end closure failed'),
        data: result.stats
      });
      
      return res.status(200).json({
        success: result.success,
        message: result.message || 'Year-end closure completed',
        stats: result.stats,
        error: result.error
      });
    } catch (error) {
      logger.error('[Admin API] Error in manual year-end closure', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      broadcastAdminOperation({
        operation: 'year_end_closure',
        status: 'error',
        message: errorMessage
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error processing year-end closure',
        error: errorMessage
      });
    }
  });
  
  /**
   * Get year-end closure status
   * GET /api/admin/year-end-closure/status
   */
  adminRouter.get('/year-end-closure/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const nextYearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // Dec 31 23:59:59
      
      return res.status(200).json({
        success: true,
        current_year: currentYear,
        current_date: currentDate.toISOString(),
        next_scheduled_closure: nextYearEnd.toISOString(),
        days_until_closure: Math.ceil((nextYearEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
      });
    } catch (error) {
      logger.error('[Admin API] Error getting year-end closure status', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Error getting year-end closure status',
        error: errorMessage
      });
    }
  });
  
  // Mount the admin routes
  router.use('/admin', adminRouter);
}