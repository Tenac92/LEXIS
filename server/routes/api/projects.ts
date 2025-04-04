/**
 * Projects API Routes
 * Centralizes all project-related endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, supabase } from '../../data';
import { log } from '../../vite';
import { AuthenticatedRequest } from '../../auth';
import {
  projects,
  Project,
  insertProjectSchema
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

// Create router
const router = Router();

/**
 * Get all projects
 * GET /api/projects
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Query parameters
    const { search, status, unit } = req.query;

    // Build query
    let query = supabase.from('Projects').select('*');

    // Apply filters
    if (search) {
      query = query.or(`mis.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (unit) {
      // For unit filtering, we need to check if the unit is in the implementing_agency array
      query = query.contains('implementing_agency', [unit]);
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json(data);
  } catch (error) {
    log(`[Projects] Error fetching projects: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch projects',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get projects for a specific unit
 * GET /api/projects/by-unit/:unitName
 */
router.get('/by-unit/:unitName', async (req: Request, res: Response) => {
  try {
    const unitName = req.params.unitName;

    log(`[Projects] Fetching projects for unit: ${unitName}`, 'info');

    // Query projects that have the unit in implementing_agency
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .contains('implementing_agency', [unitName]);

    if (error) {
      throw error;
    }

    log(`[Projects] Found ${data?.length || 0} projects for unit: ${unitName}`, 'info');

    res.status(200).json(data);
  } catch (error) {
    log(`[Projects] Error fetching projects by unit: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch projects by unit',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get expenditure types for a project
 * GET /api/projects/expenditure-types/:projectId
 */
router.get('/expenditure-types/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;

    // Query the project
    const { data, error } = await supabase
      .from('Projects')
      .select('expenditure_type')
      .eq('mis', projectId)
      .single();

    if (error) {
      throw error;
    }

    // Return the expenditure types
    res.status(200).json(data?.expenditure_type || []);
  } catch (error) {
    log(`[Projects] Error fetching expenditure types: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch expenditure types',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get regions for a project
 * GET /api/projects/:mis/regions
 */
router.get('/:mis/regions', async (req: Request, res: Response) => {
  try {
    const mis = req.params.mis;

    // Query the project
    const { data, error } = await supabase
      .from('Projects')
      .select('region')
      .eq('mis', mis)
      .single();

    if (error) {
      throw error;
    }

    // Return the regions
    res.status(200).json(data?.region || {});
  } catch (error) {
    log(`[Projects] Error fetching regions: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to fetch regions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export projects to XLSX
 * GET /api/projects/export/xlsx
 * Accessible by both admin and manager roles
 */
router.get('/export/xlsx', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check user role - allow both admin and manager roles to export
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Admin or manager access required to export projects' });
    }

    // Get all projects
    const { data, error } = await supabase
      .from('Projects')
      .select('*');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No projects found' });
    }

    // Format project data for Excel
    const formattedData = data.map(project => ({
      MIS: project.mis,
      Title: project.title,
      Status: project.status,
      'Implementing Agencies': Array.isArray(project.implementing_agency) 
        ? project.implementing_agency.join(', ') 
        : project.implementing_agency,
      'Budget NA853': project.budget_na853,
      'Budget NA271': project.budget_na271,
      'Budget E069': project.budget_e069,
      'Created At': project.created_at
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx');

    // Send buffer
    res.send(buffer);
  } catch (error) {
    log(`[Projects] Error exporting projects: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to export projects',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a new project
 * POST /api/projects
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required to create projects' });
    }

    // Validate request body against schema
    const projectData = insertProjectSchema.parse(req.body);

    // Create project
    const { data, error } = await supabase
      .from('Projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    log(`[Projects] Error creating project: ${error}`, 'error');

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid project data',
        errors: error.errors
      });
    }

    res.status(500).json({
      message: 'Failed to create project',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a project
 * PATCH /api/projects/:id
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required to update projects' });
    }

    const projectId = req.params.id;
    const updates = req.body;

    // Update project
    const { data, error } = await supabase
      .from('Projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json(data);
  } catch (error) {
    log(`[Projects] Error updating project: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to update project',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Bulk update projects
 * POST /api/projects/bulk-update
 */
router.post('/bulk-update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required to perform bulk updates' });
    }

    const updateItems = req.body.items;

    if (!updateItems || !Array.isArray(updateItems) || updateItems.length === 0) {
      return res.status(400).json({ message: 'No update items provided' });
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each update item
    for (const item of updateItems) {
      try {
        const { mis, na853, data } = item;

        // Update the budget data
        const { error } = await supabase
          .from('budget_na853_split')
          .update(data)
          .eq('mis', mis)
          .eq('na853', na853);

        if (error) {
          throw error;
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Error updating ${item.mis}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      message: `Processed ${updateItems.length} items: ${results.successful} successful, ${results.failed} failed`,
      results
    });
  } catch (error) {
    log(`[Projects] Error performing bulk update: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to perform bulk update',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get a single project by ID or MIS code
 * GET /api/projects/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json');

  try {
    const { id } = req.params;
    console.log(`[Projects] Fetching project with id/code: ${id}`);

    // Try to find by ID first
    const { data: project, error } = await supabase
      .from('Projects')
      .select('*')
      .or(`id.eq.${id},na853.eq.${id}`)
      .single();

    if (error) {
      console.error('[Projects] Database error:', error);
      return res.status(404).json({ 
        error: 'Project not found',
        details: error.message 
      });
    }

    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }

    return res.json(project);
  } catch (error) {
    console.error('[Projects] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;