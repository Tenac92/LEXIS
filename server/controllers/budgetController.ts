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

    const notifications = await storage.getBudgetNotifications();

    return res.json({
      status: 'success',
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
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

    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();

    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch budget data'
      });
    }

    return res.json({
      status: 'success',
      data
    });
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

export async function getUsers(req: Request, res: Response) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, units, telephone, department');

    if (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
    }

    return res.json({ status: 'success', users });
  } catch (error) {
    console.error("Unexpected error fetching users:", error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
}


export default { getBudgetNotifications, validateBudget, updateBudget, getBudget, getBudgetHistory, getUsers };