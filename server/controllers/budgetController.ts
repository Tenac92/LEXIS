import { Request, Response } from "express";
import { supabase } from "../db";

interface BudgetValidationResponse {
  status: 'success' | 'warning' | 'error';
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: 'funding' | 'reallocation';
  allowDocx?: boolean;
}

async function createBudgetNotification(
  mis: string, 
  type: 'funding' | 'reallocation',
  amount: string,
  current_budget: string,
  ethsia_pistosi: string,
  reason: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('budget_notifications')
    .insert({
      mis,
      type,
      amount: parseFloat(amount),
      current_budget: parseFloat(current_budget),
      ethsia_pistosi: parseFloat(ethsia_pistosi),
      reason,
      status: 'pending',
      user_id: userId,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to create budget notification:', error);
    throw error;
  }

  return data;
}

export async function validateBudget(req: Request, res: Response) {
  try {
    const { mis, amount } = req.body;
    const requestedAmount = parseFloat(amount);

    if (!mis || isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ 
        status: 'error',
        message: "Invalid parameters",
        canCreate: false,
        allowDocx: false
      });
    }

    const { data: budgetData, error } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("mis", mis)
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
    const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');

    // First check: Amount cannot exceed user_view
    if (requestedAmount > userView) {
      return res.status(400).json({
        status: 'error',
        message: 'Το ποσό υπερβαίνει το διαθέσιμο προϋπολογισμό',
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
        message: 'Το ποσό θα εξαντλήσει την ετήσια πίστωση',
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
        message: 'Το ποσό θα μειώσει το διαθέσιμο προϋπολογισμό κάτω από το 20% της ετήσιας κατανομής',
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

export async function getBudget(req: Request, res: Response) {
  try {
    const { mis } = req.params;

    if (!mis) {
      return res.status(400).json({ 
        message: "MIS parameter is required",
        status: "error" 
      });
    }

    // First get the NA853 code from project_catalog
    const { data: projectData, error: projectError } = await supabase
      .from("project_catalog")
      .select("na853, budget_na853")
      .eq("mis", mis.toString())
      .single();

    if (projectError) {
      console.error("Project fetch error:", projectError);
      throw projectError;
    }

    if (!projectData?.na853) {
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
    const { data: budgetData, error: budgetError } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("na853", projectData.na853)
      .single();

    if (budgetError) {
      console.error("Budget fetch error:", budgetError);
      throw budgetError;
    }

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

    return res.json(response);

  } catch (error) {
    console.error("Budget fetch error:", error);
    return res.status(500).json({ 
      message: "Failed to fetch budget data",
      status: "error"
    });
  }
}

export async function updateBudget(req: Request, res: Response) {
  try {
    const { mis } = req.params;
    const { amount } = req.body;
    const userId = req.user?.id;

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
      .select('*')
      .eq('mis', mis.toString())
      .single();

    if (fetchError || !budgetData) {
      console.error('Budget fetch error:', fetchError);
      throw new Error('Failed to fetch budget data');
    }

    const currentUserView = parseFloat(budgetData.user_view?.toString() || '0');
    const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
    const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');

    // Calculate new amounts
    const newUserView = Math.max(0, currentUserView - requestedAmount);
    const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - requestedAmount);
    const twentyPercentThreshold = katanomesEtous * 0.2;

    // Create notifications if needed
    const notifications = [];

    try {
      if (newEthsiaPistosi <= 0) {
        await createBudgetNotification(
          mis,
          'funding',
          requestedAmount.toString(),
          newUserView.toString(),
          newEthsiaPistosi.toString(),
          'Η ετήσια πίστωση έχει εξαντληθεί',
          userId
        );
        notifications.push({ type: 'funding', reason: 'Η ετήσια πίστωση έχει εξαντληθεί' });
      }

      if (newUserView <= twentyPercentThreshold) {
        await createBudgetNotification(
          mis,
          'reallocation',
          requestedAmount.toString(),
          newUserView.toString(),
          newEthsiaPistosi.toString(),
          'Το ποσό θα μειώσει το διαθέσιμο προϋπολογισμό κάτω από το 20% της ετήσιας κατανομής',
          userId
        );
        notifications.push({ type: 'reallocation', reason: 'Το ποσό θα μειώσει το διαθέσιμο προϋπολογισμό κάτω από το 20% της ετήσιας κατανομής' });
      }
    } catch (notificationError) {
      console.error('Failed to create notifications:', notificationError);
      // Continue with budget update even if notifications fail
    }

    // Update budget amounts
    const { error: updateError } = await supabase
      .from('budget_na853_split')
      .update({
        user_view: newUserView.toString(),
        ethsia_pistosi: newEthsiaPistosi.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('mis', mis.toString());

    if (updateError) {
      console.error('Budget update error:', updateError);
      throw new Error('Failed to update budget amounts');
    }

    return res.json({
      status: 'success',
      data: {
        newUserView,
        newEthsiaPistosi,
        notifications
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