import { Request, Response } from "express";
import { supabase } from "../db";
import * as XLSX from 'xlsx';

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

export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    const { data: projects, error } = await supabase
      .from("project_catalog")
      .select("*")
      .order("mis");

    if (error) throw error;

    // Format projects for Excel
    const formattedProjects = projects.map(project => ({
      MIS: project.mis,
      NA853: project.na853,
      'Event Description': project.event_description,
      Region: project.region,
      Municipality: project.municipality,
      'Budget NA853': project.budget_na853,
      'Budget E069': project.budget_e069,
      'Budget NA271': project.budget_na271,
      'Annual Credit': project.ethsia_pistosi,
      Status: project.status,
      'Event Type': project.event_type,
      'Event Year': project.event_year,
      'Implementing Agency': Array.isArray(project.implementing_agency) 
        ? project.implementing_agency.join(', ') 
        : project.implementing_agency,
      'Created At': project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
      'Updated At': project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedProjects);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buffer);
  } catch (error) {
    console.error("Error exporting projects:", error);
    res.status(500).json({ message: "Failed to export projects" });
  }
}

export async function bulkUpdateProjects(req: Request, res: Response) {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: "Updates must be an array" });
    }

    const results = [];
    const errors = [];

    // Process each update
    for (const update of updates) {
      if (!update.mis || !update.data) {
        errors.push({ mis: update.mis, error: "Missing required fields" });
        continue;
      }

      try {
        const { error } = await supabase
          .from("project_catalog")
          .update(update.data)
          .eq("mis", update.mis);

        if (error) {
          errors.push({ mis: update.mis, error: error.message });
        } else {
          results.push({ mis: update.mis, status: "success" });
        }
      } catch (error) {
        errors.push({ 
          mis: update.mis, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error performing bulk update:", error);
    res.status(500).json({ 
      message: "Failed to perform bulk update",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}