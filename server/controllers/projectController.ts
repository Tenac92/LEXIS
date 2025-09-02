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
      supabase.from('expenditure_types').select('*'),
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
          expenditureTypes.find(et => et.id === projectIndexItems[0].expenditure_type_id) : null;
        const monadaData_item = projectIndexItems.length > 0 ? 
          monadaData.find(m => m.id === projectIndexItems[0].monada_id) : null;
        const kallikratisData_item = projectIndexItems.length > 0 ? 
          kallikratisData.find(k => k.id === projectIndexItems[0].kallikratis_id) : null;

        // Get all expenditure types for this project
        const allExpenditureTypes = projectIndexItems
          .map(idx => expenditureTypes.find(et => et.id === idx.expenditure_type_id))
          .filter(et => et !== null && et !== undefined)
          .map(et => et.expenditure_types);
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
            name: expenditureTypeData.expenditure_types
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
      supabase.from('expenditure_types').select('*'),
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
        .map(idx => expenditureTypes.find(et => et.id === idx.expenditure_type_id))
        .filter(et => et !== null && et !== undefined)
        .map(et => et.expenditure_types);
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
        expenditureTypes.find(et => et.id === projectIndexItems[0].expenditure_type_id) : null;
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
          name: expenditureType.expenditure_types
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
      .from('project_budget')
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
    
    // Return projects with proper formatting (manually constructed to avoid type errors)
    const formattedProjects = projects.map(project => {
      return {
        id: project.id,
        mis: project.mis?.toString() || '',
        e069: project.e069 || '',
        na271: project.na271 || '',
        na853: project.na853 || '',
        event_description: project.event_description || '',
        project_title: project.project_title || '',
        event_year: project.event_year || [],
        budget_e069: project.budget_e069 || 0,
        budget_na271: project.budget_na271 || 0,
        budget_na853: project.budget_na853 || 0,
        status: project.status || 'pending',
        event_type_id: project.event_type_id || null,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // Fields that were removed but frontend expects
        implementing_agency: [],
        expenditure_type: []
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

// Get complete project data in one call (optimized for performance)
// This endpoint is public as it's used for read-only viewing
router.get('/:mis/complete', async (req: Request, res: Response) => {
  try {
    const { mis } = req.params;
    
    if (!mis) {
      return res.status(400).json({ message: 'MIS parameter is required' });
    }
    
    console.log(`[ProjectComplete] Fetching complete data for project MIS: ${mis}`);
    
    // First get the project to extract the ID for related tables
    // Optimization: Use project_id if available, otherwise look up by MIS
    let projectId: number;
    let projectData: any;
    
    // Check if mis is actually a numeric ID
    const numericMis = parseInt(mis);
    if (!isNaN(numericMis) && numericMis.toString() === mis) {
      // Try to fetch by ID first for better performance
      const { data: projectById, error: idError } = await supabase
        .from('Projects')
        .select('*')
        .eq('id', numericMis)
        .single();
        
      if (!idError && projectById) {
        projectData = projectById;
        projectId = projectById.id;
        console.log(`[ProjectComplete] Found project by ID: ${projectId}`);
      } else {
        // Fallback to MIS lookup
        const { data: projectByMis, error: misError } = await supabase
          .from('Projects')
          .select('*')
          .eq('mis', mis)
          .single();
          
        if (misError || !projectByMis) {
          console.error('Error fetching project by MIS:', misError);
          return res.status(404).json({ message: 'Project not found', error: misError?.message });
        }
        
        projectData = projectByMis;
        projectId = projectByMis.id;
      }
    } else {
      // Non-numeric MIS, use standard lookup
      const { data: projectByMis, error: misError } = await supabase
        .from('Projects')
        .select('*')
        .eq('mis', mis)
        .single();
        
      if (misError || !projectByMis) {
        console.error('Error fetching project by MIS:', misError);
        return res.status(404).json({ message: 'Project not found', error: misError?.message });
      }
      
      projectData = projectByMis;
      projectId = projectByMis.id;
    }
    
    // PERFORMANCE OPTIMIZATION: Fetch only essential project-specific data first
    // Reference data will be cached and loaded separately
    const [
      decisionsRes,
      formulationsRes,
      indexRes
    ] = await Promise.all([
      supabase.from('project_decisions').select('*').eq('project_id', projectId).order('decision_sequence'),
      supabase.from('project_formulations').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('project_index').select('*').eq('project_id', projectId)
    ]);

    // Fetch reference data with optimized queries and smaller limits for initial load
    const [
      eventTypesRes,
      unitsRes,
      expenditureTypesRes
    ] = await Promise.all([
      supabase.from('event_types').select('id, name').limit(50), // Only essential fields
      supabase.from('Monada').select('id, unit, unit_name').limit(30), // Only essential fields  
      supabase.from('expenditure_types').select('id, expenditure_types').limit(30) // Only essential fields
    ]);

    // Check for errors in reference data queries
    if (eventTypesRes.error) {
      console.error('[ProjectComplete] Error fetching event types:', eventTypesRes.error);
    }
    if (unitsRes.error) {
      console.error('[ProjectComplete] Error fetching units:', unitsRes.error);
    }
    if (expenditureTypesRes.error) {
      console.error('[ProjectComplete] Error fetching expenditure types:', expenditureTypesRes.error);
    }
    
    // Enhance project data with related information
    const eventTypes = eventTypesRes.data || [];
    const units = unitsRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    
    console.log(`[ProjectComplete] Before kallikratis loading - got ${eventTypes.length} eventTypes, ${units.length} units, ${expenditureTypes.length} expenditureTypes`);
    
    // Load both old kallikratis data (for fallback) and new normalized geographic data
    let kallikratis: any[] = [];
    let regions: any[] = [];
    let regionalUnits: any[] = [];
    let municipalities: any[] = [];
    
    try {
      console.log('[ProjectComplete] Attempting to load kallikratis data...');
      const kallikratisResponse = await supabase
        .from('kallikratis')
        .select('id, perifereia, perifereiaki_enotita, onoma_neou_ota, kodikos_neou_ota, kodikos_perifereiakis_enotitas, kodikos_perifereias, eidos_neou_ota')
        .limit(1000); // Reduced from 2000 for faster initial load
      
      if (kallikratisResponse.error) {
        console.error('[ProjectComplete] Kallikratis query error:', kallikratisResponse.error);
      } else {
        kallikratis = kallikratisResponse.data || [];
        console.log(`[ProjectComplete] Successfully loaded ${kallikratis.length} kallikratis entries for complete data`);
      }
    } catch (kallikratisError) {
      console.warn('[ProjectComplete] Kallikratis data load failed, continuing without:', kallikratisError);
    }

    // Load normalized geographic data
    try {
      console.log('[ProjectComplete] Loading normalized geographic data...');
      const [regionsRes, regionalUnitsRes, municipalitiesRes] = await Promise.all([
        supabase.from('regions').select('*'),
        supabase.from('regional_units').select('*'),
        supabase.from('municipalities').select('*')
      ]);

      regions = regionsRes.data || [];
      regionalUnits = regionalUnitsRes.data || [];
      municipalities = municipalitiesRes.data || [];
      
      console.log(`[ProjectComplete] Loaded normalized geographic data: ${regions.length} regions, ${regionalUnits.length} regional units, ${municipalities.length} municipalities`);
    } catch (geoError) {
      console.warn('[ProjectComplete] Normalized geographic data load failed:', geoError);
    }
    
    // Get related data from project_index entries (the most common ones)
    const projectIndex = indexRes.data || [];
    console.log(`[ProjectComplete] Project has ${projectIndex.length} index entries`);
    
    // Fetch project-specific geographic relationships from junction tables
    let projectRegions: any[] = [];
    let projectRegionalUnits: any[] = [];
    let projectMunicipalities: any[] = [];
    
    if (projectIndex.length > 0) {
      try {
        console.log(`[ProjectComplete] Fetching geographic relationships for project index entries`);
        
        // Get all project_index IDs for this project
        const projectIndexIds = projectIndex.map(idx => idx.id);
        
        // Fetch geographic relationships from junction tables
        const [regionsJunctionRes, unitsJunctionRes, munisJunctionRes] = await Promise.all([
          supabase.from('project_index_regions')
            .select(`
              region_code,
              regions (
                code,
                name
              )
            `)
            .in('project_index_id', projectIndexIds),
          supabase.from('project_index_units')
            .select(`
              unit_code,
              regional_units (
                code,
                name,
                region_code
              )
            `)
            .in('project_index_id', projectIndexIds),
          supabase.from('project_index_munis')
            .select(`
              muni_code,
              municipalities (
                code,
                name,
                unit_code
              )
            `)
            .in('project_index_id', projectIndexIds)
        ]);

        projectRegions = regionsJunctionRes.data || [];
        projectRegionalUnits = unitsJunctionRes.data || [];
        projectMunicipalities = munisJunctionRes.data || [];
        
        console.log(`[ProjectComplete] Found geographic relationships: ${projectRegions.length} regions, ${projectRegionalUnits.length} units, ${projectMunicipalities.length} municipalities`);
      } catch (junctionError) {
        console.warn('[ProjectComplete] Failed to fetch geographic relationships from junction tables:', junctionError);
      }
    }
    
    // Find the most common values from project_index (for enhanced fields)
    const mostCommonUnit = projectIndex.length > 0 ? 
      units.find(u => u.id === projectIndex[0].monada_id) : null;
    const mostCommonKallikratis = projectIndex.length > 0 ? 
      kallikratis.find(k => k.id === projectIndex[0].kallikratis_id) : null;
    const mostCommonExpenditure = projectIndex.length > 0 ? 
      expenditureTypes.find(et => et.id === projectIndex[0].expenditure_type_id) : null;
    
    // Find event type from direct field
    const eventType = eventTypes.find(et => et.id === projectData.event_type_id);
    

    
    // Create enhanced project data
    const enhancedProject = {
      ...projectData,
      enhanced_event_type: eventType ? {
        id: eventType.id,
        name: eventType.name
      } : null,
      enhanced_expenditure_type: mostCommonExpenditure ? {
        id: mostCommonExpenditure.id,
        name: mostCommonExpenditure.expenditure_types
      } : null,
      enhanced_unit: mostCommonUnit ? {
        id: mostCommonUnit.id,
        name: mostCommonUnit.unit || mostCommonUnit.name
      } : null,
      enhanced_kallikratis: mostCommonKallikratis ? {
        id: mostCommonKallikratis.id,
        name: mostCommonKallikratis.perifereia || mostCommonKallikratis.onoma_dimou_koinotitas,
        level: mostCommonKallikratis.level || 'municipality'
      } : null
    };

    const completeData = {
      project: enhancedProject,
      decisions: decisionsRes.data || [],
      formulations: formulationsRes.data || [],
      index: indexRes.data || [],
      eventTypes: eventTypes,
      units: units,
      kallikratis: kallikratis,
      expenditureTypes: expenditureTypes,
      // New normalized geographic data
      regions: regions,
      regionalUnits: regionalUnits,
      municipalities: municipalities,
      // Project-specific geographic relationships
      projectGeographicData: {
        regions: projectRegions,
        regionalUnits: projectRegionalUnits,
        municipalities: projectMunicipalities
      }
    };
    
    console.log(`[ProjectComplete] Successfully fetched complete data for project ${projectId}`);
    console.log(`[ProjectComplete] Data counts: decisions=${completeData.decisions.length}, formulations=${completeData.formulations.length}, index=${completeData.index.length}, eventTypes=${completeData.eventTypes.length}, units=${completeData.units.length}, expenditureTypes=${completeData.expenditureTypes.length}, kallikratis=${completeData.kallikratis.length}, regions=${completeData.regions.length}, regionalUnits=${completeData.regionalUnits.length}, municipalities=${completeData.municipalities.length}`);
    
    res.json(completeData);
  } catch (error) {
    console.error('[ProjectComplete] Error fetching complete project data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch complete project data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Separate endpoint for reference data that can be heavily cached
router.get('/reference-data', async (req: Request, res: Response) => {
  try {
    console.log('[ProjectReference] Fetching reference data');
    
    // Fetch all reference data in parallel with optimized queries
    const [
      eventTypesRes,
      unitsRes,
      expenditureTypesRes,
      projectIndexRes
    ] = await Promise.all([
      supabase.from('event_types').select('id, name').limit(100),
      supabase.from('Monada').select('id, unit, unit_name').limit(50),
      supabase.from('expenditure_types').select('id, expenditure_types').limit(50),
      supabase.from('project_index').select('kallikratis_id').limit(5000)
    ]);

    // Extract unique kallikratis_ids from project_index
    const indexData = projectIndexRes.data || [];
    const kallikratisIdList = indexData
      .map((item: any) => item.kallikratis_id)
      .filter((id: any) => id !== null && id !== undefined);
    
    const uniqueKallikratisIds = Array.from(new Set(kallikratisIdList));

    // Fetch actual kallikratis data for these IDs
    let kallikratisFromIndex: any[] = [];
    if (uniqueKallikratisIds.length > 0) {
      const kallikratisRes = await supabase
        .from('kallikratis')
        .select('id, perifereia, perifereiaki_enotita, onoma_neou_ota, kodikos_neou_ota, kodikos_perifereiakis_enotitas, kodikos_perifereias, eidos_neou_ota')
        .in('id', uniqueKallikratisIds);
      
      if (kallikratisRes.data && kallikratisRes.data.length > 0) {
        kallikratisFromIndex = kallikratisRes.data.sort((a: any, b: any) => {
          const levelOrder: { [key: string]: number } = { 'region': 1, 'prefecture': 2, 'municipality': 3, 'municipal_unit': 4 };
          if (levelOrder[a.level] !== levelOrder[b.level]) {
            return levelOrder[a.level] - levelOrder[b.level];
          }
          const nameA = a.perifereia || a.perifereiaki_enotita || a.onoma_neou_ota || '';
          const nameB = b.perifereia || b.perifereiaki_enotita || b.onoma_neou_ota || '';
          return nameA.localeCompare(nameB, 'el', { sensitivity: 'base' });
        });
      }
    } else {
      console.log('[ProjectReference] No kallikratis IDs found in project_index');
    }
    
    // Set reasonable caching headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    
    const referenceData = {
      eventTypes: eventTypesRes.data || [],
      units: unitsRes.data || [],
      kallikratis: kallikratisFromIndex,
      expenditureTypes: expenditureTypesRes.data || []
    };
    
    console.log(`[ProjectReference] Reference data counts: eventTypes=${referenceData.eventTypes.length}, units=${referenceData.units.length}, kallikratis=${referenceData.kallikratis.length}, expenditureTypes=${referenceData.expenditureTypes.length}`);
    
    res.json(referenceData);
  } catch (error) {
    console.error('[ProjectReference] Error fetching reference data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch reference data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Project Decisions CRUD endpoints
router.get('/:mis/decisions', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    console.log(`[ProjectDecisions] Fetching decisions for MIS: ${mis}`);

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Fetch all decisions for this project
    const { data: decisions, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('*')
      .eq('project_id', project.id)
      .order('decision_sequence', { ascending: true });

    if (decisionsError) {
      console.error('[ProjectDecisions] Error fetching decisions:', decisionsError);
      return res.status(500).json({ 
        message: "Failed to fetch decisions",
        error: decisionsError.message
      });
    }

    console.log(`[ProjectDecisions] Found ${decisions?.length || 0} decisions for project ${project.id}`);
    res.json(decisions || []);
  } catch (error) {
    console.error('[ProjectDecisions] Error in decisions endpoint:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post('/:mis/decisions', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const decisionData = req.body;
    console.log(`[ProjectDecisions] Creating decision for MIS: ${mis}`, decisionData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Get the next sequence number
    const { data: lastDecision } = await supabase
      .from('project_decisions')
      .select('decision_sequence')
      .eq('project_id', project.id)
      .order('decision_sequence', { ascending: false })
      .limit(1)
      .single();

    const nextSequence = (lastDecision?.decision_sequence || 0) + 1;

    // Prepare decision data
    const newDecision = {
      project_id: project.id,
      decision_sequence: nextSequence,
      decision_type: decisionData.decision_type || 'Έγκριση',
      protocol_number: decisionData.protocol_number || null,
      fek: decisionData.fek || null,
      ada: decisionData.ada || null,
      implementing_agency: decisionData.implementing_agency || [],
      decision_budget: decisionData.decision_budget ? parseFloat(decisionData.decision_budget.toString().replace(/[.,]/g, '')) / 100 : null,
      expenditure_type: decisionData.expenditure_type || [],
      decision_date: decisionData.decision_date || new Date().toISOString().split('T')[0],
      included: decisionData.included ?? true,
      comments: decisionData.comments || null,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const { data: createdDecision, error: createError } = await supabase
      .from('project_decisions')
      .insert(newDecision)
      .select()
      .single();

    if (createError) {
      console.error('[ProjectDecisions] Error creating decision:', createError);
      return res.status(500).json({ 
        message: "Failed to create decision",
        error: createError.message
      });
    }

    console.log(`[ProjectDecisions] Successfully created decision with ID: ${createdDecision.id}`);
    res.status(201).json(createdDecision);
  } catch (error) {
    console.error('[ProjectDecisions] Error creating decision:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.patch('/:mis/decisions/:decisionId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, decisionId } = req.params;
    const updateData = req.body;
    console.log(`[ProjectDecisions] Updating decision ${decisionId} for MIS: ${mis}`, updateData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify the decision exists and belongs to the project
    const { data: existingDecision, error: findError } = await supabase
      .from('project_decisions')
      .select('*, Projects!inner(mis)')
      .eq('id', decisionId)
      .eq('Projects.mis', mis)
      .single();

    if (findError || !existingDecision) {
      return res.status(404).json({ 
        message: "Decision not found",
        error: findError?.message || "Not found"
      });
    }

    // Prepare update data
    const fieldsToUpdate: any = {
      updated_by: req.user.id,
      updated_at: new Date().toISOString()
    };

    if (updateData.decision_type) fieldsToUpdate.decision_type = updateData.decision_type;
    if (updateData.protocol_number !== undefined) fieldsToUpdate.protocol_number = updateData.protocol_number;
    if (updateData.fek !== undefined) fieldsToUpdate.fek = updateData.fek;
    if (updateData.ada !== undefined) fieldsToUpdate.ada = updateData.ada;
    if (updateData.implementing_agency !== undefined) fieldsToUpdate.implementing_agency = updateData.implementing_agency;
    if (updateData.expenditure_type !== undefined) fieldsToUpdate.expenditure_type = updateData.expenditure_type;
    if (updateData.decision_date !== undefined) fieldsToUpdate.decision_date = updateData.decision_date;
    if (updateData.included !== undefined) fieldsToUpdate.included = updateData.included;
    if (updateData.comments !== undefined) fieldsToUpdate.comments = updateData.comments;
    
    if (updateData.decision_budget !== undefined) {
      fieldsToUpdate.decision_budget = updateData.decision_budget ? 
        parseFloat(updateData.decision_budget.toString().replace(/[.,]/g, '')) / 100 : null;
    }

    const { data: updatedDecision, error: updateError } = await supabase
      .from('project_decisions')
      .update(fieldsToUpdate)
      .eq('id', decisionId)
      .select()
      .single();

    if (updateError) {
      console.error('[ProjectDecisions] Error updating decision:', updateError);
      return res.status(500).json({ 
        message: "Failed to update decision",
        error: updateError.message
      });
    }

    console.log(`[ProjectDecisions] Successfully updated decision ${decisionId}`);
    res.json(updatedDecision);
  } catch (error) {
    console.error('[ProjectDecisions] Error updating decision:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.delete('/:mis/decisions/:decisionId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, decisionId } = req.params;
    console.log(`[ProjectDecisions] Deleting decision ${decisionId} for MIS: ${mis}`);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify the decision exists and belongs to the project
    const { data: existingDecision, error: findError } = await supabase
      .from('project_decisions')
      .select('*, Projects!inner(mis)')
      .eq('id', decisionId)
      .eq('Projects.mis', mis)
      .single();

    if (findError || !existingDecision) {
      return res.status(404).json({ 
        message: "Decision not found",
        error: findError?.message || "Not found"
      });
    }

    const { error: deleteError } = await supabase
      .from('project_decisions')
      .delete()
      .eq('id', decisionId);

    if (deleteError) {
      console.error('[ProjectDecisions] Error deleting decision:', deleteError);
      return res.status(500).json({ 
        message: "Failed to delete decision",
        error: deleteError.message
      });
    }

    console.log(`[ProjectDecisions] Successfully deleted decision ${decisionId}`);
    res.status(204).send();
  } catch (error) {
    console.error('[ProjectDecisions] Error deleting decision:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Project Formulations CRUD endpoints
router.get('/:mis/formulations', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    console.log(`[ProjectFormulations] Fetching formulations for MIS: ${mis}`);

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Fetch all formulations for this project
    const { data: formulations, error: formulationsError } = await supabase
      .from('project_formulations')
      .select('*')
      .eq('project_id', project.id)
      .order('formulation_sequence', { ascending: true });

    if (formulationsError) {
      console.error('[ProjectFormulations] Error fetching formulations:', formulationsError);
      return res.status(500).json({ 
        message: "Failed to fetch formulations",
        error: formulationsError.message
      });
    }

    console.log(`[ProjectFormulations] Found ${formulations?.length || 0} formulations for project ${project.id}`);
    res.json(formulations || []);
  } catch (error) {
    console.error('[ProjectFormulations] Error in formulations endpoint:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post('/:mis/formulations', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const formulationData = req.body;
    console.log(`[ProjectFormulations] Creating formulation for MIS: ${mis}`, formulationData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Get the next sequence number
    const { data: lastFormulation } = await supabase
      .from('project_formulations')
      .select('formulation_sequence')
      .eq('project_id', project.id)
      .order('formulation_sequence', { ascending: false })
      .limit(1)
      .single();

    const nextSequence = (lastFormulation?.formulation_sequence || 0) + 1;

    // Prepare formulation data
    const newFormulation = {
      project_id: project.id,
      formulation_sequence: nextSequence,
      sa_type: formulationData.sa || 'ΝΑ853',
      enumeration_code: formulationData.enumeration_code || null,
      protocol_number: formulationData.protocol_number || null,
      ada: formulationData.ada || null,
      decision_year: formulationData.decision_year ? parseInt(formulationData.decision_year) : null,
      project_budget: formulationData.project_budget ? parseFloat(formulationData.project_budget.toString().replace(/[.,]/g, '')) / 100 : 0,
      total_public_expense: formulationData.total_public_expense ? parseFloat(formulationData.total_public_expense) : null,
      eligible_public_expense: formulationData.eligible_public_expense ? parseFloat(formulationData.eligible_public_expense) : null,
      epa_version: formulationData.epa_version || null,
      decision_status: formulationData.decision_status || 'Ενεργή',
      change_type: formulationData.change_type || 'Έγκριση',
      connected_decision_ids: formulationData.connected_decisions || [],
      comments: formulationData.comments || null,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const { data: createdFormulation, error: createError } = await supabase
      .from('project_formulations')
      .insert(newFormulation)
      .select()
      .single();

    if (createError) {
      console.error('[ProjectFormulations] Error creating formulation:', createError);
      return res.status(500).json({ 
        message: "Failed to create formulation",
        error: createError.message
      });
    }

    console.log(`[ProjectFormulations] Successfully created formulation with ID: ${createdFormulation.id}`);
    res.status(201).json(createdFormulation);
  } catch (error) {
    console.error('[ProjectFormulations] Error creating formulation:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.patch('/:mis/formulations/:formulationId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, formulationId } = req.params;
    const updateData = req.body;
    console.log(`[ProjectFormulations] Updating formulation ${formulationId} for MIS: ${mis}`, updateData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify the formulation exists and belongs to the project
    const { data: existingFormulation, error: findError } = await supabase
      .from('project_formulations')
      .select('*, Projects!inner(mis)')
      .eq('id', formulationId)
      .eq('Projects.mis', mis)
      .single();

    if (findError || !existingFormulation) {
      return res.status(404).json({ 
        message: "Formulation not found",
        error: findError?.message || "Not found"
      });
    }

    // Prepare update data
    const fieldsToUpdate: any = {
      updated_by: req.user.id,
      updated_at: new Date().toISOString()
    };

    if (updateData.sa) fieldsToUpdate.sa_type = updateData.sa;
    if (updateData.enumeration_code !== undefined) fieldsToUpdate.enumeration_code = updateData.enumeration_code;
    if (updateData.protocol_number !== undefined) fieldsToUpdate.protocol_number = updateData.protocol_number;
    if (updateData.ada !== undefined) fieldsToUpdate.ada = updateData.ada;
    if (updateData.decision_year !== undefined) fieldsToUpdate.decision_year = updateData.decision_year ? parseInt(updateData.decision_year) : null;
    if (updateData.epa_version !== undefined) fieldsToUpdate.epa_version = updateData.epa_version;
    if (updateData.decision_status !== undefined) fieldsToUpdate.decision_status = updateData.decision_status;
    if (updateData.change_type !== undefined) fieldsToUpdate.change_type = updateData.change_type;
    if (updateData.connected_decisions !== undefined) fieldsToUpdate.connected_decision_ids = updateData.connected_decisions;
    if (updateData.comments !== undefined) fieldsToUpdate.comments = updateData.comments;
    
    if (updateData.project_budget !== undefined) {
      fieldsToUpdate.project_budget = updateData.project_budget ? 
        parseFloat(updateData.project_budget.toString().replace(/[.,]/g, '')) / 100 : 0;
    }
    if (updateData.total_public_expense !== undefined) {
      fieldsToUpdate.total_public_expense = updateData.total_public_expense ? parseFloat(updateData.total_public_expense) : null;
    }
    if (updateData.eligible_public_expense !== undefined) {
      fieldsToUpdate.eligible_public_expense = updateData.eligible_public_expense ? parseFloat(updateData.eligible_public_expense) : null;
    }

    const { data: updatedFormulation, error: updateError } = await supabase
      .from('project_formulations')
      .update(fieldsToUpdate)
      .eq('id', formulationId)
      .select()
      .single();

    if (updateError) {
      console.error('[ProjectFormulations] Error updating formulation:', updateError);
      return res.status(500).json({ 
        message: "Failed to update formulation",
        error: updateError.message
      });
    }

    console.log(`[ProjectFormulations] Successfully updated formulation ${formulationId}`);
    res.json(updatedFormulation);
  } catch (error) {
    console.error('[ProjectFormulations] Error updating formulation:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.delete('/:mis/formulations/:formulationId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, formulationId } = req.params;
    console.log(`[ProjectFormulations] Deleting formulation ${formulationId} for MIS: ${mis}`);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify the formulation exists and belongs to the project
    const { data: existingFormulation, error: findError } = await supabase
      .from('project_formulations')
      .select('*, Projects!inner(mis)')
      .eq('id', formulationId)
      .eq('Projects.mis', mis)
      .single();

    if (findError || !existingFormulation) {
      return res.status(404).json({ 
        message: "Formulation not found",
        error: findError?.message || "Not found"
      });
    }

    const { error: deleteError } = await supabase
      .from('project_formulations')
      .delete()
      .eq('id', formulationId);

    if (deleteError) {
      console.error('[ProjectFormulations] Error deleting formulation:', deleteError);
      return res.status(500).json({ 
        message: "Failed to delete formulation",
        error: deleteError.message
      });
    }

    console.log(`[ProjectFormulations] Successfully deleted formulation ${formulationId}`);
    res.status(204).send();
  } catch (error) {
    console.error('[ProjectFormulations] Error deleting formulation:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Project History/Changes endpoints
router.get('/:mis/history', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    console.log(`[ProjectHistory] Fetching history for MIS: ${mis}`);

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Fetch all history entries for this project
    const { data: history, error: historyError } = await supabase
      .from('project_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('[ProjectHistory] Error fetching history:', historyError);
      return res.status(500).json({ 
        message: "Failed to fetch history",
        error: historyError.message
      });
    }

    console.log(`[ProjectHistory] Found ${history?.length || 0} history entries for project ${project.id}`);
    res.json(history || []);
  } catch (error) {
    console.error('[ProjectHistory] Error in history endpoint:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post('/:mis/changes', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const changeData = req.body;
    console.log(`[ProjectChanges] Recording change for MIS: ${mis}`, changeData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project ID from MIS
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        message: "Project not found",
        error: projectError?.message || "Not found"
      });
    }

    // Prepare change record with current project state snapshot
    const changeRecord = {
      project_id: project.id,
      change_type: changeData.change_type || 'UPDATE',
      change_description: changeData.description || 'Project updated via comprehensive form',
      changed_by: req.user.id,
      
      // Snapshot of current project state
      project_title: project.project_title,
      event_description: project.event_description,
      status: project.status,
      budget_na853: project.budget_na853,
      budget_na271: project.budget_na271,
      budget_e069: project.budget_e069,
      na853: project.na853,
      na271: project.na271,
      e069: project.e069,
      event_type_id: project.event_type_id,
      event_year: project.event_year
    };

    const { data: createdChange, error: createError } = await supabase
      .from('project_history')
      .insert(changeRecord)
      .select()
      .single();

    if (createError) {
      console.error('[ProjectChanges] Error creating change record:', createError);
      return res.status(500).json({ 
        message: "Failed to record change",
        error: createError.message
      });
    }

    console.log(`[ProjectChanges] Successfully recorded change with ID: ${createdChange.id}`);
    res.status(201).json(createdChange);
  } catch (error) {
    console.error('[ProjectChanges] Error recording change:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create a new project
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectData = req.body;
    console.log('[Projects] Creating new project:', projectData);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Prepare project data for database insertion
    const fieldsToInsert: any = {
      mis: projectData.mis || null,
      na853: projectData.na853 || null,
      project_title: projectData.project_title || null,
      event_description: projectData.event_description || null,
      event_year: projectData.event_year ? [projectData.event_year] : [],
      status: projectData.status || 'Ενεργό',
      event_type_id: projectData.event_type || null,
      
      // Budget fields
      budget_e069: projectData.budget_e069 || null,
      budget_na271: projectData.budget_na271 || null,
      budget_na853: projectData.budget_na853 || null,
      
      // New fields: inc_year and updates
      inc_year: projectData.inc_year || null,
      updates: projectData.updates || [],
      
      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[Projects] Inserting project with fields:', Object.keys(fieldsToInsert));

    const { data: createdProject, error: createError } = await supabase
      .from('Projects')
      .insert(fieldsToInsert)
      .select()
      .single();

    if (createError) {
      console.error('[Projects] Error creating project:', createError);
      return res.status(500).json({ 
        message: "Failed to create project",
        error: createError.message
      });
    }

    console.log(`[Projects] Successfully created project with ID: ${createdProject.id}`);
    res.status(201).json(createdProject);
  } catch (error) {
    console.error('[Projects] Error creating project:', error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Helper function to insert geographic relationships
async function insertGeographicRelationships(projectIndexId: number, region: any) {
  try {
    console.log(`[Geographic] Inserting relationships for project_index ID: ${projectIndexId}`, region);
    
    // Load all geographic data for lookups
    const [regionsRes, unitsRes, munisRes] = await Promise.all([
      supabase.from('regions').select('*'),
      supabase.from('regional_units').select('*'), 
      supabase.from('municipalities').select('*')
    ]);

    const regions = regionsRes.data || [];
    const units = unitsRes.data || [];
    const munis = munisRes.data || [];

    // Insert region relationship
    if (region.perifereia && regions.length > 0) {
      const regionEntry = regions.find(r => r.name === region.perifereia);
      if (regionEntry) {
        console.log(`[Geographic] Inserting region relationship: ${regionEntry.code}`);
        const { error: regionError } = await supabase
          .from('project_index_regions')
          .insert({
            project_index_id: projectIndexId,
            region_code: regionEntry.code
          });
        
        if (regionError) {
          console.error(`[Geographic] Error inserting region relationship:`, regionError);
        } else {
          console.log(`[Geographic] Successfully inserted region relationship`);
        }
      } else {
        console.log(`[Geographic] No region found for: ${region.perifereia}`);
      }
    }

    // Insert regional unit relationship  
    if (region.perifereiaki_enotita && units.length > 0) {
      const unitEntry = units.find(u => u.name === region.perifereiaki_enotita);
      if (unitEntry) {
        console.log(`[Geographic] Inserting regional unit relationship: ${unitEntry.code}`);
        const { error: unitError } = await supabase
          .from('project_index_units')
          .insert({
            project_index_id: projectIndexId,
            unit_code: unitEntry.code
          });
        
        if (unitError) {
          console.error(`[Geographic] Error inserting unit relationship:`, unitError);
        } else {
          console.log(`[Geographic] Successfully inserted unit relationship`);
        }
      } else {
        console.log(`[Geographic] No regional unit found for: ${region.perifereiaki_enotita}`);
      }
    }

    // Insert municipality relationship
    if (region.dimos && munis.length > 0) {
      const muniEntry = munis.find(m => m.name === region.dimos);
      if (muniEntry) {
        console.log(`[Geographic] Inserting municipality relationship: ${muniEntry.code}`);
        const { error: muniError } = await supabase
          .from('project_index_munis')
          .insert({
            project_index_id: projectIndexId,
            muni_code: muniEntry.code
          });
        
        if (muniError) {
          console.error(`[Geographic] Error inserting municipality relationship:`, muniError);
        } else {
          console.log(`[Geographic] Successfully inserted municipality relationship`);
        }
      } else {
        console.log(`[Geographic] No municipality found for: ${region.dimos}`);
      }
    }

  } catch (error) {
    console.error(`[Geographic] Error in insertGeographicRelationships:`, error);
  }
}

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

    // Conservative update - only use fields we know exist based on actual database structure
    const fieldsToUpdate: any = {};
    
    // Core text fields that definitely exist
    if (updateData.project_title) fieldsToUpdate.project_title = updateData.project_title;
    if (updateData.event_description) fieldsToUpdate.event_description = updateData.event_description;
    
    // Handle event_type field - can be ID or text
    if (updateData.event_type !== undefined && updateData.event_type !== null) {
      fieldsToUpdate.event_type_id = updateData.event_type;
      console.log(`[Projects] Setting event_type_id to: ${updateData.event_type} (type: ${typeof updateData.event_type})`);
    }
    
    // Legacy code fields that exist - SKIP na853 to avoid unique constraint violations
    if (updateData.e069) fieldsToUpdate.e069 = updateData.e069;
    if (updateData.na271) fieldsToUpdate.na271 = updateData.na271;
    // Skip na853 field - it has unique constraint and shouldn't change after creation
    // if (updateData.na853) fieldsToUpdate.na853 = updateData.na853;
    
    // Budget fields - use numbers or null
    console.log('[Projects] Received budget values:', {
      budget_e069: updateData.budget_e069,
      budget_na271: updateData.budget_na271,
      budget_na853: updateData.budget_na853
    });
    
    if (updateData.budget_e069 !== undefined) {
      fieldsToUpdate.budget_e069 = updateData.budget_e069;
      console.log(`[Projects] Setting budget_e069 to: ${updateData.budget_e069} (type: ${typeof updateData.budget_e069})`);
    }
    if (updateData.budget_na271 !== undefined) {
      fieldsToUpdate.budget_na271 = updateData.budget_na271;
      console.log(`[Projects] Setting budget_na271 to: ${updateData.budget_na271} (type: ${typeof updateData.budget_na271})`);
    }
    if (updateData.budget_na853 !== undefined) {
      fieldsToUpdate.budget_na853 = updateData.budget_na853;
      console.log(`[Projects] Setting budget_na853 to: ${updateData.budget_na853} (type: ${typeof updateData.budget_na853})`);
    }
    
    // Status if provided (text field)
    if (updateData.status) fieldsToUpdate.status = updateData.status;
    
    // Event year as JSONB array (matches database structure)
    if (updateData.event_year) fieldsToUpdate.event_year = [updateData.event_year];
    
    // New fields for inc_year and updates
    if (updateData.inc_year !== undefined) {
      fieldsToUpdate.inc_year = updateData.inc_year ? parseInt(updateData.inc_year) : null;
      console.log(`[Projects] Setting inc_year to: ${fieldsToUpdate.inc_year}`);
    }
    
    // Handle updates/changes field
    if (updateData.updates) {
      // Ensure we have a proper array structure for the JSONB field
      const updatesArray = Array.isArray(updateData.updates) ? updateData.updates : [];
      fieldsToUpdate.updates = updatesArray;
      console.log(`[Projects] Setting updates with ${updatesArray.length} entries`);
    }
    
    // Always update timestamp
    fieldsToUpdate.updated_at = new Date().toISOString();

    console.log(`[Projects] Conservative update - only updating confirmed fields:`, Object.keys(fieldsToUpdate));

    console.log(`[Projects] Fields to update for MIS ${mis}:`, fieldsToUpdate);
    
    // Handle connected decisions data from formulation details
    if (updateData.formulation_details && Array.isArray(updateData.formulation_details)) {
      console.log('[Projects] Processing connected decisions from formulation details:', updateData.formulation_details);
      
      // Log specific connected decisions data
      updateData.formulation_details.forEach((formulation: any, index: number) => {
        console.log(`[Projects] Formulation ${index + 1}:`, {
          sa: formulation.sa,
          connected_decisions: formulation.connected_decisions,
          connected_decisions_length: formulation.connected_decisions?.length || 0
        });
      });
      
      // Save connected decisions data to project_history for audit trail
      try {
        const connectedDecisionsData = updateData.formulation_details.map((formulation: any) => ({
          sa: formulation.sa,
          enumeration_code: formulation.enumeration_code,
          protocol_number: formulation.protocol_number,
          ada: formulation.ada,
          decision_year: formulation.decision_year,
          project_budget: formulation.project_budget,
          epa_version: formulation.epa_version || '',
          total_public_expense: formulation.total_public_expense || '',
          eligible_public_expense: formulation.eligible_public_expense || '',
          decision_status: formulation.decision_status || 'Ενεργή',
          change_type: formulation.change_type || 'Έγκριση',
          connected_decisions: formulation.connected_decisions || [],
          comments: formulation.comments || ''
        }));
        
        // Update or create project_history entry with formulation details and connected decisions
        const { error: historyError } = await supabase
          .from('project_history') 
          .upsert({
            project_id: existingProject.id,
            formulation_details: connectedDecisionsData,
            created_at: new Date().toISOString()
          });
          
        if (historyError) {
          console.error('[Projects] Error saving connected decisions to project_history:', historyError);
        } else {
          console.log('[Projects] Successfully saved connected decisions data to project_history');
        }
      } catch (historyErr) {
        console.error('[Projects] Error processing connected decisions:', historyErr);
      }
    }

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
      console.log(`[Projects] Starting project_index update for project ID: ${updatedProject.id}`);
      console.log(`[Projects] Number of project_lines to process: ${updateData.project_lines.length}`);
      console.log(`[Projects] Project lines data:`, JSON.stringify(updateData.project_lines, null, 2));
      
      // First, delete existing project_index entries for this project
      const { error: deleteError } = await supabase
        .from('project_index')
        .delete()
        .eq('project_id', updatedProject.id);

      if (deleteError) {
        console.error(`[Projects] Error deleting existing project_index entries:`, deleteError);
      } else {
        console.log(`[Projects] Successfully deleted existing project_index entries for project ${updatedProject.id}`);
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
            supabase.from('expenditure_types').select('*'),
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
          if (line.implementing_agency_id) {
            // Use the provided ID directly
            monadaId = parseInt(line.implementing_agency_id);
            console.log(`[Projects] Using provided implementing_agency_id: ${monadaId}`);
          } else if (line.implementing_agency) {
            console.log(`[Projects] DEBUG: Looking for agency: "${line.implementing_agency}"`);
            console.log(`[Projects] DEBUG: Available agencies:`, monadaData.map(m => ({ id: m.id, unit: m.unit, unit_name: m.unit_name })));
            
            const monada = monadaData.find(m => {
              // Handle the case where unit_name might be an object with name property
              const unitName = (typeof m.unit_name === 'object' && m.unit_name.name) ? m.unit_name.name : m.unit_name;
              
              return m.id == line.implementing_agency || 
                     m.unit === line.implementing_agency || 
                     unitName === line.implementing_agency ||
                     // Try partial matching for long agency names
                     (unitName && line.implementing_agency.includes(unitName)) ||
                     (unitName && unitName.includes(line.implementing_agency)) ||
                     (m.unit && line.implementing_agency.includes(m.unit)) ||
                     (m.unit && m.unit.includes(line.implementing_agency));
            });
            monadaId = monada ? parseInt(monada.id) : null;
            console.log(`[Projects] Found monada_id: ${monadaId} for agency: ${line.implementing_agency}`);
            if (!monada) {
              console.log(`[Projects] WARNING: No matching agency found for: "${line.implementing_agency}"`);
            }
          }

          // Find kallikratis ID from region hierarchy
          if (line.region) {
            console.log(`[Projects] DEBUG: Looking for kallikratis with region:`, line.region);
            
            if (line.region.kallikratis_id) {
              // Use provided kallikratis_id
              kallikratisId = line.region.kallikratis_id;
              console.log(`[Projects] Using provided kallikratis_id: ${kallikratisId}`);
            } else {
              // Try to find kallikratis entry by matching region hierarchy
              console.log(`[Projects] DEBUG: Searching kallikratis with criteria:`, {
                perifereia: line.region.perifereia,
                perifereiaki_enotita: line.region.perifereiaki_enotita,
                onoma_neou_ota: line.region.dimos,
                onoma_dimotikis_enotitas: line.region.dimotiki_enotita
              });
              
              // First try exact match
              let kallikratis = kallikratisData.find(k => 
                k.perifereia === line.region.perifereia && 
                k.perifereiaki_enotita === line.region.perifereiaki_enotita &&
                k.onoma_neou_ota === line.region.dimos &&
                k.onoma_dimotikis_enotitas === line.region.dimotiki_enotita
              );
              
              // If no exact match and no municipal community specified, try matching without it
              if (!kallikratis && !line.region.dimotiki_enotita) {
                kallikratis = kallikratisData.find(k => 
                  k.perifereia === line.region.perifereia && 
                  k.perifereiaki_enotita === line.region.perifereiaki_enotita &&
                  k.onoma_neou_ota === line.region.dimos
                );
                console.log(`[Projects] DEBUG: Trying municipal match without dimotiki_enotita`);
              }
              
              // If still no match, try regional unit level
              if (!kallikratis) {
                kallikratis = kallikratisData.find(k => 
                  k.perifereia === line.region.perifereia && 
                  k.perifereiaki_enotita === line.region.perifereiaki_enotita
                );
                console.log(`[Projects] DEBUG: Trying regional unit level match`);
              }
              
              kallikratisId = kallikratis?.id || null;
              console.log(`[Projects] Lookup found kallikratis_id: ${kallikratisId}`);
              if (kallikratis) {
                console.log(`[Projects] DEBUG: Matched kallikratis:`, kallikratis);
              } else {
                console.log(`[Projects] WARNING: No kallikratis match found`);
              }
            }
          }

          console.log(`[Projects] Processing line ${updateData.project_lines.indexOf(line) + 1}:`);
          console.log(`[Projects] - Event Type ID: ${eventTypeId}`);
          console.log(`[Projects] - Monada ID: ${monadaId}`);
          console.log(`[Projects] - Kallikratis ID: ${kallikratisId}`);
          
          // Create project_index entries if we have essential values (very relaxed requirement)
          // Use default event type if none provided to ensure location data is saved
          if (!eventTypeId) {
            // Use first available event type as fallback
            if (eventTypes && eventTypes.length > 0) {
              eventTypeId = eventTypes[0].id;
              console.log(`[Projects] No event type provided, using fallback event type ID: ${eventTypeId}`);
            }
          }
          
          if (eventTypeId) {
            console.log(`[Projects] Creating project_index entries - event_type_id is valid: ${eventTypeId}`);
            console.log(`[Projects] Creating project_index entry with eventTypeId: ${eventTypeId}, monadaId: ${monadaId}, kallikratisId: ${kallikratisId}`);
            if (!monadaId) {
              console.log(`[Projects] WARNING: Proceeding without monada_id - may need manual correction`);
            }
            if (!kallikratisId) {
              console.log(`[Projects] WARNING: Proceeding without kallikratis_id - may need manual geographic assignment`);
            }
            // Find expenditure type IDs (multiple values)
            if (line.expenditure_types && Array.isArray(line.expenditure_types) && line.expenditure_types.length > 0) {
              console.log(`[Projects] DEBUG: Processing expenditure types:`, line.expenditure_types);
              console.log(`[Projects] DEBUG: Available expenditure types:`, expenditureTypes.map(et => ({ id: et.id, name: et.expenditure_types })));
              
              for (const expType of line.expenditure_types) {
                const expenditureType = expenditureTypes.find(et => 
                  et.id == expType || 
                  et.expenditure_types === expType ||
                  et.id === parseInt(expType)
                );
                expenditureTypeId = expenditureType?.id || null;
                
                console.log(`[Projects] DEBUG: Expenditure type "${expType}" -> ID: ${expenditureTypeId}`);
                
                // Create project_index entry for each expenditure type
                if (expenditureTypeId) {
                  // Use geographic code from frontend if provided, otherwise calculate it
                  let geographicCode = line.region?.geographic_code || null;
                  
                  if (!geographicCode && kallikratisData && kallikratisId) {
                    // Fallback: calculate geographic code if not provided
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
                  } else if (geographicCode) {
                    console.log(`[Projects] Using geographic_code from frontend: ${geographicCode}`);
                  }
                  
                  // Create project_index entry - must have all required fields per database schema
                  if (monadaId && eventTypeId && expenditureTypeId) {
                    const indexEntry = {
                      project_id: updatedProject.id,
                      monada_id: monadaId,           // REQUIRED per database schema
                      event_types_id: eventTypeId,   // REQUIRED per database schema
                      expenditure_type_id: expenditureTypeId  // REQUIRED per database schema
                      // NOTE: kallikratis_id and geographic_code don't exist in actual database
                    };

                    console.log(`[Projects] Inserting project_index entry:`, indexEntry);
                    const { data: insertedEntry, error: insertError } = await supabase
                      .from('project_index')
                      .insert(indexEntry)
                      .select('id')
                      .single();

                    if (insertError) {
                      console.error(`[Projects] Error inserting project_index entry:`, insertError);
                    } else {
                      console.log(`[Projects] Successfully created project_index entry for expenditure type: ${expType}, ID: ${insertedEntry.id}`);
                      
                      // Insert geographic relationships if we have region data
                      if (line.region && insertedEntry.id) {
                        await insertGeographicRelationships(insertedEntry.id, line.region);
                      }
                    }
                  } else {
                    console.warn(`[Projects] Cannot create project_index entry - missing required fields: monada_id=${monadaId}, event_types_id=${eventTypeId}, expenditure_type_id=${expenditureTypeId}`);
                  }
                } else {
                  console.warn(`[Projects] Could not find expenditure type ID for: ${expType}`);
                }
              }
            } else {
              // Use default expenditure type if none specified - must have all required fields
              const defaultExpenditureType = expenditureTypes.find(et => et.expenditure_types === "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ") || expenditureTypes[0];
              if (defaultExpenditureType && monadaId && eventTypeId) {
                const indexEntry = {
                  project_id: updatedProject.id,
                  monada_id: monadaId,           // REQUIRED per database schema
                  event_types_id: eventTypeId,   // REQUIRED per database schema
                  expenditure_type_id: defaultExpenditureType.id  // REQUIRED per database schema
                  // NOTE: kallikratis_id and geographic_code don't exist in actual database
                };

                console.log(`[Projects] Inserting default project_index entry:`, indexEntry);
                const { data: insertedEntry, error: insertError } = await supabase
                  .from('project_index')
                  .insert(indexEntry)
                  .select('id')
                  .single();

                if (insertError) {
                  console.error(`[Projects] Error inserting default project_index entry:`, insertError);
                } else {
                  console.log(`[Projects] Successfully created default project_index entry, ID: ${insertedEntry.id}`);
                  
                  // Insert geographic relationships if we have region data
                  if (line.region && insertedEntry.id) {
                    await insertGeographicRelationships(insertedEntry.id, line.region);
                  }
                }
              } else {
                console.warn(`[Projects] Cannot create default project_index entry - missing required fields: monada_id=${monadaId}, event_types_id=${eventTypeId}, defaultExpenditureType=${defaultExpenditureType?.id}`);
              }
            }
          } else {
            console.warn(`[Projects] Missing required values for project_index - eventTypeId: ${eventTypeId}, monadaId: ${monadaId} (all fields required per database schema)`);
          }
        } catch (lineError) {
          console.error(`[Projects] Error processing project line:`, lineError);
        }
      }
    }

    // Get enhanced data for the updated project
    const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes, indexRes] = await Promise.all([
      supabase.from('event_types').select('*'),
      supabase.from('expenditure_types').select('*'),
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
    const expenditureType = indexItem ? expenditureTypes.find(et => et.id === indexItem.expenditure_type_id) : null;
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
        name: expenditureType.expenditure_types
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
    
    // Return enhanced project with update summary
    res.json({
      ...enhancedProject,
      updateSummary: {
        projectUpdated: true,
        projectIndexEntriesUpdated: updateData.project_lines ? updateData.project_lines.length > 0 : false,
        message: 'Project successfully updated with comprehensive form data'
      }
    });
  } catch (error) {
    console.error(`[Projects] Error updating project:`, error);
    res.status(500).json({ 
      message: "Failed to update project",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Combined reference data endpoint for faster loading - must be before /:mis route
router.get('/reference-data', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  console.log(`[ReferenceData] Fetching combined reference data`);
  
  try {
    const [eventTypesResult, unitsResult, kallikratisResult, expenditureTypesResult] = await Promise.all([
      supabase.from('event_types').select('*').order('id'),
      supabase.from('Monada').select('*').order('id'),
      supabase.from('kallikratis').select('*').order('id'),
      supabase.from('expenditure_types').select('*').order('id')
    ]);

    const referenceData = {
      event_types: eventTypesResult.data || [],
      units: unitsResult.data || [],
      kallikratis: kallikratisResult.data || [],
      expenditure_types: expenditureTypesResult.data || []
    };

    console.log(`[ReferenceData] Successfully fetched combined reference data: ${referenceData.event_types.length} event types, ${referenceData.units.length} units, ${referenceData.kallikratis.length} kallikratis entries, ${referenceData.expenditure_types.length} expenditure types`);
    
    res.json(referenceData);
  } catch (error) {
    console.error(`[ReferenceData] Error fetching reference data:`, error);
    res.status(500).json({ 
      message: "Failed to fetch reference data",
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
      supabase.from('expenditure_types').select('*'),
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
    const expenditureType = indexItem ? expenditureTypes.find(et => et.id === indexItem.expenditure_type_id) : null;
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
        name: expenditureType.expenditure_types
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

// Get project decisions from normalized table
router.get('/:mis/decisions', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    
    console.log(`[ProjectDecisions] Fetching decisions for project MIS: ${mis}`);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ProjectDecisions] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    // Get decisions from normalized table
    const { data: decisions, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('*')
      .eq('project_id', project.id)
      .order('decision_sequence');

    if (decisionsError) {
      console.error(`[ProjectDecisions] Error fetching decisions:`, decisionsError);
      return res.status(500).json({ message: "Failed to fetch decisions" });
    }

    console.log(`[ProjectDecisions] Found ${decisions?.length || 0} decisions for project ${mis}`);
    res.json(decisions || []);
  } catch (error) {
    console.error(`[ProjectDecisions] Error:`, error);
    res.status(500).json({ 
      message: "Failed to fetch project decisions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get project formulations from normalized table
router.get('/:mis/formulations', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    
    console.log(`[ProjectFormulations] Fetching formulations for project MIS: ${mis}`);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ProjectFormulations] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    // Get formulations from normalized table with optional linked decision data
    const { data: formulations, error: formulationsError } = await supabase
      .from('project_formulations')
      .select(`
        *,
        project_decisions(
          id,
          decision_type,
          protocol_number,
          fek,
          ada
        )
      `)
      .eq('project_id', project.id)
      .order('formulation_sequence');

    if (formulationsError) {
      console.error(`[ProjectFormulations] Error fetching formulations:`, formulationsError);
      return res.status(500).json({ message: "Failed to fetch formulations" });
    }

    console.log(`[ProjectFormulations] Found ${formulations?.length || 0} formulations for project ${mis}`);
    res.json(formulations || []);
  } catch (error) {
    console.error(`[ProjectFormulations] Error:`, error);
    res.status(500).json({ 
      message: "Failed to fetch project formulations",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get project index data with all relationships
router.get('/:mis/index', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    
    console.log(`[ProjectIndex] Fetching project index data for MIS: ${mis}`);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ProjectIndex] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    // Get project index data with all related entities
    const { data: indexData, error: indexError } = await supabase
      .from('project_index')
      .select(`
        *,
        monada:Monada!inner(
          id,
          unit,
          unit_name,
          email,
          manager,
          address
        ),
        kallikratis(
          id,
          kodikos_neou_ota,
          eidos_neou_ota,
          onoma_neou_ota,
          kodikos_perifereiakis_enotitas,
          perifereiaki_enotita,
          kodikos_perifereias,
          perifereia
        ),
        event_types(
          id,
          name
        ),
        expenditure_types(
          id,
          expenditure_types,
          expenditure_types_minor
        )
      `)
      .eq('project_id', project.id);

    if (indexError) {
      console.error(`[ProjectIndex] Error fetching index data:`, indexError);
      return res.status(500).json({ message: "Failed to fetch project index data" });
    }

    console.log(`[ProjectIndex] Found ${indexData?.length || 0} index entries for project ${mis}`);
    res.json(indexData || []);
  } catch (error) {
    console.error(`[ProjectIndex] Error:`, error);
    res.status(500).json({ 
      message: "Failed to fetch project index data",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Update project decisions (normalized table)
router.put('/:mis/decisions', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const { decisions_data } = req.body;
    
    console.log(`[ProjectDecisions] Updating decisions for project MIS: ${mis}`, decisions_data);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ProjectDecisions] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    // Delete existing decisions for this project
    const { error: deleteError } = await supabase
      .from('project_decisions')
      .delete()
      .eq('project_id', project.id);

    if (deleteError) {
      console.error(`[ProjectDecisions] Error deleting existing decisions:`, deleteError);
      return res.status(500).json({ message: "Failed to delete existing decisions" });
    }

    // Insert new decisions
    if (decisions_data && Array.isArray(decisions_data) && decisions_data.length > 0) {
      const decisionsToInsert = decisions_data.map((decision: any, index: number) => {
        // Parse European formatted budget values to numbers
        const parseEuropeanBudget = (value: string | number) => {
          if (!value) return 0;
          if (typeof value === 'number') return value;
          
          const strValue = String(value).trim().replace(/[^\d,.-]/g, ''); // Remove currency symbols
          
          // Handle European format: "15.000,12" -> 15000.12
          if (strValue.includes('.') && strValue.includes(',')) {
            // Remove dots (thousands separators) and replace comma with decimal point
            const normalized = strValue.replace(/\./g, '').replace(',', '.');
            const result = parseFloat(normalized) || 0;
            console.log(`[ProjectDecisions] Parsed European format: "${strValue}" -> ${result}`);
            return result;
          }
          
          // Handle comma as decimal separator: "22,50" -> 22.50
          if (strValue.includes(',') && !strValue.includes('.')) {
            const result = parseFloat(strValue.replace(',', '.')) || 0;
            console.log(`[ProjectDecisions] Parsed decimal format: "${strValue}" -> ${result}`);
            return result;
          }
          
          // Handle dots as thousands separators only: "15.000" -> 15000
          if (strValue.includes('.') && !strValue.includes(',')) {
            const dotCount = (strValue.match(/\./g) || []).length;
            const afterLastDot = strValue.split('.').pop() || '';
            
            // If last part has exactly 3 digits, treat dots as thousands separators
            if (afterLastDot.length === 3 || dotCount > 1) {
              const result = parseFloat(strValue.replace(/\./g, '')) || 0;
              console.log(`[ProjectDecisions] Parsed thousands format: "${strValue}" -> ${result}`);
              return result;
            }
          }
          
          // Handle standard format
          const result = parseFloat(strValue) || 0;
          console.log(`[ProjectDecisions] Parsed standard format: "${strValue}" -> ${result}`);
          return result;
        };

        console.log(`[ProjectDecisions] Processing decision ${index + 1}:`, { 
          protocol_number: decision.protocol_number,
          decision_budget: decision.decision_budget,
          parsed_budget: parseEuropeanBudget(decision.decision_budget)
        });

        return {
          project_id: project.id,
          decision_sequence: index + 1,
          decision_type: decision.decision_type || 'Έγκριση',
          protocol_number: decision.protocol_number || null,
          fek: decision.fek || null,
          ada: decision.ada || null,
          implementing_agency: decision.implementing_agency || [],
          decision_budget: parseEuropeanBudget(decision.decision_budget),
          expenditure_type: decision.expenditure_type || [],
          decision_date: new Date().toISOString().split('T')[0], // Today's date as default
          included: decision.included !== undefined ? decision.included : true,
          is_active: true,
          comments: decision.comments || null,
          created_by: req.user!.id,
          updated_by: req.user!.id
        };
      });

      const { error: insertError } = await supabase
        .from('project_decisions')
        .insert(decisionsToInsert);

      if (insertError) {
        console.error(`[ProjectDecisions] Error inserting decisions:`, insertError);
        return res.status(500).json({ message: "Failed to insert decisions" });
      }

      console.log(`[ProjectDecisions] Successfully inserted ${decisionsToInsert.length} decisions for project ${mis}`);
    }

    res.json({ 
      message: "Decisions updated successfully",
      decisions_count: decisions_data?.length || 0
    });
  } catch (error) {
    console.error(`[ProjectDecisions] Error updating decisions:`, error);
    res.status(500).json({ 
      message: "Failed to update project decisions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Update project formulations (normalized table)
router.put('/:mis/formulations', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const { formulation_details } = req.body;
    
    console.log(`[ProjectFormulations] Updating formulations for project MIS: ${mis}`, formulation_details);

    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ProjectFormulations] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    // Get existing decisions for this project to map indices to IDs
    const { data: existingDecisions, error: decisionsError } = await supabase
      .from('project_decisions')
      .select('id')
      .eq('project_id', project.id)
      .order('decision_sequence');

    if (decisionsError) {
      console.error(`[ProjectFormulations] Error fetching decisions for mapping:`, decisionsError);
      return res.status(500).json({ message: "Failed to fetch decisions for mapping" });
    }

    console.log(`[ProjectFormulations] Found ${existingDecisions?.length || 0} decisions for mapping connected decisions`);

    // Delete existing formulations for this project
    const { error: deleteError } = await supabase
      .from('project_formulations')
      .delete()
      .eq('project_id', project.id);

    if (deleteError) {
      console.error(`[ProjectFormulations] Error deleting existing formulations:`, deleteError);
      return res.status(500).json({ message: "Failed to delete existing formulations" });
    }

    // Insert new formulations
    if (formulation_details && Array.isArray(formulation_details) && formulation_details.length > 0) {
      const formulationsToInsert = formulation_details.map((formulation: any, index: number) => {
        // Parse European formatted budget values to numbers
        const parseEuropeanBudget = (value: string | number) => {
          if (!value) return 0;
          if (typeof value === 'number') return value;
          
          const strValue = String(value).replace(/[^\d,.-]/g, ''); // Remove currency symbols
          if (strValue.includes('.') && strValue.includes(',')) {
            return parseFloat(strValue.replace(/\./g, '').replace(',', '.')) || 0;
          }
          if (strValue.includes(',')) {
            return parseFloat(strValue.replace(',', '.')) || 0;
          }
          return parseFloat(strValue) || 0;
        };

        console.log(`[ProjectFormulations] Processing formulation ${index + 1}:`, {
          sa: formulation.sa,
          project_budget: formulation.project_budget,
          parsed_budget: parseEuropeanBudget(formulation.project_budget)
        });

        return {
          project_id: project.id,
          formulation_sequence: index + 1,
          sa_type: formulation.sa || 'ΝΑ853',
          enumeration_code: formulation.enumeration_code || null,
          protocol_number: formulation.protocol_number || null,
          ada: formulation.ada || null,
          decision_year: formulation.decision_year ? parseInt(formulation.decision_year) : null,
          project_budget: parseEuropeanBudget(formulation.project_budget),
          total_public_expense: parseEuropeanBudget(formulation.total_public_expense),
          eligible_public_expense: parseEuropeanBudget(formulation.eligible_public_expense),
          epa_version: formulation.epa_version || null,
          decision_status: formulation.decision_status || 'Ενεργή',
          change_type: formulation.change_type || 'Έγκριση',
          connected_decision_ids: Array.isArray(formulation.connected_decisions) 
            ? formulation.connected_decisions
                .map((indexStr: string) => {
                  const index = parseInt(indexStr);
                  if (!isNaN(index) && existingDecisions && index < existingDecisions.length) {
                    const decisionId = existingDecisions[index]?.id;
                    console.log(`[ProjectFormulations] Mapping connected decision index ${index} to ID ${decisionId}`);
                    return decisionId;
                  }
                  console.log(`[ProjectFormulations] Invalid connected decision index: ${indexStr}`);
                  return null;
                })
                .filter((id: number | null) => id !== null)
            : [],
          comments: formulation.comments || null,
          is_active: true,
          created_by: req.user?.id || null,
          updated_by: req.user?.id || null
        };
      });

      const { data: insertedFormulations, error: insertError } = await supabase
        .from('project_formulations')
        .insert(formulationsToInsert)
        .select();

      if (insertError) {
        console.error(`[ProjectFormulations] Error inserting formulations:`, insertError);
        return res.status(500).json({ message: "Failed to insert formulations" });
      }

      console.log(`[ProjectFormulations] Successfully inserted ${insertedFormulations.length} formulations for project ${mis}`);
      res.json({ 
        message: "Formulations updated successfully", 
        formulations: insertedFormulations,
        count: insertedFormulations.length 
      });
    } else {
      console.log(`[ProjectFormulations] No formulations to insert for project ${mis}`);
      res.json({ message: "No formulations to update", formulations: [], count: 0 });
    }
  } catch (error) {
    console.error(`[ProjectFormulations] Error updating formulations:`, error);
    res.status(500).json({ 
      message: "Failed to update project formulations",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Comprehensive project update - handles all form data at once
router.put('/:mis/comprehensive', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis } = req.params;
    const formData = req.body;
    
    console.log(`[ComprehensiveUpdate] ========== STARTING UPDATE FOR MIS: ${mis} ==========`);
    console.log(`[ComprehensiveUpdate] Request body keys:`, Object.keys(formData));
    console.log(`[ComprehensiveUpdate] Project details provided:`, !!formData.project_details);
    console.log(`[ComprehensiveUpdate] Decisions provided:`, !!formData.decisions, formData.decisions?.length || 0);
    console.log(`[ComprehensiveUpdate] Location details provided:`, !!formData.location_details, formData.location_details?.length || 0);
    console.log(`[ComprehensiveUpdate] Formulation details provided:`, !!formData.formulation_details, formData.formulation_details?.length || 0);

    if (!req.user) {
      console.log(`[ComprehensiveUpdate] Authentication failed - no user session`);
      return res.status(401).json({ message: "Authentication required" });
    }

    // First get the project to get the project_id
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .select('id, mis')
      .eq('mis', mis)
      .single();

    if (projectError || !project) {
      console.error(`[ComprehensiveUpdate] Project not found for MIS: ${mis}`, projectError);
      return res.status(404).json({ message: "Project not found" });
    }

    console.log(`[ComprehensiveUpdate] Processing update for project ID: ${project.id}`);

    // Update project details if provided
    if (formData.project_details) {
      const projectUpdate = {
        mis: formData.project_details.mis ? parseInt(formData.project_details.mis) : project.mis,
        project_title: formData.project_details.project_title || null,
        event_description: formData.project_details.project_description || formData.project_details.summary_description || null,
        status: formData.project_details.project_status || 'Ενεργό',
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('Projects')
        .update(projectUpdate)
        .eq('id', project.id);

      if (updateError) {
        console.error(`[ComprehensiveUpdate] Error updating project:`, updateError);
        return res.status(500).json({ message: "Failed to update project details" });
      }
      console.log(`[ComprehensiveUpdate] Updated project details`);
    }

    // Update project decisions if provided
    if (formData.decisions && Array.isArray(formData.decisions)) {
      await supabase.from('project_decisions').delete().eq('project_id', project.id);
      
      const decisionsToInsert = formData.decisions.map((decision: any, index: number) => ({
        project_id: project.id,
        decision_sequence: index + 1,
        decision_type: decision.decision_type || 'Έγκριση',
        protocol_number: decision.protocol_number || null,
        fek: decision.fek || null,
        ada: decision.ada || null,
        implementing_agency: decision.implementing_agency || [],
        decision_budget: parseFloat(String(decision.decision_budget || 0).replace(/[^\d.,]/g, '.')) || 0,
        expenses_covered: parseFloat(String(decision.expenses_covered || 0).replace(/[^\d.,]/g, '.')) || 0,
        expenditure_type: decision.expenditure_type || [],
        decision_date: new Date().toISOString().split('T')[0],
        included: decision.included !== undefined ? decision.included : true,
        is_active: true,
        comments: decision.comments || null,
        created_by: req.user!.id,
        updated_by: req.user!.id
      }));

      if (decisionsToInsert.length > 0) {
        const { error: decisionsError } = await supabase
          .from('project_decisions')
          .insert(decisionsToInsert);

        if (decisionsError) {
          console.error(`[ComprehensiveUpdate] Error inserting decisions:`, decisionsError);
          return res.status(500).json({ message: "Failed to update decisions" });
        }
        console.log(`[ComprehensiveUpdate] Updated ${decisionsToInsert.length} decisions`);
      }
    }

    // Update formulations if provided
    if (formData.formulation_details && Array.isArray(formData.formulation_details)) {
      await supabase.from('project_formulations').delete().eq('project_id', project.id);
      
      const { data: existingDecisions } = await supabase
        .from('project_decisions')
        .select('id')
        .eq('project_id', project.id)
        .order('decision_sequence');

      const formulationsToInsert = formData.formulation_details.map((formulation: any, index: number) => ({
        project_id: project.id,
        formulation_sequence: index + 1,
        sa_type: formulation.sa || 'ΝΑ853',
        enumeration_code: formulation.enumeration_code || null,
        protocol_number: formulation.protocol_number || null,
        ada: formulation.ada || null,
        decision_year: formulation.decision_year ? parseInt(formulation.decision_year) : null,
        project_budget: parseFloat(String(formulation.project_budget || 0).replace(/[^\d.,]/g, '.')) || 0,
        total_public_expense: parseFloat(String(formulation.total_public_expense || 0).replace(/[^\d.,]/g, '.')) || 0,
        eligible_public_expense: parseFloat(String(formulation.eligible_public_expense || 0).replace(/[^\d.,]/g, '.')) || 0,
        epa_version: formulation.epa_version || null,
        decision_status: formulation.decision_status || 'Ενεργή',
        change_type: formulation.change_type || 'Έγκριση',
        connected_decision_ids: Array.isArray(formulation.connected_decisions) 
          ? formulation.connected_decisions
              .map((index: number) => (existingDecisions && index < existingDecisions.length) ? existingDecisions[index]?.id : null)
              .filter((id: number | null) => id !== null)
          : [],
        comments: formulation.comments || null,
        is_active: true,
        created_by: req.user?.id || null,
        updated_by: req.user?.id || null
      }));

      if (formulationsToInsert.length > 0) {
        const { error: formulationsError } = await supabase
          .from('project_formulations')
          .insert(formulationsToInsert);

        if (formulationsError) {
          console.error(`[ComprehensiveUpdate] Error inserting formulations:`, formulationsError);
          return res.status(500).json({ message: "Failed to update formulations" });
        }
        console.log(`[ComprehensiveUpdate] Updated ${formulationsToInsert.length} formulations`);
      }
    }

    res.json({ 
      message: "Project updated successfully",
      project_id: project.id,
      sections_updated: {
        project_details: !!formData.project_details,
        decisions: !!(formData.decisions && formData.decisions.length > 0),
        formulations: !!(formData.formulation_details && formData.formulation_details.length > 0)
      }
    });

  } catch (error) {
    console.error(`[ComprehensiveUpdate] Error updating project:`, error);
    res.status(500).json({ 
      message: "Failed to update project",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export { router as projectsRouter };