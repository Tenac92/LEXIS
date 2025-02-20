import { Request, Response } from "express";
import { supabase } from "../db";

interface BudgetValidationResponse {
  status: 'success' | 'warning' | 'error';
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: 'funding' | 'reallocation';
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
  return await supabase
    .from('budget_notifications')
    .insert([{
      mis,
      type,
      amount,
      current_budget,
      ethsia_pistosi,
      reason,
      status: 'pending',
      user_id: userId
    }]);
}

export async function validateBudget(req: Request, res: Response) {
  try {
    const { mis, amount } = req.body;
    const requestedAmount = parseFloat(amount);

    if (!mis || isNaN(requestedAmount)) {
      return res.status(400).json({ 
        message: "Invalid parameters",
        status: "error" 
      });
    }

    const { data: budgetData, error } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("mis", mis)
      .single();

    if (error) throw error;

    const userView = parseFloat(budgetData.user_view) || 0;
    const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi) || 0;

    // Check if amount exceeds user_view
    if (requestedAmount > userView) {
      return res.status(400).json({
        status: 'error',
        message: 'Το ποσό υπερβαίνει το διαθέσιμο προϋπολογισμό',
        canCreate: false
      });
    }

    // Check if ethsia_pistosi is about to be depleted
    if (requestedAmount > ethsiaPistosi) {
      await createBudgetNotification(
        mis,
        'funding',
        requestedAmount,
        userView,
        ethsiaPistosi,
        'Το ποσό υπερβαίνει την ετήσια πίστωση',
        req.user?.id
      );

      return res.json({
        status: 'warning',
        message: 'Το ποσό υπερβαίνει την ετήσια πίστωση',
        canCreate: false,
        requiresNotification: true,
        notificationType: 'funding'
      });
    }

    // Check if amount exceeds 20% of katanomes_etous
    if (requestedAmount > (katanomesEtous * 0.2)) {
      await createBudgetNotification(
        mis,
        'reallocation',
        requestedAmount,
        userView,
        ethsiaPistosi,
        'Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής',
        req.user?.id
      );

      return res.json({
        status: 'warning',
        message: 'Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'reallocation'
      });
    }

    return res.json({
      status: 'success',
      canCreate: true
    });
  } catch (error) {
    console.error("Budget validation error:", error);
    res.status(500).json({ 
      message: "Failed to validate budget",
      status: "error" 
    });
  }
}

export async function getBudget(req: Request, res: Response) {
  try {
    const { mis } = req.params;

    if (!mis) {
      console.log("[Budget Controller] Missing MIS parameter");
      return res.status(400).json({ 
        message: "MIS parameter is required",
        status: "error" 
      });
    }

    console.log(`[Budget Controller] Fetching budget for MIS: ${mis}`);

    // First get the NA853 code from project_catalog
    const { data: projectData, error: projectError } = await supabase
      .from("project_catalog")
      .select("na853, budget_na853")
      .eq("mis", mis)
      .single();

    if (projectError) {
      console.error("[Budget Controller] Project fetch error:", projectError);
      // If no data found, return default object
      if (projectError.code === "PGRST116") {
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
      throw projectError;
    }

    if (!projectData || !projectData.na853) {
      console.log("[Budget Controller] No NA853 code found for MIS:", mis);
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

    console.log(`[Budget Controller] Found NA853: ${projectData.na853}`);

    // Then get the budget data using the NA853 code
    const { data: budgetData, error: budgetError } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("na853", projectData.na853)
      .single();

    if (budgetError) {
      console.error("[Budget Controller] Budget fetch error:", budgetError);
      // If no budget data found, return default values with project's budget
      if (budgetError.code === "PGRST116") {
        return res.json({
          user_view: projectData.budget_na853 || 0,
          ethsia_pistosi: 0,
          q1: 0,
          q2: 0,
          q3: 0,
          q4: 0,
          total_spent: 0,
          current_budget: projectData.budget_na853 || 0
        });
      }
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

    console.log("[Budget Controller] Sending response:", response);
    res.json(response);

  } catch (error) {
    console.error("[Budget Controller] Unhandled error:", error);
    res.status(500).json({ 
      message: "Failed to fetch budget data",
      status: "error",
      details: process.env.NODE_ENV === "development" ? error : undefined
    });
  }
}