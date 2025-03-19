import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import { storage } from "../storage";
import type { User, BudgetValidation } from "@shared/schema";
import { BudgetService } from "../services/budgetService";

interface AuthRequest extends Request {
  user?: User;
}

export const router = Router();

// Get budget notifications
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    console.log('[BudgetController] Fetching notifications...');
    const notifications = await BudgetService.getNotifications();
    console.log('[BudgetController] Successfully fetched notifications:', notifications.length);
    return res.json(notifications);
  } catch (error) {
    console.error('[BudgetController] Error in getBudgetNotifications:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get budget data
router.get('/:mis', async (req: Request, res: Response) => {
  try {
    const { mis } = req.params;
    if (!mis) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS parameter is required'
      });
    }

    const result = await BudgetService.getBudget(mis);
    return res.json(result);
  } catch (error) {
    console.error('Unexpected error in getBudget:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget data'
    });
  }
});

// Validate budget
router.post('/validate', async (req: AuthRequest, res: Response) => {
  try {
    const { mis, amount } = req.body as BudgetValidation;
    const requestedAmount = parseFloat(amount.toString());

    const result = await BudgetService.validateBudget(mis, requestedAmount);

    // If validation requires notification, create it
    if (result.requiresNotification && result.notificationType && req.user?.id) {
      try {
        const budgetData = await storage.getBudgetData(mis);

        await storage.createBudgetHistoryEntry({
          mis,
          previous_amount: budgetData?.user_view?.toString() || '0',
          new_amount: (parseFloat(budgetData?.user_view?.toString() || '0') - requestedAmount).toString(),
          change_type: 'notification_created',
          change_reason: `Budget notification created: ${result.notificationType}`,
          created_by: req.user.id,
          metadata: {
            notification_type: result.notificationType,
            priority: result.priority,
            current_budget: budgetData?.user_view,
            requested_amount: requestedAmount
          }
        });
      } catch (notifError) {
        console.error('Failed to create budget notification:', notifError);
        // Continue with validation response even if notification creation fails
      }
    }

    return res.json(result);
  } catch (error) {
    console.error("Budget validation error:", error);
    return res.status(500).json({ 
      status: 'error',
      canCreate: false,
      message: "Failed to validate budget"
    });
  }
});

// Update budget
router.patch('/:mis', async (req: AuthRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const { amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const result = await BudgetService.updateBudget(mis, parseFloat(amount.toString()), userId);
    return res.json(result);
  } catch (error) {
    console.error('Budget update error:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update budget'
    });
  }
});

// Get budget history
router.get('/:mis/history', async (req: AuthRequest, res: Response) => {
  try {
    const { mis } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const history = await storage.getBudgetHistory(mis);
    return res.json({
      status: 'success',
      history
    });
  } catch (error) {
    console.error('[Budget] Error fetching budget history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});