import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { ProjectCatalog } from '@shared/schema';
import { createObjectCsvStringifier } from 'csv-writer';
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

// Export projects
router.get('/export', authenticateToken, isAdmin, async (req, res) => {
  try {
    const projects = await db.query.ProjectCatalog.findMany();

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'mis', title: 'MIS' },
        { id: 'na853', title: 'NA853' },
        { id: 'event_description', title: 'Description' },
        { id: 'budget_na853', title: 'Budget' },
        { id: 'status', title: 'Status' },
        { id: 'region', title: 'Region' },
      ]
    });

    const csvString = csvStringifier.stringifyRecords(projects);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvString);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export projects' 
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