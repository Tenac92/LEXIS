import { Request, Response } from "express";
import { supabase } from "../db";
import * as XLSX from 'xlsx';
import { storage } from "../storage";
import { Project, projectHelpers } from "@shared/models/project";
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { Project as ProjectType } from '@shared/schema';

export async function listProjects(req: Request, res: Response) {
  try {
    const { unit } = req.query;
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({ 
        message: "Failed to fetch projects from database",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({ message: 'No projects found' });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

export async function getExpenditureTypes(req: Request, res: Response) {
  const { projectId } = req.params;

  try {
    const { data: project, error } = await supabase
      .from('Projects')
      .select('expenditure_type')
      .eq('mis', projectId)
      .single();

    if (error) throw error;

    const expenditureTypes = project?.expenditure_type || [];
    res.json(expenditureTypes);
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ message: "Failed to fetch expenditure types" });
  }
}

export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    console.log('[Projects] Starting XLSX export');
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('*');

    if (error) throw error;
    if (!projects?.length) {
      console.log('[Projects] No projects found for export');
      return res.status(400).json({ message: 'No projects found for export' });
    }

    console.log(`[Projects] Found ${projects.length} projects to export`);

    const formattedProjects = projects.map(project => ({
      MIS: project.mis || '',
      NA853: project.na853 || '',
      NA271: project.na271 || '',
      E069: project.e069 || '',
      Event_Description: project.event_description || '',
      Project_Title: project.project_title || '',
      Event_Type: Array.isArray(project.event_type) ? project.event_type.join(', ') : '',
      Event_Year: Array.isArray(project.event_year) ? project.event_year.join(', ') : '',
      Region: project.region?.region?.join(', ') || '',
      Municipality: project.region?.municipality?.join(', ') || '',
      Regional_Unit: project.region?.regional_unit?.join(', ') || '',
      Implementing_Agency: Array.isArray(project.implementing_agency) 
        ? project.implementing_agency.join(', ') 
        : '',
      Budget_NA853: project.budget_na853?.toString() || '0',
      Budget_E069: project.budget_e069?.toString() || '0',
      Budget_NA271: project.budget_na271?.toString() || '0',
      Status: project.status || '',
      KYA: Array.isArray(project.kya) ? project.kya.join(', ') : '',
      FEK: Array.isArray(project.fek) ? project.fek.join(', ') : '',
      ADA: project.ada || '',
      Expenditure_Type: Array.isArray(project.expenditure_type)
        ? project.expenditure_type.join(', ')
        : '',
      Procedures: project.procedures || '',
      Created_At: project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
      Updated_At: project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedProjects);

    // Set column widths
    const colWidths = Object.keys(formattedProjects[0]).map(() => ({ wch: 20 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);

  } catch (error) {
    console.error("Error exporting projects:", error);
    res.status(500).json({ 
      message: "Failed to export projects",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
          .from("Projects")
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