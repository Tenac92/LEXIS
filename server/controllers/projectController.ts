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
    console.log('[Projects] Fetching all projects with optimized schema');
    
    // Get projects with enhanced data using optimized schema
    const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('Projects').select('*').order('created_at', { ascending: false }),
      supabase.from('Monada').select('*'),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    if (projectsRes.error) {
      console.error("Database error:", projectsRes.error);
      return res.status(500).json({ 
        message: "Failed to fetch projects from database",
        error: projectsRes.error.message
      });
    }

    if (!projectsRes.data) {
      return res.status(404).json({ message: 'No projects found' });
    }

    const projects = projectsRes.data;
    const monadaData = monadaRes.data || [];
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const kallikratisData = kallikratisRes.data || [];
    const indexData = indexRes.data || [];

    // Enhance projects with optimized schema data
    const enhancedProjects = projects.map(project => {
      try {
        // Get all index entries for this project
        const projectIndexItems = indexData.filter(idx => idx.project_id === project.id);
        
        // Get enhanced data
        const eventTypeData = projectIndexItems.length > 0 ? 
          eventTypes.find(et => et.id === projectIndexItems[0].event_types_id) : null;
        const expenditureTypeData = projectIndexItems.length > 0 ? 
          expenditureTypes.find(et => et.id === projectIndexItems[0].expediture_type_id) : null;
        const monadaData_item = projectIndexItems.length > 0 ? 
          monadaData.find(m => m.id === projectIndexItems[0].monada_id) : null;
        const kallikratisData_item = projectIndexItems.length > 0 ? 
          kallikratisData.find(k => k.id === projectIndexItems[0].kallikratis_id) : null;

        // Get all expenditure types for this project
        const allExpenditureTypes = projectIndexItems
          .map(idx => expenditureTypes.find(et => et.id === idx.expediture_type_id))
          .filter(et => et !== null && et !== undefined)
          .map(et => et.expediture_types);
        const uniqueExpenditureTypes = Array.from(new Set(allExpenditureTypes));

        // Get all event types for this project
        const allEventTypes = projectIndexItems
          .map(idx => eventTypes.find(et => et.id === idx.event_types_id))
          .filter(et => et !== null && et !== undefined)
          .map(et => et.name);
        const uniqueEventTypes = Array.from(new Set(allEventTypes));

        const enhancedProject = {
          ...project,
          enhanced_event_type: eventTypeData ? {
            id: eventTypeData.id,
            name: eventTypeData.name
          } : null,
          enhanced_expenditure_type: expenditureTypeData ? {
            id: expenditureTypeData.id,
            name: expenditureTypeData.expediture_types
          } : null,
          enhanced_unit: monadaData_item ? {
            id: monadaData_item.id,
            name: monadaData_item.unit
          } : null,
          enhanced_kallikratis: kallikratisData_item ? {
            id: kallikratisData_item.id,
            name: kallikratisData_item.perifereia || kallikratisData_item.onoma_dimou_koinotitas,
            level: kallikratisData_item.level || 'municipality'
          } : null,
          // Add arrays for backward compatibility
          expenditure_types: uniqueExpenditureTypes,
          event_types: uniqueEventTypes
        };

        return projectHelpers.validateProject(enhancedProject);
      } catch (error) {
        console.error('Project validation error:', error);
        return null;
      }
    }).filter((project): project is Project => project !== null);

    res.json(enhancedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
}

// Enhanced Excel export with both projects and budget data
export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    console.log('[Projects] Generating Excel export with projects and budget data');

    // Fetch all projects with enhanced data using optimized schema
    const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('Projects').select('*').order('created_at', { ascending: false }),
      supabase.from('Monada').select('*'),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    if (projectsRes.error) {
      console.error('Error fetching projects for Excel export:', projectsRes.error);
      return res.status(500).json({ 
        message: "Failed to fetch projects for export",
        error: projectsRes.error.message
      });
    }

    const projects = projectsRes.data;
    const monadaData = monadaRes.data || [];
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const kallikratisData = kallikratisRes.data || [];
    const indexData = indexRes.data || [];

    // Enhance projects with optimized schema data
    const enhancedProjects = projects.map(project => {
      const projectIndexItems = indexData.filter(idx => idx.project_id === project.id);
      
      // Get all expenditure types for this project
      const allExpenditureTypes = projectIndexItems
        .map(idx => expenditureTypes.find(et => et.id === idx.expediture_type_id))
        .filter(et => et !== null && et !== undefined)
        .map(et => et.expediture_types);
      const uniqueExpenditureTypes = Array.from(new Set(allExpenditureTypes));

      // Get all event types for this project
      const allEventTypes = projectIndexItems
        .map(idx => eventTypes.find(et => et.id === idx.event_types_id))
        .filter(et => et !== null && et !== undefined)
        .map(et => et.name);
      const uniqueEventTypes = Array.from(new Set(allEventTypes));

      const eventType = projectIndexItems.length > 0 ? 
        eventTypes.find(et => et.id === projectIndexItems[0].event_types_id) : null;
      const expenditureType = projectIndexItems.length > 0 ? 
        expenditureTypes.find(et => et.id === projectIndexItems[0].expediture_type_id) : null;
      const monadaItem = projectIndexItems.length > 0 ? 
        monadaData.find(m => m.id === projectIndexItems[0].monada_id) : null;
      const kallikratisItem = projectIndexItems.length > 0 ? 
        kallikratisData.find(k => k.id === projectIndexItems[0].kallikratis_id) : null;

      return {
        ...project,
        enhanced_event_type: eventType ? {
          id: eventType.id,
          name: eventType.name
        } : null,
        enhanced_expenditure_type: expenditureType ? {
          id: expenditureType.id,
          name: expenditureType.expediture_types
        } : null,
        enhanced_unit: monadaItem ? {
          id: monadaItem.id,
          name: monadaItem.unit
        } : null,
        enhanced_kallikratis: kallikratisItem ? {
          id: kallikratisItem.id,
          name: kallikratisItem.perifereia || kallikratisItem.onoma_dimou_koinotitas,
          level: kallikratisItem.level || 'municipality'
        } : null,
        expenditure_types: uniqueExpenditureTypes,
        event_types: uniqueEventTypes
      };
    });

    // Fetch all budget splits
    const { data: budgetSplits, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .order('created_at', { ascending: false });

    if (budgetError) {
      console.warn('Warning: Could not fetch budget data for export:', budgetError);
    }

    if (!enhancedProjects || enhancedProjects.length === 0) {
      return res.status(404).json({ message: 'No projects found for export' });
    }

    // Create a combined dataset for the integrated view
    const combinedData: any[] = [];

    enhancedProjects.forEach(project => {
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

    // Handle project_index table updates for proper foreign key relationships
    if (updateData.project_lines && Array.isArray(updateData.project_lines)) {
      console.log(`[Projects] Updating project_index entries for project ID: ${updatedProject.id}`);
      
      // First, delete existing project_index entries for this project
      const { error: deleteError } = await supabase
        .from('project_index')
        .delete()
        .eq('project_id', updatedProject.id);

      if (deleteError) {
        console.error(`[Projects] Error deleting existing project_index entries:`, deleteError);
      }

      // Insert new project_index entries from project_lines
      for (const line of updateData.project_lines) {
        try {
          // Find foreign key IDs from the provided data
          let eventTypeId = null;
          let expenditureTypeId = null;
          let monadaId = null;
          let kallikratisId = null;

          // Get reference data if not already available
          const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
            supabase.from('event_types').select('*'),
            supabase.from('expediture_types').select('*'),
            supabase.from('Monada').select('*'),
            supabase.from('kallikratis').select('*')
          ]);

          const eventTypes = eventTypesRes.data || [];
          const expenditureTypes = expenditureTypesRes.data || [];
          const monadaData = monadaRes.data || [];
          const kallikratisData = kallikratisRes.data || [];

          // Find event type ID
          if (line.event_type) {
            const eventType = eventTypes.find(et => 
              et.id === line.event_type || et.name === line.event_type
            );
            eventTypeId = eventType?.id || null;
          }

          // Find implementing agency (Monada) ID - ensure it's integer
          if (line.implementing_agency) {
            console.log(`[Projects] DEBUG: Looking for agency: "${line.implementing_agency}"`);
            console.log(`[Projects] DEBUG: Available agencies:`, monadaData.map(m => ({ id: m.id, unit: m.unit, unit_name: m.unit_name })));
            
            const monada = monadaData.find(m => 
              m.id == line.implementing_agency || 
              m.unit === line.implementing_agency || 
              m.unit_name === line.implementing_agency ||
              // Try partial matching for long agency names
              (m.unit_name && line.implementing_agency.includes(m.unit_name)) ||
              (m.unit && line.implementing_agency.includes(m.unit))
            );
            monadaId = monada ? parseInt(monada.id) : null;
            console.log(`[Projects] Found monada_id: ${monadaId} for agency: ${line.implementing_agency}`);
            if (!monada) {
              console.log(`[Projects] WARNING: No matching agency found for: "${line.implementing_agency}"`);
            }
          }

          // Find kallikratis ID from region hierarchy
          if (line.region) {
            if (line.region.kallikratis_id) {
              // Use provided kallikratis_id
              kallikratisId = line.region.kallikratis_id;
              console.log(`[Projects] Using provided kallikratis_id: ${kallikratisId}`);
            } else {
              // Try to find kallikratis entry by matching region hierarchy
              const kallikratis = kallikratisData.find(k => 
                k.perifereia === line.region.perifereia && 
                k.perifereiaki_enotita === line.region.perifereiaki_enotita &&
                k.onoma_neou_ota === line.region.dimos &&
                k.onoma_dimotikis_enotitas === line.region.dimotiki_enotita
              );
              kallikratisId = kallikratis?.id || null;
              console.log(`[Projects] Lookup found kallikratis_id: ${kallikratisId}`);
            }
          }

          // Create project_index entries if we have essential values (relaxed requirement)
          if (eventTypeId && kallikratisId) {
            console.log(`[Projects] Creating project_index entry with eventTypeId: ${eventTypeId}, monadaId: ${monadaId}, kallikratisId: ${kallikratisId}`);
            if (!monadaId) {
              console.log(`[Projects] WARNING: Proceeding without monada_id - may need manual correction`);
            }
            // Find expenditure type IDs (multiple values)
            if (line.expenditure_types && Array.isArray(line.expenditure_types) && line.expenditure_types.length > 0) {
              for (const expType of line.expenditure_types) {
                const expenditureType = expenditureTypes.find(et => 
                  et.id === expType || et.expediture_types === expType
                );
                expenditureTypeId = expenditureType?.id || null;
                
                // Create project_index entry for each expenditure type
                if (expenditureTypeId) {
                  // Calculate geographic code based on available location data
                  let geographicCode = null;
                  
                  if (kallikratisData && kallikratisId) {
                    const kallikratisEntry = kallikratisData.find(k => k.id === kallikratisId);
                    if (kallikratisEntry && line.region) {
                      // Determine geographic level automatically and get appropriate code
                      if (line.region.dimos && line.region.dimotiki_enotita) {
                        // Municipal Community level - use kodikos_dimotikis_enotitas
                        geographicCode = kallikratisEntry.kodikos_dimotikis_enotitas;
                        console.log(`[Projects] Municipal Community level, Code: ${geographicCode}`);
                      } else if (line.region.dimos) {
                        // Municipality level - use kodikos_neou_ota
                        geographicCode = kallikratisEntry.kodikos_neou_ota;
                        console.log(`[Projects] Municipality level, Code: ${geographicCode}`);
                      } else if (line.region.perifereiaki_enotita) {
                        // Regional unit level - use kodikos_perifereiakis_enotitas
                        geographicCode = kallikratisEntry.kodikos_perifereiakis_enotitas;
                        console.log(`[Projects] Regional unit level, Code: ${geographicCode}`);
                      } else if (line.region.perifereia) {
                        // Regional level - use kodikos_perifereias
                        geographicCode = kallikratisEntry.kodikos_perifereias;
                        console.log(`[Projects] Regional level, Code: ${geographicCode}`);
                      }
                    }
                  }
                  
                  const indexEntry: any = {
                    project_id: updatedProject.id,
                    event_types_id: eventTypeId,
                    expediture_type_id: expenditureTypeId,
                    kallikratis_id: kallikratisId
                  };
                  
                  // Only add monada_id if it's not null
                  if (monadaId !== null) {
                    indexEntry.monada_id = monadaId;
                  }
                  
                  // Add geographic code if available
                  if (geographicCode) {
                    indexEntry.geographic_code = geographicCode;
                    console.log(`[Projects] Added geographic_code: ${geographicCode}`);
                  }

                  console.log(`[Projects] Inserting project_index entry:`, indexEntry);
                  const { error: insertError } = await supabase
                    .from('project_index')
                    .insert(indexEntry);

                  if (insertError) {
                    console.error(`[Projects] Error inserting project_index entry:`, insertError);
                  } else {
                    console.log(`[Projects] Successfully created project_index entry for expenditure type: ${expType}`);
                  }
                } else {
                  console.warn(`[Projects] Could not find expenditure type ID for: ${expType}`);
                }
              }
            } else {
              // Use default expenditure type if none specified
              const defaultExpenditureType = expenditureTypes.find(et => et.expediture_types === "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ") || expenditureTypes[0];
              if (defaultExpenditureType) {
                // Calculate geographic code for default entry
                let geographicCode = null;
                
                if (kallikratisData && kallikratisId) {
                  const kallikratisEntry = kallikratisData.find(k => k.id === kallikratisId);
                  if (kallikratisEntry && line.region) {
                    // Determine geographic level automatically and get appropriate code
                    if (line.region.dimos && line.region.dimotiki_enotita) {
                      // Municipal Community level - use kodikos_dimotikis_enotitas
                      geographicCode = kallikratisEntry.kodikos_dimotikis_enotitas;
                    } else if (line.region.dimos) {
                      // Municipality level - use kodikos_neou_ota
                      geographicCode = kallikratisEntry.kodikos_neou_ota;
                    } else if (line.region.perifereiaki_enotita) {
                      // Regional unit level - use kodikos_perifereiakis_enotitas
                      geographicCode = kallikratisEntry.kodikos_perifereiakis_enotitas;
                    } else if (line.region.perifereia) {
                      // Regional level - use kodikos_perifereias
                      geographicCode = kallikratisEntry.kodikos_perifereias;
                    }
                  }
                }
                
                const indexEntry: any = {
                  project_id: updatedProject.id,
                  event_types_id: eventTypeId,
                  expediture_type_id: defaultExpenditureType.id,
                  kallikratis_id: kallikratisId
                };
                
                // Only add monada_id if it's not null
                if (monadaId !== null) {
                  indexEntry.monada_id = monadaId;
                }
                
                // Add geographic code if available
                if (geographicCode) {
                  indexEntry.geographic_code = geographicCode;
                  console.log(`[Projects] Default entry added geographic_code: ${geographicCode}`);
                }

                console.log(`[Projects] Inserting default project_index entry:`, indexEntry);
                const { error: insertError } = await supabase
                  .from('project_index')
                  .insert(indexEntry);

                if (insertError) {
                  console.error(`[Projects] Error inserting default project_index entry:`, insertError);
                } else {
                  console.log(`[Projects] Successfully created default project_index entry`);
                }
              }
            }
          } else {
            console.warn(`[Projects] Missing required values for project_index - eventTypeId: ${eventTypeId}, monadaId: ${monadaId}, kallikratisId: ${kallikratisId}`);
          }
        } catch (lineError) {
          console.error(`[Projects] Error processing project line:`, lineError);
        }
      }
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

    // Get project data with enhanced information including project_history
    const [projectRes, eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('Projects').select('*').eq('mis', mis).single(),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('Monada').select('*'),
      supabase.from('kallikratis').select('*'),
      supabase.from('project_index').select('*')
    ]);

    // Get project_history data separately after we have the project ID
    let historyData = null;
    if (projectRes.data) {
      const { data: history } = await supabase
        .from('project_history')
        .select('*')
        .eq('project_id', projectRes.data.id)
        .single();
      historyData = history;
    }

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

    // Get decision data from project_history instead of duplicated columns
    const decisions = historyData?.decisions || [];
    const decisionData = decisions.length > 0 ? decisions[0] : {};

    // Return project with enhanced data, structuring decision data from project_history
    const enhancedProject = {
      // Core project data (keeping only essential fields)
      id: project.id,
      mis: project.mis,
      project_title: project.project_title,
      event_description: project.event_description,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
      // Budget and code fields (keeping for calculations)
      budget_e069: project.budget_e069,
      budget_na271: project.budget_na271,
      budget_na853: project.budget_na853,
      e069: project.e069,
      na271: project.na271,
      na853: project.na853,
      event_year: project.event_year,
      
      // Enhanced relational data
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
      } : null,
      
      // Decision data from project_history (replacing duplicated columns)
      decisions: historyData?.decisions || [],
      decision_data: {
        kya: decisionData.protocol_number || project.kya,  // Fallback during transition
        fek: decisionData.fek || project.fek,
        ada: decisionData.ada || project.ada,
        implementing_agency: decisionData.implementing_agency,
        decision_budget: decisionData.decision_budget,
        expenses_covered: decisionData.expenses_covered,
        decision_type: decisionData.decision_type,
        is_included: decisionData.is_included,
        comments: decisionData.comments
      },
      
      // Structured data from project_history
      formulation: historyData?.formulation || [],
      changes: historyData?.changes || [],
      
      // Backward compatibility - keep some original fields for components that still need them
      kya: decisionData.protocol_number || project.kya,
      fek: decisionData.fek || project.fek,
      ada: decisionData.ada || project.ada
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