import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../authentication';
import { supabase } from '../config/db';
import { log } from '../vite';
import { resolveProject } from '../utils/projectResolver';

const router = Router();

/**
 * GET /api/projects/:id/subprojects
 * Get all subprojects for a specific project
 */
router.get('/:id/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const identifier = req.params.id;
    
    if (!identifier) {
      return res.status(400).json({
        error: 'Invalid project identifier'
      });
    }

    log(`[Subprojects] Fetching subprojects for project identifier: ${identifier}`);

    // Resolve project using the project resolver (handles MIS, project ID, NA853)
    const project = await resolveProject(identifier);

    if (!project) {
      log(`[Subprojects] Project not found: ${identifier}`);
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    const projectId = project.id;

    // Get subprojects for this project
    const { data: subprojects, error: subprojectsError } = await supabase
      .from('project_subprojects')
      .select('*')
      .eq('project_id', projectId)
      .order('id');

    if (subprojectsError) {
      log(`[Subprojects] Database error:`, subprojectsError.message);
      return res.status(500).json({
        error: 'Failed to fetch subprojects'
      });
    }

    log(`[Subprojects] Found ${subprojects?.length || 0} subprojects for project ${projectId} (${project.na853})`);

    res.json({
      success: true,
      project: {
        id: project.id,
        mis: project.mis,
        na853: project.na853,
        title: project.project_title
      },
      subprojects: subprojects || []
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/projects/:id/subprojects
 * Create a new subproject for a specific project
 */
router.post('/:id/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    const { code, title, type, status = 'Συνεχιζόμενο', version, description, yearly_budgets } = req.body;
    
    if (isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    if (!code || !title || !type) {
      return res.status(400).json({
        error: 'Code, title, and type are required'
      });
    }

    log(`[Subprojects] Creating subproject for project ID: ${projectId}`);

    // Create the subproject
    const { data: subproject, error } = await supabase
      .from('project_subprojects')
      .insert({
        project_id: projectId,
        code,
        title,
        type,
        status,
        version,
        description,
        yearly_budgets: yearly_budgets || {},
        created_by: req.user?.id
      })
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Creation error:`, error.message);
      return res.status(500).json({
        error: 'Failed to create subproject'
      });
    }

    log(`[Subprojects] Successfully created subproject: ${subproject.code}`);

    res.status(201).json({
      success: true,
      subproject
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export { router as subprojectsRouter };
export default router;