import { Request, Response } from "express";
import { supabase } from "../config/db";
import { storage } from "../storage";
import type { User, BudgetValidation } from "@shared/schema";
import { BudgetService } from "../services/budgetService";

interface AuthRequest extends Request {
  user?: User;
}

export async function getBudgetNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Fetch notifications ordered by creation date
    const { data: notifications, error } = await supabase
      .from('budget_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to latest 50 notifications

    if (error) {
      console.error('[BudgetController] Error fetching notifications:', error);
      throw error;
    }

    if (!notifications) {
      console.warn('[BudgetController] No notifications found');
      return res.json([]);
    }

    console.log('[BudgetController] Fetched notifications:', notifications.length);
    return res.json(notifications);
  } catch (error) {
    console.error('[BudgetController] Error in getBudgetNotifications:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getBudget(req: Request, res: Response) {
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
}

export async function validateBudget(req: AuthRequest, res: Response) {
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
          change_type: 'notification_created',
          change_reason: `Budget notification created: ${result.notificationType}`,
          created_by: req.user.id,
          created_at: new Date().toISOString(),
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
      canCreate: true, // Still allow creation even on error
      message: "Failed to validate budget",
      allowDocx: true
    });
  }
}

export async function updateBudget(req: AuthRequest, res: Response) {
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
}

export async function getBudgetHistory(req: AuthRequest, res: Response) {
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
}

export default { getBudgetNotifications, validateBudget, updateBudget, getBudget, getBudgetHistory };