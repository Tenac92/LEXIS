import { Request, Response } from "express";
import type { User, BudgetValidation } from "@shared/schema";
import { BudgetService } from "../services/budgetService";
import { storage } from "../storage";
import { supabase } from '../supabaseClient'; // Assuming supabase client is available

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

export async function getNotifications(req: Request, res: Response) {
  try {
    const { data: notifications, error } = await supabase
      .from('budget_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ 
      status: 'success',
      notifications: notifications || [] 
    });
  } catch (error) {
    console.error('[Budget] Error fetching notifications:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
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

export default { validateBudget, updateBudget, getBudget, getNotifications, getBudgetHistory };