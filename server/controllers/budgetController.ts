import { Request, Response } from "express";
import { supabase } from "../db";

export async function getBudget(req: Request, res: Response) {
  try {
    const { mis } = req.params;

    // First get the NA853 code from project_catalog
    const { data: projectData, error: projectError } = await supabase
      .from("project_catalog")
      .select("na853")
      .eq("mis", mis)
      .single();

    if (projectError || !projectData?.na853) {
      return res.status(404).json({ message: "Project not found or NA853 code not available" });
    }

    // Then get the budget data using the NA853 code
    const { data, error } = await supabase
      .from("budget_na853_split")
      .select("*")
      .eq("na853", projectData.na853)
      .single();

    if (error) {
      // If no data found, return default values
      if (error.code === 'PGRST116') {
        return res.json({
          user_view: 0,
          ethsia_pistosi: 0,
          q1: 0,
          q2: 0,
          q3: 0,
          q4: 0,
          total_spent: 0,
          current_budget: 0
        });
      }
      throw error;
    }

    res.json({
      user_view: data.user_view || data.katanomes_etous || 0,
      ethsia_pistosi: data.ethsia_pistosi || 0,
      q1: data.q1 || 0,
      q2: data.q2 || 0,
      q3: data.q3 || 0,
      q4: data.q4 || 0,
      total_spent: data.total_spent || 0,
      current_budget: data.current_budget || data.katanomes_etous || 0
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({ message: "Failed to fetch budget data" });
  }
}