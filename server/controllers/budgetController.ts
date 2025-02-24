import { Request, Response } from "express";
import type { User, BudgetValidation } from "@shared/schema";
import { BudgetService } from "../services/budgetService";
import { supabase } from "../db";

interface AuthRequest extends Request {
  user?: User;
}

export async function getBudget(req: AuthRequest, res: Response) {
  try {
    const { mis } = req.params;
    console.log(`[Budget] Fetching budget data for MIS ${mis}`);

    const result = await BudgetService.getBudget(mis);
    return res.status(result.status === 'error' ? 500 : 200).json(result);
  } catch (error) {
    console.error("[Budget] Budget fetch error:", error);
    return res.status(500).json({ 
      status: "error",
      message: "Failed to fetch budget data",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function validateBudget(req: AuthRequest, res: Response) {
  try {
    const { mis, amount } = req.body as BudgetValidation;
    const requestedAmount = parseFloat(amount.toString());

    const result = await BudgetService.validateBudget(mis, requestedAmount);
    return res.status(result.status === 'error' ? 400 : 200).json(result);
  } catch (error) {
    console.error("Budget validation error:", error);
    return res.status(500).json({ 
      status: 'error',
      canCreate: false,
      message: "Failed to validate budget",
      allowDocx: false
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
    return res.status(result.status === 'error' ? 500 : 200).json(result);
  } catch (error) {
    console.error('Budget update error:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update budget'
    });
  }
}

export async function getBudgetHistory(req: Request, res: Response) {
  try {
    const { data: history, error } = await supabase
      .from('budget_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Budget History] Database error:', error);
      throw error;
    }

    console.log(`[Budget History] Found ${history?.length || 0} entries`);

    return res.json({
      status: 'success',
      data: history || []
    });
  } catch (error) {
    console.error('Error fetching budget history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    const { data: notifications, error } = await supabase
      .from('budget_notifications')
      .select(`
        *,
        user:user_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Budget] Notifications fetch error:', error);
      throw error;
    }

    return res.json({
      status: 'success',
      notifications: notifications || []
    });
  } catch (error) {
    console.error('[Budget] Get notifications error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default { validateBudget, updateBudget, getBudgetHistory, getBudget, getNotifications };