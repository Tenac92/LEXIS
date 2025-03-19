import { Router } from 'express';
import { supabase } from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { Project } from '@shared/schema';
import * as xlsx from 'xlsx';
import multer from 'multer';
import { parse } from 'csv-parse';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all projects with improved error handling and logging
router.get('/', authenticateToken, async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Projects ${requestId}] Starting request to fetch all projects`);

  try {
    // First verify database connection and user authentication
    if (!req.user) {
      console.error(`[Projects ${requestId}] No authenticated user found`);
      return res.status(401).json({ 
        message: "Authentication required"
      });
    }

    console.log(`[Projects ${requestId}] Authenticated user:`, req.user.id);

    // Fetch projects with error handling
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[Projects ${requestId}] Database query error:`, error);
      return res.status(500).json({ 
        message: "Failed to fetch projects from database",
        error: error.message
      });
    }

    if (!projects) {
      console.log(`[Projects ${requestId}] No projects found`);
      return res.json([]);
    }

    console.log(`[Projects ${requestId}] Successfully fetched ${projects.length} projects`);

    // Log sample project for debugging
    if (projects.length > 0) {
      console.log(`[Projects ${requestId}] Sample project:`, {
        mis: projects[0].mis,
        event_description: projects[0].event_description
      });
    }

    return res.json(projects);

  } catch (error) {
    console.error(`[Projects ${requestId}] Unexpected error:`, error);
    return res.status(500).json({ 
      message: "Failed to fetch projects",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project expenditure types
router.get('/:projectId/expenditure-types', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: project, error } = await supabase
      .from('project_catalog')
      .select('expenditure_type')
      .eq('mis', projectId)
      .single();

    if (error) throw error;

    let expenditureTypes: string[] = [];
    if (project?.expenditure_type) {
      if (Array.isArray(project.expenditure_type)) {
        expenditureTypes = project.expenditure_type;
      } else if (typeof project.expenditure_type === 'string') {
        expenditureTypes = project.expenditure_type
          .replace(/[{}]/g, '')
          .split(',')
          .map(type => type.trim())
          .filter(Boolean);
      }
    }

    res.json(expenditureTypes);
  } catch (error) {
    console.error('[Projects] Error fetching expenditure types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenditure types',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project expenditure types
router.get('/:mis/expenditure-types', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    console.log(`[Projects] Fetching expenditure types for project ${mis}`);

    const { data: project, error } = await supabase
      .from('project_catalog')
      .select('expenditure_type')
      .eq('mis', mis)
      .single();

    if (error) throw error;

    let expenditureTypes: string[] = [];
    if (project?.expenditure_type) {
      if (Array.isArray(project.expenditure_type)) {
        expenditureTypes = project.expenditure_type;
      } else if (typeof project.expenditure_type === 'string') {
        expenditureTypes = project.expenditure_type
          .replace(/[{}]/g, '')
          .split(',')
          .map(type => type.trim())
          .filter(Boolean);
      }
    }

    res.json(expenditureTypes);
  } catch (error) {
    console.error('[Projects] Error fetching expenditure types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenditure types',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single project by MIS
router.get('/:mis', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    console.log(`[Projects] Fetching project with MIS: ${mis}`);

    const { data: project, error } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', mis)
      .single();

    if (error) {
      console.error('[Projects] Database error:', error);
      return res.status(500).json({ 
        message: "Failed to fetch project",
        error: error.message
      });
    }

    if (!project) {
      console.log(`[Projects] No project found with MIS: ${mis}`);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log(`[Projects] Successfully fetched project: ${project.mis}`);
    return res.json(project);

  } catch (error) {
    console.error('[Projects] Error fetching project:', error);
    return res.status(500).json({
      message: 'Failed to fetch project',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Export projects to XLSX
router.get('/export/xlsx', authenticateToken, async (req, res) => {
  try {
    console.log('[Projects] Starting XLSX export');
    const { data: projects, error } = await supabase
      .from('Projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Projects] Database error:', error);
      return res.status(500).json({ 
        message: "Failed to export projects",
        error: error.message
      });
    }

    if (!projects?.length) {
      console.log('[Projects] No projects found for export');
      return res.status(404).json({ message: 'No projects found for export' });
    }

    console.log(`[Projects] Found ${projects.length} projects to export`);

    const wsData = projects.map(project => ({
      MIS: project.mis || '',
      NA853: project.na853 || '',
      E069: project.e069 || '',
      NA271: project.na271 || '',
      Event_Description: project.event_description || '',
      Project_Title: project.project_title || '',
      Event_Type: Array.isArray(project.event_type) ? project.event_type.join(', ') : '',
      Event_Year: Array.isArray(project.event_year) ? project.event_year.join(', ') : '',
      Region: project.region?.region?.join(', ') || '',
      Regional_Unit: project.region?.regional_unit?.join(', ') || '',
      Municipality: project.region?.municipality?.join(', ') || '',
      Implementing_Agency: Array.isArray(project.implementing_agency) 
        ? project.implementing_agency.join(', ') 
        : '',
      Budget_NA853: project.budget_na853?.toString() || '0',
      Budget_E069: project.budget_e069?.toString() || '0',
      Budget_NA271: project.budget_na271?.toString() || '0',
      Status: project.status || '',
      KYA: Array.isArray(project.kya) ? project.kya.join(', ') : '',
      FEK: Array.isArray(project.fek) ? project.fek.join(', ') : '',
      ADA: Array.isArray(project.ada) ? project.ada.join(', ') : '',
      Created_At: project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
      Updated_At: project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Projects');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    return res.send(buffer);

  } catch (error) {
    console.error('[Projects] Export error:', error);
    return res.status(500).json({
      message: 'Failed to export projects',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk upload
router.post('/bulk-upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    const records: any[] = await new Promise((resolve, reject) => {
      const results: any[] = [];
      parse(req.file!.buffer, {
        columns: true,
        skip_empty_lines: true
      })
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    // Process each record
    for (const record of records) {
      const { error } = await supabase
        .from('project_catalog')
        .upsert({
          mis: record.MIS,
          na853: record.NA853,
          event_description: record.Description,
          budget_na853: parseFloat(record.Budget) || 0,
          status: record.Status,
          region: record.Region,
        }, {
          onConflict: 'mis'
        });

      if (error) throw error;
    }

    res.json({
      success: true,
      message: `Successfully processed ${records.length} records`
    });
  } catch (error) {
    console.error('[Projects] Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Bulk update
router.put('/bulk-update', authenticateToken, async (req, res) => {
  try {
    console.log('[Projects] Starting bulk update');
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    // Process each update sequentially
    for (const update of updates) {
      const { mis, data } = update;

      if (!mis || !data) {
        throw new Error(`Invalid update data: missing mis or data`);
      }

      // Validate MIS exists
      const { data: existing, error: checkError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', mis)
        .single();

      if (checkError || !existing) {
        throw new Error(`Project with MIS ${mis} not found`);
      }

      const { error: updateError } = await supabase
        .from('Projects')
        .update(data)
        .eq('mis', mis);

      if (updateError) {
        throw new Error(`Failed to update project ${mis}: ${updateError.message}`);
      }

      console.log(`[Projects] Successfully updated project ${mis}`);
    }

    res.json({
      success: true,
      message: `Successfully updated ${updates.length} projects`
    });
  } catch (error) {
    console.error('[Projects] Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process bulk update'
    });
  }
});

export default router;