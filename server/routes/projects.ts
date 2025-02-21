import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { supabase } from '../db';
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
      Description: project.event_description || '',
      Budget: typeof project.budget_na853 === 'number' ? project.budget_na853 : 0,
      Annual_Credit: typeof project.ethsia_pistosi === 'number' ? project.ethsia_pistosi : 0,
      Status: project.status || '',
      Region: project.region || '',
      Created_At: project.created_at ? new Date(project.created_at).toLocaleDateString() : ''
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

export default router;