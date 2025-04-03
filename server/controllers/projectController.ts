import { Request, Response } from "express";
import { supabase } from "../config/db";
import * as XLSX from 'xlsx';
import { Project, projectHelpers } from "@shared/models/project";
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { storage } from '../storage';
import { AuthenticatedRequest } from '../authentication';

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
    console.log('[Projects] Starting XLSX export with integrated budget_na853_split data');
    // Get all projects
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('*');

    if (error) throw error;
    if (!projects?.length) {
      console.log('[Projects] No projects found for export');
      return res.status(400).json({ message: 'No projects found for export' });
    }

    console.log(`[Projects] Found ${projects.length} projects to export`);

    // Get all budget_na853_split data
    console.log('[Projects] Fetching budget_na853_split data');
    const { data: budgetSplits, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*');

    if (budgetError) {
      console.error('[Projects] Error fetching budget splits:', budgetError);
    }

    // Create a map of budget splits by project MIS for easier lookup
    const budgetSplitsByMis = {};
    if (budgetSplits && budgetSplits.length > 0) {
      console.log(`[Projects] Found ${budgetSplits.length} budget splits`);
      budgetSplits.forEach(split => {
        // Use mis as the key
        if (split.mis) {
          if (!budgetSplitsByMis[split.mis]) {
            budgetSplitsByMis[split.mis] = [];
          }
          budgetSplitsByMis[split.mis].push(split);
        }
      });
    }

    // Create a combined dataset with projects and their budget data
    const combinedData = [];
    
    // Process each project
    projects.forEach(project => {
      // Get the budget splits for this project
      const projectSplits = budgetSplitsByMis[project.mis] || [];
      
      // If there are no splits, add one row with just the project data
      if (projectSplits.length === 0) {
        combinedData.push({
          // Project Core Data (from Projects table)
          'ΜΙS': project.mis || '',
          'Τίτλος': project.title || project.project_title || project.event_description || '',
          'Κατάσταση': project.status || '',
          'ΝΑ853': project.na853 || '',
          'ΝΑ271': project.na271 || '',
          'Ε069': project.e069 || '',
          'Προϋπολογισμός ΝΑ853': project.budget_na853 || '',
          'Προϋπολογισμός ΝΑ271': project.budget_na271 || '',
          'Προϋπολογισμός Ε069': project.budget_e069 || '',
          'Περιφέρεια': typeof project.region === 'object' ? JSON.stringify(project.region) : (project.region || ''),
          'Φορέας Υλοποίησης': Array.isArray(project.implementing_agency) ? project.implementing_agency.join(', ') : (project.implementing_agency || ''),
          'Τύπος Συμβάντος': Array.isArray(project.event_type) ? project.event_type.join(', ') : (project.event_type || ''),
          'Έτος Συμβάντος': Array.isArray(project.event_year) ? project.event_year.join(', ') : (project.event_year || ''),
          'Ημ/νία Δημιουργίας': project.created_at ? new Date(project.created_at).toLocaleDateString('el-GR') : '',
          
          // Budget Split Data (empty for this row)
          'ID Κατανομής': '',
          'ΠΡΟΙΠ': '',
          'Ετήσια Πίστωση': '',
          'Α΄ Τρίμηνο': '',
          'Β΄ Τρίμηνο': '',
          'Γ΄ Τρίμηνο': '',
          'Δ΄ Τρίμηνο': '',
          'Κατανομές Έτους': '',
          'Προβολή Χρήστη': '',
          'Ημ/νία Δημ. Κατανομής': '',
          'Ημ/νία Ενημ. Κατανομής': ''
        });
      } else {
        // For projects with splits, add one row per split with both project and split data
        projectSplits.forEach((split, index) => {
          combinedData.push({
            // Project Core Data (only include full project data in the first row for this project)
            'ΜΙS': project.mis || '',
            'Τίτλος': project.title || project.project_title || project.event_description || '',
            'Κατάσταση': project.status || '',
            'ΝΑ853': project.na853 || '',
            'ΝΑ271': project.na271 || '',
            'Ε069': project.e069 || '',
            'Προϋπολογισμός ΝΑ853': project.budget_na853 || '',
            'Προϋπολογισμός ΝΑ271': project.budget_na271 || '',
            'Προϋπολογισμός Ε069': project.budget_e069 || '',
            'Περιφέρεια': typeof project.region === 'object' ? JSON.stringify(project.region) : (project.region || ''),
            'Φορέας Υλοποίησης': Array.isArray(project.implementing_agency) ? project.implementing_agency.join(', ') : (project.implementing_agency || ''),
            'Τύπος Συμβάντος': Array.isArray(project.event_type) ? project.event_type.join(', ') : (project.event_type || ''),
            'Έτος Συμβάντος': Array.isArray(project.event_year) ? project.event_year.join(', ') : (project.event_year || ''),
            'Ημ/νία Δημιουργίας': project.created_at ? new Date(project.created_at).toLocaleDateString('el-GR') : '',
            
            // Budget Split Data
            'ID Κατανομής': split.id || '',
            'ΠΡΟΙΠ': split.proip || '',
            'Ετήσια Πίστωση': split.ethsia_pistosi || '',
            'Α΄ Τρίμηνο': split.q1 || '',
            'Β΄ Τρίμηνο': split.q2 || '',
            'Γ΄ Τρίμηνο': split.q3 || '',
            'Δ΄ Τρίμηνο': split.q4 || '',
            'Κατανομές Έτους': split.katanomes_etous || '',
            'Προβολή Χρήστη': split.user_view || '',
            'Ημ/νία Δημ. Κατανομής': split.created_at ? new Date(split.created_at).toLocaleDateString('el-GR') : '',
            'Ημ/νία Ενημ. Κατανομής': split.updated_at ? new Date(split.updated_at).toLocaleDateString('el-GR') : ''
          });
        });
      }
    });

    // Create a separate Budget Splits Only worksheet 
    const budgetSplitsOnly = budgetSplits ? budgetSplits.map(split => ({
      'ID': split.id || '',
      'ΜΙS': split.mis || '',
      'ΝΑ853': split.na853 || '',
      'ΠΡΟΙΠ': split.proip || '',
      'Ετήσια Πίστωση': split.ethsia_pistosi || '',
      'Α΄ Τρίμηνο': split.q1 || '',
      'Β΄ Τρίμηνο': split.q2 || '',
      'Γ΄ Τρίμηνο': split.q3 || '',
      'Δ΄ Τρίμηνο': split.q4 || '',
      'Κατανομές Έτους': split.katanomes_etous || '',
      'Προβολή Χρήστη': split.user_view || '',
      'Ημ/νία Δημιουργίας': split.created_at ? new Date(split.created_at).toLocaleDateString('el-GR') : '',
      'Ημ/νία Ενημέρωσης': split.updated_at ? new Date(split.updated_at).toLocaleDateString('el-GR') : ''
    })) : [];

    // Create the main workbook
    const wb = XLSX.utils.book_new();
    
    // Add the integrated projects and budget data worksheet
    const wsIntegrated = XLSX.utils.json_to_sheet(combinedData);
    
    // Set column widths for integrated worksheet
    const colWidthsIntegrated = Object.keys(combinedData[0] || {}).map(() => ({ wch: 18 }));
    wsIntegrated['!cols'] = colWidthsIntegrated;
    XLSX.utils.book_append_sheet(wb, wsIntegrated, 'Έργα με Κατανομές');

    // Add a worksheet with only Projects data (simplified view)
    const projectsOnly = projects.map(project => ({
      'ΜΙS': project.mis || '',
      'ΝΑ853': project.na853 || '',
      'Τίτλος': project.title || project.project_title || project.event_description || '',
      'Κατάσταση': project.status || '',
      'Προϋπολογισμός ΝΑ853': project.budget_na853 || '',
      'Προϋπολογισμός ΝΑ271': project.budget_na271 || '',
      'Προϋπολογισμός Ε069': project.budget_e069 || '',
      'Φορέας Υλοποίησης': Array.isArray(project.implementing_agency) ? project.implementing_agency.join(', ') : (project.implementing_agency || ''),
      'Τύπος Συμβάντος': Array.isArray(project.event_type) ? project.event_type.join(', ') : (project.event_type || ''),
      'Έτος Συμβάντος': Array.isArray(project.event_year) ? project.event_year.join(', ') : (project.event_year || ''),
      'Ημ/νία Δημιουργίας': project.created_at ? new Date(project.created_at).toLocaleDateString('el-GR') : ''
    }));
    
    const wsProjects = XLSX.utils.json_to_sheet(projectsOnly);
    const colWidthsProjects = Object.keys(projectsOnly[0] || {}).map(() => ({ wch: 18 }));
    wsProjects['!cols'] = colWidthsProjects;
    XLSX.utils.book_append_sheet(wb, wsProjects, 'Μόνο Έργα');

    // Add the Budget Splits Only worksheet
    const wsBudgets = XLSX.utils.json_to_sheet(budgetSplitsOnly);
    const colWidthsBudgets = Object.keys(budgetSplitsOnly[0] || {}).map(() => ({ wch: 18 }));
    wsBudgets['!cols'] = colWidthsBudgets;
    XLSX.utils.book_append_sheet(wb, wsBudgets, 'Μόνο Κατανομές');

    // Generate buffer and send the response
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format current date as dd-mm-yyyy
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

    // Use ASCII characters for the filename to avoid encoding issues
    const encodedFilename = `Projects-and-Budgets-${formattedDate}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"`);
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
router.get('/export/xlsx', exportProjectsXLSX);

// Update a project by MIS
router.patch('/:mis', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const updateData = req.body;
    
    console.log(`[Projects] Updating project with MIS: ${mis}`, updateData);

    if (!req.user) {
      console.error(`[Projects] No authenticated user found when updating MIS: ${mis}`);
      return res.status(401).json({ 
        message: "Authentication required"
      });
    }

    // First check if the project exists
    const { data: existingProject, error: findError } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', mis)
      .single();

    if (findError || !existingProject) {
      console.error(`[Projects] Project not found for MIS ${mis}`);
      return res.status(404).json({ 
        message: "Project not found",
        error: findError?.message || "Not found"
      });
    }

    // Map fields from the SQL export to actual database fields
    const fieldsToUpdate = {
      // Core fields
      title: updateData.title || existingProject.title,
      e069: updateData.e069 || existingProject.e069,
      na271: updateData.na271 || existingProject.na271,
      na853: updateData.na853 || existingProject.na853,
      event_description: updateData.event_description || existingProject.event_description,
      project_title: updateData.project_title || existingProject.project_title,
      event_type: updateData.event_type || existingProject.event_type,
      event_year: updateData.event_year || existingProject.event_year,
      region: updateData.region || existingProject.region,
      implementing_agency: updateData.implementing_agency || existingProject.implementing_agency,
      expenditure_type: updateData.expenditure_type || existingProject.expenditure_type,
      
      // Budget fields
      budget_e069: updateData.budget_e069 || existingProject.budget_e069,
      budget_na271: updateData.budget_na271 || existingProject.budget_na271,
      budget_na853: updateData.budget_na853 || existingProject.budget_na853,
      
      // Document fields
      kya: updateData.kya || existingProject.kya,
      fek: updateData.fek || existingProject.fek,
      ada: updateData.ada || existingProject.ada,
      ada_import_sana271: updateData.ada_import_sana271 || existingProject.ada_import_sana271,
      ada_import_sana853: updateData.ada_import_sana853 || existingProject.ada_import_sana853,
      budget_decision: updateData.budget_decision || existingProject.budget_decision,
      funding_decision: updateData.funding_decision || existingProject.funding_decision,
      allocation_decision: updateData.allocation_decision || existingProject.allocation_decision,
      
      // Status field
      status: updateData.status || existingProject.status,
      
      // Update the updated_at timestamp
      updated_at: new Date().toISOString()
    };

    // Perform the update
    const { data: updatedProject, error: updateError } = await supabase
      .from('Projects')
      .update(fieldsToUpdate)
      .eq('mis', mis)
      .select()
      .single();

    if (updateError) {
      console.error(`[Projects] Error updating project for MIS ${mis}:`, updateError);
      return res.status(500).json({ 
        message: "Failed to update project",
        error: updateError.message
      });
    }

    console.log(`[Projects] Successfully updated project with MIS: ${mis}`);
    res.json(updatedProject);
  } catch (error) {
    console.error(`[Projects] Error updating project:`, error);
    return res.status(500).json({
      message: "Failed to update project due to server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a project by MIS - placed last to avoid route conflicts
router.get('/:mis', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    console.log(`[Projects] Fetching project with MIS: ${mis}`);

    if (!req.user) {
      console.error(`[Projects] No authenticated user found when fetching MIS: ${mis}`);
      return res.status(401).json({ 
        message: "Authentication required"
      });
    }

    const { data: project, error } = await supabase
      .from('Projects') // Note the capital P to match the table name
      .select('*')
      .eq('mis', mis)
      .single();

    if (error) {
      console.error(`[Projects] Database error for MIS ${mis}:`, error);
      return res.status(500).json({ 
        message: "Failed to fetch project",
        error: error.message
      });
    }

    if (!project) {
      console.log(`[Projects] No project found with MIS: ${mis}`);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log(`[Projects] Successfully fetched project with MIS: ${mis}`);
    res.json(project);
  } catch (error) {
    console.error(`[Projects] Error fetching project:`, error);
    return res.status(500).json({
      message: "Failed to fetch project due to server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});