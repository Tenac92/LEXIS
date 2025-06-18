import { Request, Response } from "express";
import { supabase } from "../config/db";
import * as XLSX from 'xlsx';
import { Project, projectHelpers } from "@shared/models/project";
import { Router } from 'express';
import { authenticateSession } from '../authentication';
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

// Enhanced Excel export with both projects and budget data
export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    console.log('[Projects] Generating Excel export with projects and budget data');

    // Fetch all projects
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects for Excel export:', projectsError);
      return res.status(500).json({ 
        message: "Failed to fetch projects for export",
        error: projectsError.message
      });
    }

    // Fetch all budget splits
    const { data: budgetSplits, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .order('created_at', { ascending: false });

    if (budgetError) {
      console.warn('Warning: Could not fetch budget data for export:', budgetError);
    }

    if (!projects || projects.length === 0) {
      return res.status(404).json({ message: 'No projects found for export' });
    }

    // Create a combined dataset for the integrated view
    const combinedData: any[] = [];

    projects.forEach(project => {
      // Find all budget splits for this project (match by MIS or NA853)
      const projectSplits = budgetSplits?.filter(split => 
        split.mis?.toString() === project.mis?.toString() ||
        split.na853 === project.na853
      ) || [];

      // If no budget splits found, still include the project with empty budget data
      if (projectSplits.length === 0) {
        combinedData.push({
          // Project Core Data
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
          
          // Empty Budget Split Data
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
        projectSplits.forEach((split: any, index: number) => {
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
    res.setHeader('Content-Length', buffer.length.toString());

    res.end(buffer);
    console.log(`[Projects] Excel export successful: ${encodedFilename}`);
  } catch (error) {
    console.error("Error generating Excel export:", error);
    res.status(500).json({ 
      message: "Failed to generate Excel export",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Bulk update projects
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: 'Updates must be an array' });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        // Validate that we have an MIS to identify the project
        if (!update.mis) {
          errors.push({ mis: 'unknown', error: 'MIS is required for updates' });
          continue;
        }

        // Only include fields that should be updated
        const validData = {};
        const allowedFields = ['title', 'status', 'budget_na853', 'budget_na271', 'budget_e069'];
        
        allowedFields.forEach(field => {
          if (update[field] !== undefined) {
            (validData as any)[field] = update[field];
          }
        });

        // Update the project
        const { data, error } = await supabase
          .from('Projects')
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
    let { unitName } = req.params;
    
    if (!unitName) {
      return res.status(400).json({ message: 'Unit name is required' });
    }
    
    // Decode URL-encoded Greek characters
    try {
      unitName = decodeURIComponent(unitName);
    } catch (decodeError) {
      console.log(`[Projects] Unit name decode error, using original: ${unitName}`);
    }
    
    console.log(`[Projects] Fetching projects for unit: ${unitName}`);
    console.log(`[Projects] Unit name after decoding: "${unitName}" (length: ${unitName.length})`);
    
    // Use the storage method which correctly handles filtering by implementing_agency
    const projects = await storage.getProjectsByUnit(unitName);
    console.log(`[Projects] Storage returned ${projects?.length || 0} projects`);
    
    if (!projects || projects.length === 0) {
      console.log(`[Projects] No projects found for unit: ${unitName}`);
      return res.json([]);
    }
    
    // Return projects directly without strict validation to avoid schema issues
    const formattedProjects = projects.map(project => {
      // Basic safety formatting without strict validation
      return {
        ...project,
        mis: project.mis?.toString() || '',
        status: project.status || 'pending',
        budget_na853: project.budget_na853 || 0,
        implementing_agency: Array.isArray(project.implementing_agency) ? project.implementing_agency : [],
        expenditure_type: Array.isArray(project.expenditure_type) ? project.expenditure_type : []
      };
    });
    
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

// Note: Project regions endpoint moved to routes.ts using optimized schema
// This endpoint was removed to prevent database column errors

// Mount routes
router.get('/', listProjects);
router.get('/export', exportProjectsXLSX);
router.get('/export/xlsx', exportProjectsXLSX);

// Update a project by MIS
router.patch('/:mis', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
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

    // Get enhanced data for the updated project
    const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('Monada').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const monadaData = monadaRes.data || [];
    const kallikratisData = kallikratisRes.data || [];
    const indexData = indexRes.data || [];

    // Find enhanced data for this project
    const indexItem = indexData.find(idx => idx.project_id === updatedProject.id);
    const eventType = indexItem ? eventTypes.find(et => et.id === indexItem.event_types_id) : null;
    const expenditureType = indexItem ? expenditureTypes.find(et => et.id === indexItem.expediture_type_id) : null;
    const monada = indexItem ? monadaData.find(m => m.id === indexItem.monada_id) : null;
    const kallikratis = indexItem ? kallikratisData.find(k => k.id === indexItem.kallikratis_id) : null;

    // Return the updated project with enhanced data
    const enhancedProject = {
      ...updatedProject,
      enhanced_event_type: eventType ? {
        id: eventType.id,
        name: eventType.name
      } : null,
      enhanced_expenditure_type: expenditureType ? {
        id: expenditureType.id,
        name: expenditureType.expediture_types
      } : null,
      enhanced_unit: monada ? {
        id: monada.id,
        name: monada.unit
      } : null,
      enhanced_kallikratis: kallikratis ? {
        id: kallikratis.id,
        name: kallikratis.perifereia || kallikratis.onoma_dimou_koinotitas,
        level: kallikratis.level || 'municipality'
      } : null
    };

    console.log(`[Projects] Successfully updated project with MIS: ${mis}`);
    res.json(enhancedProject);
  } catch (error) {
    console.error(`[Projects] Error updating project:`, error);
    res.status(500).json({ 
      message: "Failed to update project",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get single project by MIS with enhanced data
router.get('/:mis', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    
    console.log(`[Projects] Fetching project with MIS: ${mis}`);

    if (!req.user) {
      console.error(`[Projects] No authenticated user found when fetching MIS: ${mis}`);
      return res.status(401).json({ 
        message: "Authentication required"
      });
    }

    // Get project data with enhanced information
    const [projectRes, eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('Projects').select('*').eq('mis', mis).single(),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('Monada').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    if (projectRes.error || !projectRes.data) {
      console.error(`[Projects] Project not found for MIS ${mis}`);
      return res.status(404).json({ 
        message: "Project not found",
        error: projectRes.error?.message || "Not found"
      });
    }

    const project = projectRes.data;
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const monadaData = monadaRes.data || [];
    const kallikratisData = kallikratisRes.data || [];
    const indexData = indexRes.data || [];

    // Find enhanced data for this project
    const indexItem = indexData.find(idx => idx.project_id === project.id);
    const eventType = indexItem ? eventTypes.find(et => et.id === indexItem.event_types_id) : null;
    const expenditureType = indexItem ? expenditureTypes.find(et => et.id === indexItem.expediture_type_id) : null;
    const monada = indexItem ? monadaData.find(m => m.id === indexItem.monada_id) : null;
    const kallikratis = indexItem ? kallikratisData.find(k => k.id === indexItem.kallikratis_id) : null;

    // Return project with enhanced data
    const enhancedProject = {
      ...project,
      enhanced_event_type: eventType ? {
        id: eventType.id,
        name: eventType.name
      } : null,
      enhanced_expenditure_type: expenditureType ? {
        id: expenditureType.id,
        name: expenditureType.expediture_types
      } : null,
      enhanced_unit: monada ? {
        id: monada.id,
        name: monada.unit
      } : null,
      enhanced_kallikratis: kallikratis ? {
        id: kallikratis.id,
        name: kallikratis.perifereia || kallikratis.onoma_dimou_koinotitas,
        level: kallikratis.level || 'municipality'
      } : null
    };

    console.log(`[Projects] Found project with MIS: ${mis}`);
    res.json(enhancedProject);
  } catch (error) {
    console.error(`[Projects] Error fetching project:`, error);
    res.status(500).json({ 
      message: "Failed to fetch project",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export { router as projectsRouter };