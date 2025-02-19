import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { ProjectCatalog } from '@shared/schema';
import * as xlsx from 'xlsx';
import multer from 'multer';
import { parse } from 'csv-parse';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await db.query.ProjectCatalog.findMany();
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
    const projects = await db.query.ProjectCatalog.findMany();

    if (!projects.length) {
      return res.status(400).json({
        success: false,
        message: 'No projects found for export'
      });
    }

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(projects.map(project => ({
      MIS: project.mis,
      NA853: project.na853,
      Description: project.event_description,
      Budget: project.budget_na853,
      Status: project.status,
      Region: project.region
    })));

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Projects');

    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export projects' 
    });
  }
});

// Delete project
router.delete('/:mis', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { mis } = req.params;

    const result = await db.delete(ProjectCatalog)
      .where(eq(ProjectCatalog.mis, mis))
      .returning();

    if (!result.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

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

    // Validate and process records
    for (const record of records) {
      await db.insert(ProjectCatalog)
        .values({
          mis: record.MIS,
          na853: record.NA853,
          event_description: record.Description,
          budget_na853: parseFloat(record.Budget),
          status: record.Status,
          region: record.Region,
        })
        .onConflictDoUpdate({
          target: [ProjectCatalog.mis],
          set: {
            na853: record.NA853,
            event_description: record.Description,
            budget_na853: parseFloat(record.Budget),
            status: record.Status,
            region: record.Region,
          }
        });
    }

    res.json({ 
      success: true, 
      message: `Successfully processed ${records.length} records` 
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process bulk upload' 
    });
  }
});

export default router;