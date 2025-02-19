import { Request, Response } from "express";
import { supabase } from "../db";
import * as XLSX from 'xlsx';
import { storage } from "../storage";
import type { ProjectCatalog } from "@shared/schema";

export async function listProjects(req: Request, res: Response) {
  const { unit } = req.query;

  try {
    const projects = unit 
      ? await storage.getProjectCatalogByUnit(unit as string)
      : await storage.getProjectCatalog();

    // Map projects to include all necessary fields
    const formattedProjects = projects.map((project: ProjectCatalog) => ({
      id: project.id,
      mis: project.mis,
      na853: project.na853,
      event_description: project.event_description,
      implementing_agency: project.implementing_agency,
      region: project.region,
      municipality: project.municipality,
      budget_na853: project.budget_na853,
      budget_na271: project.budget_na271,
      budget_e069: project.budget_e069,
      ethsia_pistosi: project.ethsia_pistosi,
      status: project.status,
      event_type: project.event_type,
      event_year: project.event_year,
      procedures: project.procedures,
      created_at: project.created_at,
      updated_at: project.updated_at
    }));

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

    // Format projects for Excel with all fields
    const formattedProjects = projects.map(project => ({
      'MIS': project.mis,
      'NA853': project.na853,
      'E069': project.e069,
      'NA271': project.na271,
      'Event Description': project.event_description,
      'Project Title': project.project_title,
      'Event Type': project.event_type,
      'Event Year': project.event_year,
      'Region': project.region,
      'Regional Unit': project.regional_unit,
      'Municipality': project.municipality,
      'Implementing Agency': Array.isArray(project.implementing_agency) 
        ? project.implementing_agency.join(', ') 
        : project.implementing_agency,
      'Budget NA853': project.budget_na853,
      'Budget E069': project.budget_e069,
      'Budget NA271': project.budget_na271,
      'Annual Credit': project.ethsia_pistosi,
      'Status': project.status,
      'KYA': project.kya,
      'FEK': project.fek,
      'ADA': project.ada,
      'Expenditure Type': Array.isArray(project.expenditure_type)
        ? project.expenditure_type.join(', ')
        : project.expenditure_type,
      'Procedures': project.procedures,
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