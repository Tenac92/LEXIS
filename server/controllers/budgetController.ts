import { Request, Response } from "express";
import { supabase } from "../db";
import { z } from "zod";
import type { Database } from "@shared/schema";
import type { User } from "@shared/schema";
import { storage } from "../storage";

interface AuthRequest extends Request {
  user?: User;
}

// Document recipient schema
const recipientSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  afm: z.string(),
  amount: z.number(),
  installment: z.number()
});

const documentSchema = z.object({
  unit: z.string(),
  project_id: z.string(),
  expenditure_type: z.string(),
  recipients: z.array(recipientSchema),
  total_amount: z.number(),
  status: z.enum(['draft', 'pending', 'completed'])
});

// Budget notification schema
const budgetNotificationSchema = z.object({
  mis: z.string(),
  type: z.enum(['funding', 'reallocation']),
  amount: z.number(),
  current_budget: z.number(),
  ethsia_pistosi: z.number(),
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  user_id: z.string(),
  created_at: z.string()
});

type BudgetNotification = z.infer<typeof budgetNotificationSchema>;

export async function getBudget(req: Request, res: Response) {
  try {
    const { mis } = req.params;

    console.log(`[Budget] Fetching budget data for MIS ${mis}`);

    if (!mis) {
      console.log('[Budget] Missing MIS parameter');
      return res.status(400).json({ 
        message: "MIS parameter is required",
        status: "error" 
      });
    }

    // First get the NA853 code from project_catalog
    console.log(`[Budget] Looking up NA853 code for MIS ${mis}`);
    const { data: projectData, error: projectError } = await supabase
      .from("project_catalog")
      .select("na853, budget_na853")
      .eq("mis", mis.toString())
      .single();

    if (projectError) {
      console.error("[Budget] Project fetch error:", projectError);
      throw projectError;
    }

    console.log(`[Budget] Found project data:`, projectData);

    if (!projectData?.na853) {
      console.log(`[Budget] No NA853 code found for MIS ${mis}, returning default values`);
      return res.json({
        user_view: 0,
        ethsia_pistosi: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        total_spent: 0,
        current_budget: projectData?.budget_na853 || 0
      });
    }

    // Then get the budget data using the NA853 code
    console.log(`[Budget] Fetching budget data for NA853 ${projectData.na853}`);
    const { data: budgetData, error: budgetError } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("na853", projectData.na853)
      .single();

    if (budgetError) {
      console.error("[Budget] Budget fetch error:", budgetError);
      throw budgetError;
    }

    console.log(`[Budget] Found budget data:`, budgetData);

    const response = {
      user_view: budgetData?.user_view?.toString() || budgetData?.katanomes_etous?.toString() || projectData.budget_na853?.toString() || '0',
      ethsia_pistosi: budgetData?.ethsia_pistosi?.toString() || '0',
      q1: budgetData?.q1?.toString() || '0',
      q2: budgetData?.q2?.toString() || '0',
      q3: budgetData?.q3?.toString() || '0',
      q4: budgetData?.q4?.toString() || '0',
      total_spent: budgetData?.total_spent?.toString() || '0',
      current_budget: budgetData?.current_budget?.toString() || budgetData?.katanomes_etous?.toString() || projectData.budget_na853?.toString() || '0'
    };

    console.log(`[Budget] Sending response:`, response);
    return res.json(response);

  } catch (error) {
    console.error("[Budget] Budget fetch error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch budget data",
      status: "error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function validateBudget(req: AuthRequest, res: Response) {
  try {
    const { mis, amount } = req.body;
    const requestedAmount = parseFloat(amount);

    if (!mis) {
      return res.status(400).json({ 
        status: 'error',
        message: "MIS parameter is required",
        canCreate: false,
        allowDocx: false
      });
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ 
        status: 'error',
        message: "Valid amount parameter is required",
        canCreate: false,
        allowDocx: false
      });
    }

    const { data: budgetData, error } = await supabase
      .from('budget_na853_split')
      .select('user_view, ethsia_pistosi, katanomes_etous')
      .eq('mis', mis)
      .single();

    if (error || !budgetData) {
      console.error('Budget fetch error:', error);
      return res.status(404).json({
        status: 'error',
        message: 'Budget not found',
        canCreate: false,
        allowDocx: false
      });
    }

    const userView = parseFloat(budgetData.user_view?.toString() || '0');
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
    const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');

    if (requestedAmount > userView) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount exceeds available budget',
        canCreate: false,
        allowDocx: false
      });
    }

    const remainingEthsiaPistosi = ethsiaPistosi - requestedAmount;
    const remainingUserView = userView - requestedAmount;
    const twentyPercentThreshold = katanomesEtous * 0.2;

    // Second check: Ethsia Pistosi will be depleted
    if (remainingEthsiaPistosi <= 0) {
      return res.json({
        status: 'warning',
        message: 'This amount will deplete the annual budget',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'funding',
        allowDocx: true
      });
    }

    // Third check: Below 20% of katanomes_etous
    if (remainingUserView <= twentyPercentThreshold) {
      return res.json({
        status: 'warning',
        message: 'This amount will reduce the budget below 20% of annual allocation',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'reallocation',
        allowDocx: true
      });
    }

    return res.json({
      status: 'success',
      canCreate: true,
      allowDocx: true
    });

  } catch (error) {
    console.error("Budget validation error:", error);
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to validate budget",
      canCreate: false,
      allowDocx: false
    });
  }
}

export async function updateBudget(req: AuthRequest, res: Response) {
  try {
    const { mis } = req.params;
    const { amount, document_id } = req.body;
    const userId = req.user?.id;

    console.log(`[Budget Update] Starting budget update for MIS ${mis}`, {
      amount,
      document_id,
      userId
    });

    if (!mis || !amount || !userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters'
      });
    }

    const requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid amount'
      });
    }

    // Get current budget data
    const { data: budgetData, error: fetchError } = await supabase
      .from('budget_na853_split')
      .select('user_view, ethsia_pistosi, katanomes_etous')
      .eq('mis', mis)
      .single();

    if (fetchError || !budgetData) {
      console.error('Budget fetch error:', fetchError);
      throw new Error('Failed to fetch budget data');
    }

    console.log('[Budget Update] Current budget data:', budgetData);

    const currentUserView = parseFloat(budgetData.user_view?.toString() || '0');
    const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
    const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');

    // Calculate new amounts
    const newUserView = Math.max(0, currentUserView - requestedAmount);
    const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - requestedAmount);

    console.log('[Budget Update] Creating budget history entry', {
      previous_amount: currentUserView,
      new_amount: newUserView,
      document_id
    });

    // Create budget history entry in Supabase
    const { error: historyError } = await supabase
      .from('budget_history')
      .insert({
        mis,
        previous_amount: currentUserView.toString(),
        new_amount: newUserView.toString(),
        change_type: 'document_creation',
        change_reason: 'Document creation reduced available budget',
        document_id,
        created_by: userId,
        created_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('[Budget Update] Failed to create history entry:', historyError);
      // Continue with budget update even if history creation fails
    } else {
      console.log('[Budget Update] Successfully created history entry');
    }

    // Update budget amounts
    const { error: updateError } = await supabase
      .from('budget_na853_split')
      .update({
        user_view: newUserView,
        ethsia_pistosi: newEthsiaPistosi,
        updated_at: new Date().toISOString()
      })
      .eq('mis', mis);

    if (updateError) {
      console.error('Budget update error:', updateError);
      throw new Error('Failed to update budget amounts');
    }

    console.log('[Budget Update] Successfully updated budget amounts');

    return res.json({
      status: 'success',
      data: {
        newUserView,
        newEthsiaPistosi
      }
    });

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
    // Get history from Supabase directly
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

export default { validateBudget, updateBudget, getBudgetHistory, getBudget };