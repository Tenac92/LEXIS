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

    // Get linked subprojects for this project via junction table
    let subprojects: any[] = [];
    
    try {
      const { data, error } = await supabase
        .from('project_subprojects')
        .select(`
          id,
          subproject_id,
          Subprojects!inner(
            id,
            title,
            description,
            subproject_code,
            status,
            yearly_budgets,
            created_at,
            updated_at
          )
        `)
        .eq('project_id', projectId);

      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('column')) {
          log(`[Subprojects] Table/column structure issue - returning empty list: ${error.message}`);
          subprojects = [];
        } else {
          throw error;
        }
      } else {
        // Flatten the data structure
        subprojects = (data || []).map((item: any) => ({
          id: item.Subprojects.id,
          title: item.Subprojects.title,
          description: item.Subprojects.description,
          code: item.Subprojects.subproject_code,
          status: item.Subprojects.status,
          yearly_budgets: item.Subprojects.yearly_budgets,
          created_at: item.Subprojects.created_at,
          updated_at: item.Subprojects.updated_at,
          junction_id: item.id
        }));
      }
    } catch (tableError: any) {
      log(`[Subprojects] Table structure error, returning empty list:`, tableError.message);
      subprojects = [];
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
 * Link an existing subproject to a project
 */
router.post('/:id/subprojects/link', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const identifier = req.params.id;
    const { subproject_id } = req.body;
    
    if (!identifier) {
      return res.status(400).json({
        error: 'Invalid project identifier'
      });
    }

    if (!subproject_id) {
      return res.status(400).json({
        error: 'Subproject ID is required'
      });
    }

    // Resolve project
    const project = await resolveProject(identifier);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    log(`[Subprojects] Linking subproject ${subproject_id} to project ID: ${project.id}`);

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from('project_subprojects')
      .select('id')
      .eq('project_id', project.id)
      .eq('subproject_id', subproject_id)
      .single();

    if (existingLink) {
      return res.status(409).json({
        error: 'Subproject is already linked to this project'
      });
    }

    // Create the link
    const { data: link, error } = await supabase
      .from('project_subprojects')
      .insert({
        project_id: project.id,
        subproject_id
      })
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Link creation error:`, error.message);
      return res.status(500).json({
        error: 'Failed to link subproject'
      });
    }

    log(`[Subprojects] Successfully linked subproject ${subproject_id} to project ${project.id}`);

    res.status(201).json({
      success: true,
      link
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
 * Create a new subproject and link it to a project
 */
router.post('/:id/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const identifier = req.params.id;
    const { code, title, description, status = 'active', yearly_budgets } = req.body;
    
    if (!identifier) {
      return res.status(400).json({
        error: 'Invalid project identifier'
      });
    }

    if (!title) {
      return res.status(400).json({
        error: 'Title is required'
      });
    }

    // Resolve project
    const project = await resolveProject(identifier);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    log(`[Subprojects] Creating new subproject for project ID: ${project.id}`);

    // First, create the subproject in the Subprojects table (without subproject_code)
    const { data: subproject, error: subprojectError } = await supabase
      .from('Subprojects')
      .insert({
        title,
        description,
        status
      })
      .select()
      .single();

    if (subprojectError) {
      log(`[Subprojects] Subproject creation error:`, subprojectError.message);
      return res.status(500).json({
        error: 'Failed to create subproject'
      });
    }

    // Then, link it to the project with subproject_code and yearly_budgets in junction table
    const { data: link, error: linkError } = await supabase
      .from('project_subprojects')
      .insert({
        project_id: project.id,
        subproject_id: subproject.id,
        subproject_code: code || null,
        yearly_budgets: yearly_budgets || null
      })
      .select()
      .single();

    if (linkError) {
      log(`[Subprojects] Link creation error:`, linkError.message);
      // Try to cleanup the subproject we just created
      await supabase.from('Subprojects').delete().eq('id', subproject.id);
      return res.status(500).json({
        error: 'Failed to link subproject to project'
      });
    }

    log(`[Subprojects] Successfully created and linked subproject: ${subproject.title} (code: ${code})`);

    res.status(201).json({
      success: true,
      subproject: {
        id: subproject.id,
        title: subproject.title,
        description: subproject.description,
        code: code,
        status: subproject.status,
        yearly_budgets: yearly_budgets,
        created_at: subproject.created_at,
        updated_at: subproject.updated_at,
        junction_id: link.id
      }
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/subprojects
 * Get all available subprojects for selection
 */
router.get('/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    log(`[Subprojects] Fetching all available subprojects`);

    const { data: subprojects, error } = await supabase
      .from('Subprojects')
      .select('*')
      .order('title');

    if (error) {
      log(`[Subprojects] Error fetching all subprojects:`, error.message);
      return res.status(500).json({
        error: 'Failed to fetch subprojects'
      });
    }

    log(`[Subprojects] Found ${subprojects?.length || 0} available subprojects`);

    res.json({
      success: true,
      subprojects: (subprojects || []).map(sp => ({
        id: sp.id,
        title: sp.title,
        description: sp.description,
        code: sp.subproject_code,
        status: sp.status,
        yearly_budgets: sp.yearly_budgets,
        created_at: sp.created_at,
        updated_at: sp.updated_at
      }))
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