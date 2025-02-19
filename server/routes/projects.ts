import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import { db } from '../db';
import { ProjectCatalog } from '@shared/schema';
import * as xlsx from 'xlsx';
import multer from 'multer';
import { parse } from 'csv-parse';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: projects, error } = await db
      .from('project_catalog')
      .select('*');

    if (error) throw error;

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch projects' 
    });
  }
});

// Export projects to XLSX
router.get('/export/xlsx', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Starting XLSX export...');
    const { data: projects, error } = await db
      .from('project_catalog')
      .select('*');

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!projects?.length) {
      console.log('No projects found for export');
      return res.status(400).json({
        success: false,
        message: 'No projects found for export'
      });
    }

    console.log(`Found ${projects.length} projects to export`);

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const wsData = projects.map(project => ({
      MIS: project.mis,
      NA853: project.na853,
      Description: project.event_description,
      Budget: project.budget_na853,
      Status: project.status,
      Region: project.region
    }));

    const ws = xlsx.utils.json_to_sheet(wsData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Projects');

    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    console.log('XLSX file generated successfully');

    // Set headers and send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export projects',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete project
router.delete('/:mis', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { mis } = req.params;
    const { error } = await db
      .from('project_catalog')
      .delete()
      .eq('mis', mis);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete project' 
    });
  }
});

// Bulk upload
router.post('/bulk-upload', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
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
      const { error } = await db
        .from('project_catalog')
        .upsert({
          mis: record.MIS,
          na853: record.NA853,
          event_description: record.Description,
          budget_na853: parseFloat(record.Budget),
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
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process bulk upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;