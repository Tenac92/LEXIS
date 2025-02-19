import { Request, Response } from "express";
import { supabase } from "../db";

export async function listProjects(req: Request, res: Response) {
  try {
    const { unit } = req.query;
    let query = supabase.from("project_catalog").select("*");

    if (unit) {
      query = query.contains("implementing_agency", [unit]);
    }

    const { data, error } = await query.order("mis", { ascending: false });

    if (error) throw error;

    const projects = data?.map(project => ({
      id: project.mis,
      mis: project.mis,
      na853: project.na853,
      event_description: project.event_description,
      budget_na853: project.budget_na853,
      expenditure_type: project.expenditure_type || []
    })) || [];

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

export async function getExpenditureTypes(req: Request, res: Response) {
  try {
    const { mis } = req.params;
    const { data, error } = await supabase
      .from("project_catalog")
      .select("expenditure_type")
      .eq("mis", mis)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Project not found" });
    }

    const expenditureTypes = data.expenditure_type || [];

    res.json({
      expenditure_types: Array.isArray(expenditureTypes) ? expenditureTypes : []
    });
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ message: "Failed to fetch expenditure types" });
  }
}