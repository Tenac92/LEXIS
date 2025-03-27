import { Request, Response } from "express";
import { supabase } from "../config/db";
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
    
    // Use the storage method which correctly handles filtering by implementing_agency
    const projects = await storage.getProjectsByUnit(unitName);
    
    if (!projects || projects.length === 0) {
      console.log(`[Projects] No projects found for unit: ${unitName}`);
      return res.json([]);
    }
    
    // Map projects and validate with our model to ensure consistency
    const formattedProjects = projects.map(project => {
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

// Get project regions
router.get('/:mis/regions', async (req: Request, res: Response) => {
  try {
    const { mis } = req.params;
    
    if (!mis) {
      return res.status(400).json({ 
        message: "Project MIS is required" 
      });
    }
    
    console.log(`[Projects] Fetching regions for project: ${mis}`);
    
    // Query the Projects table to get the region data
    // Check which columns actually exist in the Projects table
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', mis)
      .single();
    
    if (error) {
      console.error('[Projects] Error fetching regions:', error);
      return res.status(500).json({ 
        message: "Failed to fetch regions", 
        error: error.message 
      });
    }
    
    if (!data) {
      console.log(`[Projects] No project found with MIS: ${mis}`);
      return res.status(404).json({ 
        message: "Project not found" 
      });
    }
    
    // Process region data
    let response: { region?: string[], regional_unit?: string[] } = {};
    
    // Log the actual columns to help debug
    console.log('[Projects] Available columns in Projects table:', Object.keys(data));
    
    // Check if region exists in any column
    const regionData = data.region || data.regions || data.regional_data || null;
    
    // Handle region field - whatever column name it uses
    if (regionData) {
      try {
        let parsedRegionData: string | string[] = regionData;
        
        // If it's a string that looks like JSON, try to parse it
        if (typeof parsedRegionData === 'string' && 
            (parsedRegionData.startsWith('[') || parsedRegionData.startsWith('{'))) {
          try {
            parsedRegionData = JSON.parse(parsedRegionData);
          } catch (e) {
            console.log('[Projects] Could not parse region JSON, using as string:', e);
          }
        }
        
        // Convert to array if it's not already
        if (!Array.isArray(parsedRegionData)) {
          parsedRegionData = [parsedRegionData];
        }
        
        response.region = parsedRegionData;
      } catch (e) {
        console.error('[Projects] Error processing region data:', e);
      }
    }
    
    // For regional unit, use any column that might contain it
    const unitData = data.regional_unit || data.regionalUnit || data.regional_units || data.regionalUnits || null;
    
    // Handle regional_unit field - whatever column name it uses
    if (unitData) {
      try {
        let parsedUnitData: string | string[] = unitData;
        
        // If it's a string that looks like JSON, try to parse it
        if (typeof parsedUnitData === 'string' && 
            (parsedUnitData.startsWith('[') || parsedUnitData.startsWith('{'))) {
          try {
            parsedUnitData = JSON.parse(parsedUnitData);
          } catch (e) {
            console.log('[Projects] Could not parse regional_unit JSON, using as string:', e);
          }
        }
        
        // Convert to array if it's not already
        if (!Array.isArray(parsedUnitData)) {
          parsedUnitData = [parsedUnitData];
        }
        
        response.regional_unit = parsedUnitData;
      } catch (e) {
        console.error('[Projects] Error processing regional_unit data:', e);
      }
    }
    
    // If we still don't have data for regions, use a placeholder based on other fields
    if (!response.region && !response.regional_unit) {
      console.log('[Projects] No region data found, checking other columns');
      
      // Check if there are any columns that might contain region-related info
      const possibleRegions = [];
      
      if (data.address) {
        possibleRegions.push(data.address);
      }
      
      if (data.location) {
        possibleRegions.push(data.location);
      }
      
      if (data.municipality) {
        possibleRegions.push(data.municipality);
      }
      
      if (data.prefectures) {
        possibleRegions.push(data.prefectures);
      }
      
      if (possibleRegions.length > 0) {
        response.region = possibleRegions;
      }
    }
    
    console.log(`[Projects] Regions for project ${mis}:`, response);
    res.json(response);
  } catch (error) {
    console.error('[Projects] Error fetching regions:', error);
    res.status(500).json({ 
      message: "Server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Mount routes
router.get('/', listProjects);
router.get('/export', exportProjectsXLSX);