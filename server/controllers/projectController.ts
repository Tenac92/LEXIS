import { Request, Response } from "express";
import { supabase } from "../db";
import * as XLSX from 'xlsx';
import { storage } from "../storage";
import { Project, projectHelpers } from "@shared/models/project";

export async function listProjects(req: Request, res: Response) {
  const { unit } = req.query;

  try {
    const projects = unit 
      ? await storage.getProjectCatalogByUnit(unit as string)
      : await storage.getProjectCatalog();

    // Map projects and validate with our model
    const formattedProjects = projects.map(project => {
      const validatedProject = projectHelpers.validateProject(project);
      return {
        id: validatedProject.id,
        mis: validatedProject.mis,
        na853: validatedProject.na853,
        event_description: validatedProject.event_description,
        implementing_agency: validatedProject.implementing_agency,
        region: validatedProject.region,
        municipality: validatedProject.municipality,
        budget_na853: validatedProject.budget_na853,
        budget_na271: validatedProject.budget_na271,
        budget_e069: validatedProject.budget_e069,
        ethsia_pistosi: validatedProject.ethsia_pistosi,
        status: validatedProject.status,
        event_type: validatedProject.event_type,
        event_year: validatedProject.event_year,
        procedures: validatedProject.procedures,
        created_at: validatedProject.created_at,
        updated_at: validatedProject.updated_at
      };
    });

    res.json(formattedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

export async function getExpenditureTypes(req: Request, res: Response) {
  const { projectId } = req.params;

  try {
    const expenditureTypes = await storage.getProjectExpenditureTypes(projectId);

    if (!expenditureTypes || expenditureTypes.length === 0) {
      return res.json([
        "Travel",
        "Equipment",
        "Supplies",
        "Services",
        "Other"
      ]);
    }

    res.json(expenditureTypes);
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ message: "Failed to fetch expenditure types" });
  }
}

export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    const projects = await storage.getProjectCatalog();

    // Use our model's helper function to format projects for Excel
    const formattedProjects = projects.map(project => {
      const validatedProject = projectHelpers.validateProject(project);
      return projectHelpers.formatForExcel(validatedProject);
    });

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
        // Validate update data against our model
        const validData = projectHelpers.validateProject({
          ...update.data,
          id: 0, // Placeholder for validation
          created_at: new Date(),
          updated_at: new Date()
        });

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