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
  amount: number,
  current_budget: number,
  ethsia_pistosi: number,
  reason: string,
  userId: string
) {
  const { error } = await supabase
    .from('budget_notifications')
    .insert([{
      mis,
      type,
      amount,
      current_budget,
      ethsia_pistosi,
      reason,
      status: 'pending',
      user_id: userId,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    console.error('Failed to create budget notification:', error);
    throw error;
  }
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

    if (error) {
      console.error('Budget fetch error:', error);
      throw error;
    }

    const userView = parseFloat(budgetData.user_view) || 0;
    const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi) || 0;

    // Check if amount exceeds user_view
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

    // Check if ethsia_pistosi will be depleted
    if (remainingEthsiaPistosi <= 0) {
      return res.json({
        status: 'warning',
        message: 'Το ποσό θα εξαντλήσει την ετήσια πίστωση',
        canCreate: false,
        requiresNotification: true,
        notificationType: 'funding',
        allowDocx: false
      });
    }

    // Check if remaining budget will be below 20% threshold
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
    res.status(500).json({ 
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
      .eq("mis", mis)
      .single();

    if (projectError) {
      console.error("Project fetch error:", projectError);
      throw projectError;
    }

    if (!projectData || !projectData.na853) {
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
      user_view: budgetData?.user_view || budgetData?.katanomes_etous || projectData.budget_na853 || 0,
      ethsia_pistosi: budgetData?.ethsia_pistosi || 0,
      q1: budgetData?.q1 || 0,
      q2: budgetData?.q2 || 0,
      q3: budgetData?.q3 || 0,
      q4: budgetData?.q4 || 0,
      total_spent: budgetData?.total_spent || 0,
      current_budget: budgetData?.current_budget || budgetData?.katanomes_etous || projectData.budget_na853 || 0
    };

    res.json(response);

  } catch (error) {
    console.error("Budget fetch error:", error);
    res.status(500).json({ 
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
      .eq('mis', mis)
      .single();

    if (fetchError) {
      console.error('Budget fetch error:', fetchError);
      throw new Error('Failed to fetch budget data');
    }

    const currentUserView = parseFloat(budgetData.user_view) || 0;
    const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi) || 0;
    const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;

    // Calculate new amounts
    const newUserView = Math.max(0, currentUserView - requestedAmount);
    const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - requestedAmount);
    const twentyPercentThreshold = katanomesEtous * 0.2;

    // Create notifications if needed
    try {
      if (newEthsiaPistosi <= 0) {
        await createBudgetNotification(
          mis,
          'funding',
          requestedAmount,
          newUserView,
          newEthsiaPistosi,
          'Η ετήσια πίστωση έχει εξαντληθεί',
          userId
        );
      }

      if (newUserView <= twentyPercentThreshold) {
        await createBudgetNotification(
          mis,
          'reallocation',
          requestedAmount,
          newUserView,
          newEthsiaPistosi,
          'Το ποσό θα μειώσει το διαθέσιμο προϋπολογισμό κάτω από το 20% της ετήσιας κατανομής',
          userId
        );
      }
    } catch (notificationError) {
      console.error('Failed to create notifications:', notificationError);
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

    res.json({
      status: 'success',
      data: {
        newUserView,
        newEthsiaPistosi,
        requiresReallocation: newUserView <= twentyPercentThreshold,
        requiresFunding: newEthsiaPistosi <= 0
      }
    });

  } catch (error) {
    console.error('Budget update error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update budget'
    });
  }
}