import { Router } from 'express';
import { supabase } from '../config/db';
import { authenticateToken } from '../middleware/authMiddleware'; //Preserving the original middleware
import { ProjectCatalog } from '@shared/schema';
import * as xlsx from 'xlsx';
import multer from 'multer';
import { parse } from 'csv-parse';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('[Projects] Fetching all projects');
    const { data: projects, error } = await supabase
      .from('project_catalog')
      .select('*')
      .order('mis');

    if (error) {
      console.error('[Projects] Error fetching projects:', error);
      throw error;
    }

    console.log(`[Projects] Successfully fetched ${projects?.length || 0} projects`);
    res.json(projects || []);
  } catch (error) {
    console.error('[Projects] Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
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

// Export projects to XLSX
router.get('/export/xlsx', authenticateToken, async (req, res) => {
  try {
    console.log('[Projects] Starting XLSX export...');
    const { data: projects, error } = await supabase
      .from('project_catalog')
      .select('*');

    if (error) {
      console.error('[Projects] Database query error:', error);
      throw error;
    }

    if (!projects?.length) {
      console.log('[Projects] No projects found for export');
      return res.status(400).json({
        success: false,
        message: 'No projects found for export'
      });
    }

    console.log(`[Projects] Found ${projects.length} projects to export`);

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const wsData = projects.map(project => ({
      MIS: project.mis || '',
      NA853: project.na853 || '',
      NA271: project.na271 || '',
      E069: project.e069 || '',
      Event_Description: project.event_description || '',
      Project_Title: project.project_title || '',
      Event_Type: project.event_type || '',
      Event_Year: Array.isArray(project.event_year) ? project.event_year.join(', ') : '',
      Region: project.region || '',
      Regional_Unit: project.regional_unit || '',
      Municipality: project.municipality || '',
      Implementing_Agency: Array.isArray(project.implementing_agency)
        ? project.implementing_agency.join(', ')
        : project.implementing_agency || '',
      Budget_NA853: project.budget_na853?.toString() || '0',
      Budget_E069: project.budget_e069?.toString() || '0',
      Budget_NA271: project.budget_na271?.toString() || '0',
      Annual_Credit: project.ethsia_pistosi?.toString() || '0',
      Status: project.status || '',
      KYA: project.kya || '',
      FEK: project.fek || '',
      ADA: project.ada || '',
      Expenditure_Type: Array.isArray(project.expenditure_type)
        ? project.expenditure_type.join(', ')
        : project.expenditure_type || '',
      Procedures: project.procedures || '',
      Created_At: project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
      Updated_At: project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''
    }));

    const ws = xlsx.utils.json_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Projects');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);

  } catch (error) {
    console.error('[Projects] Export error:', error);
    res.status(500).json({
      success: false,
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

// Add this route after the existing routes
router.put('/bulk-update', authenticateToken, async (req, res) => {
  try {
    console.log('[Projects] Starting bulk update for budget_na853_split');

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

      if (!mis || !data?.budget_na853_split) {
        throw new Error(`Invalid update data: missing mis or budget_na853_split value`);
      }

      // Validate MIS exists
      const { data: existing, error: checkError } = await supabase
        .from('project_catalog')
        .select('id')
        .eq('mis', mis)
        .single();

      if (checkError || !existing) {
        throw new Error(`Project with MIS ${mis} not found`);
      }

      // Update only the budget_na853_split field
      const { error: updateError } = await supabase
        .from('project_catalog')
        .update({ budget_na853_split: data.budget_na853_split })
        .eq('mis', mis);

      if (updateError) {
        throw new Error(`Failed to update project ${mis}: ${updateError.message}`);
      }

      console.log(`[Projects] Successfully updated budget split for project ${mis}`);
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