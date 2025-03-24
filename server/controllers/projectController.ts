import { Request, Response } from "express";
import { supabase } from "../db";
import * as XLSX from 'xlsx';
import { Project, projectHelpers } from "@shared/models/project";
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { storage } from '../storage';

export const router = Router();

export async function listProjects(req: Request, res: Response) {
  try {
    console.log('[Projects] Fetching all projects');
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

    // Map projects and validate with our model
    const formattedProjects = data.map(project => {
      try {
        return projectHelpers.validateProject(project);
      } catch (error) {
        console.error('Project validation error:', error);
        return null;
      }
    }).filter((project): project is Project => project !== null);

    res.json(formattedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

router.get('/expenditure-types/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const expenditureTypes = await storage.getProjectExpenditureTypes(projectId);

    if (!expenditureTypes || expenditureTypes.length === 0) {
      return res.json({ message: "No expenditure types found." });
    }

    res.json(expenditureTypes);
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ message: "Failed to fetch expenditure types" });
  }
});

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

    const formattedProjects = projects.map(project => projectHelpers.formatForExcel(project));

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

router.post('/bulk-update', async (req: Request, res: Response) => {
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
          mis: update.mis
        });

        const { error } = await supabase
          .from("Projects")
          .update(validData)
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
});

// Get projects by unit
router.get('/by-unit/:unitName', async (req: Request, res: Response) => {
  try {
    const { unitName } = req.params;
    
    if (!unitName) {
      return res.status(400).json({ message: 'Unit name is required' });
    }
    
    console.log(`[Projects] Fetching projects for unit: ${unitName}`);
    
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .eq('unit', unitName)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("[Projects] Database error:", error);
      return res.status(500).json({ 
        message: "Failed to fetch projects for unit",
        error: error.message
      });
    }
    
    if (!data || data.length === 0) {
      console.log(`[Projects] No projects found for unit: ${unitName}`);
      return res.json([]);
    }
    
    // Map projects and validate with our model
    const formattedProjects = data.map(project => {
      try {
        return projectHelpers.validateProject(project);
      } catch (error) {
        console.error('[Projects] Project validation error:', error);
        return null;
      }
    }).filter((project): project is Project => project !== null);
    
    console.log(`[Projects] Found ${formattedProjects.length} projects for unit: ${unitName}`);
    res.json(formattedProjects);
  } catch (error) {
    console.error("[Projects] Error fetching projects by unit:", error);
    res.status(500).json({ 
      message: "Failed to fetch projects by unit",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mount routes
router.get('/', listProjects);
router.get('/export', exportProjectsXLSX);