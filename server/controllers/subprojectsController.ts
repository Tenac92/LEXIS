import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../authentication';
import { supabase } from '../config/db';
import { log } from '../vite';

const router = Router();

/**
 * GET /api/epa-versions/:epaVersionId/subprojects
 * Get all subprojects for a specific EPA version
 */
router.get('/epa-versions/:epaVersionId/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const epaVersionId = parseInt(req.params.epaVersionId);
    
    if (!epaVersionId || isNaN(epaVersionId)) {
      return res.status(400).json({
        error: 'Invalid EPA version ID'
      });
    }

    log(`[Subprojects] Fetching subprojects for EPA version ID: ${epaVersionId}`);

    // Get subprojects for this EPA version with their financials
    // Handle cases where epa_version_id might be null by also checking for unlinked subprojects
    const { data: subprojects, error } = await supabase
      .from('Subprojects')
      .select(`
        id,
        epa_version_id,
        title,
        description,
        status,
        created_at,
        updated_at
      `)
      .eq('epa_version_id', epaVersionId)
      .order('title');

    if (error) {
      log(`[Subprojects] Error fetching subprojects:`, error.message);
      return res.status(500).json({
        error: 'Failed to fetch subprojects'
      });
    }

    // If no linked subprojects found, also return unlinked ones that could be linked
    let finalSubprojects = subprojects || [];
    
    if (!finalSubprojects.length) {
      log(`[Subprojects] No linked subprojects found, checking for unlinked subprojects`);
      const { data: unlinkedSubprojects, error: unlinkedError } = await supabase
        .from('Subprojects')
        .select(`
          id,
          epa_version_id,
          title,
          description,
          status,
          created_at,
          updated_at
        `)
        .is('epa_version_id', null)
        .order('title')
        .limit(10); // Limit to prevent too many results

      if (!unlinkedError && unlinkedSubprojects) {
        finalSubprojects = unlinkedSubprojects;
        log(`[Subprojects] Found ${unlinkedSubprojects.length} unlinked subprojects that could be linked`);
      }
    }

    // Transform subprojects to include mock financials if needed (for compatibility)
    const transformedSubprojects = finalSubprojects.map(subproject => ({
      ...subproject,
      subproject_financials: [] // Will be populated separately via financials API
    }));

    log(`[Subprojects] Found ${transformedSubprojects?.length || 0} subprojects for EPA version ${epaVersionId}`);

    res.json({
      success: true,
      subprojects: transformedSubprojects
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/epa-versions/:epaVersionId/subprojects
 * Create a new subproject for an EPA version
 */
router.post('/epa-versions/:epaVersionId/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const epaVersionId = parseInt(req.params.epaVersionId);
    const { title, description, status = 'Συνεχιζόμενο' } = req.body;
    
    if (!epaVersionId || isNaN(epaVersionId)) {
      return res.status(400).json({
        error: 'Invalid EPA version ID'
      });
    }

    if (!title) {
      return res.status(400).json({
        error: 'Title is required'
      });
    }

    log(`[Subprojects] Creating new subproject for EPA version ID: ${epaVersionId}`);

    // Verify EPA version exists
    const { data: epaVersion, error: epaError } = await supabase
      .from('project_budget_versions')
      .select('id, budget_type')
      .eq('id', epaVersionId)
      .eq('budget_type', 'ΕΠΑ')
      .single();

    if (epaError || !epaVersion) {
      return res.status(404).json({
        error: 'EPA version not found'
      });
    }

    // Create the subproject
    const { data: subproject, error: subprojectError } = await supabase
      .from('Subprojects')
      .insert({
        epa_version_id: epaVersionId,
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

    log(`[Subprojects] Successfully created subproject: ${subproject.title}`);

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

/**
 * PUT /api/subprojects/:id
 * Update a subproject
 */
router.put('/subprojects/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subprojectId = parseInt(req.params.id);
    const { title, description, status } = req.body;
    
    if (!subprojectId || isNaN(subprojectId)) {
      return res.status(400).json({
        error: 'Invalid subproject ID'
      });
    }

    log(`[Subprojects] Updating subproject ID: ${subprojectId}`);

    const { data: subproject, error } = await supabase
      .from('Subprojects')
      .update({
        title,
        description,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', subprojectId)
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Update error:`, error.message);
      return res.status(500).json({
        error: 'Failed to update subproject'
      });
    }

    log(`[Subprojects] Successfully updated subproject: ${subproject.title}`);

    res.json({
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

/**
 * DELETE /api/subprojects/:id
 * Delete a subproject and all its financials
 */
router.delete('/subprojects/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subprojectId = parseInt(req.params.id);
    
    if (!subprojectId || isNaN(subprojectId)) {
      return res.status(400).json({
        error: 'Invalid subproject ID'
      });
    }

    log(`[Subprojects] Deleting subproject ID: ${subprojectId}`);

    const { error } = await supabase
      .from('Subprojects')
      .delete()
      .eq('id', subprojectId);

    if (error) {
      log(`[Subprojects] Delete error:`, error.message);
      return res.status(500).json({
        error: 'Failed to delete subproject'
      });
    }

    log(`[Subprojects] Successfully deleted subproject ID: ${subprojectId}`);

    res.json({
      success: true,
      message: 'Subproject deleted successfully'
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/subprojects/:id/financials
 * Add financial data for a subproject year
 */
router.post('/subprojects/:id/financials', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subprojectId = parseInt(req.params.id);
    const { year, total_public, eligible_public } = req.body;
    
    if (!subprojectId || isNaN(subprojectId)) {
      return res.status(400).json({
        error: 'Invalid subproject ID'
      });
    }

    if (!year || !total_public || !eligible_public) {
      return res.status(400).json({
        error: 'Year, total_public, and eligible_public are required'
      });
    }

    // Validate eligible <= total
    const totalPublicNum = parseFloat(total_public.toString().replace(/,/g, ''));
    const eligiblePublicNum = parseFloat(eligible_public.toString().replace(/,/g, ''));

    if (eligiblePublicNum > totalPublicNum) {
      return res.status(400).json({
        error: 'Eligible public expense cannot exceed total public expense'
      });
    }

    log(`[Subprojects] Adding financial data for subproject ${subprojectId}, year ${year}`);

    // Check if financials for this year already exist
    const { data: existing } = await supabase
      .from('subproject_financials')
      .select('id')
      .eq('subproject_id', subprojectId)
      .eq('year', year)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'Financial data for this year already exists'
      });
    }

    const { data: financial, error } = await supabase
      .from('subproject_financials')
      .insert({
        subproject_id: subprojectId,
        year: parseInt(year),
        total_public: totalPublicNum.toString(),
        eligible_public: eligiblePublicNum.toString()
      })
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Financial creation error:`, error.message);
      return res.status(500).json({
        error: 'Failed to create subproject financial data'
      });
    }

    log(`[Subprojects] Successfully created financial data for subproject ${subprojectId}, year ${year}`);

    res.status(201).json({
      success: true,
      financial
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/subprojects/financials/:id
 * Update financial data for a subproject year
 */
router.put('/subprojects/financials/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const financialId = parseInt(req.params.id);
    const { year, total_public, eligible_public } = req.body;
    
    if (!financialId || isNaN(financialId)) {
      return res.status(400).json({
        error: 'Invalid financial ID'
      });
    }

    // Validate eligible <= total
    const totalPublicNum = parseFloat(total_public.toString().replace(/,/g, ''));
    const eligiblePublicNum = parseFloat(eligible_public.toString().replace(/,/g, ''));

    if (eligiblePublicNum > totalPublicNum) {
      return res.status(400).json({
        error: 'Eligible public expense cannot exceed total public expense'
      });
    }

    log(`[Subprojects] Updating financial data ID: ${financialId}`);

    const { data: financial, error } = await supabase
      .from('subproject_financials')
      .update({
        year: year ? parseInt(year) : undefined,
        total_public: totalPublicNum.toString(),
        eligible_public: eligiblePublicNum.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', financialId)
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Financial update error:`, error.message);
      return res.status(500).json({
        error: 'Failed to update subproject financial data'
      });
    }

    log(`[Subprojects] Successfully updated financial data ID: ${financialId}`);

    res.json({
      success: true,
      financial
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/subprojects/financials/:id
 * Delete financial data for a subproject year
 */
router.delete('/subprojects/financials/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const financialId = parseInt(req.params.id);
    
    if (!financialId || isNaN(financialId)) {
      return res.status(400).json({
        error: 'Invalid financial ID'
      });
    }

    log(`[Subprojects] Deleting financial data ID: ${financialId}`);

    const { error } = await supabase
      .from('subproject_financials')
      .delete()
      .eq('id', financialId);

    if (error) {
      log(`[Subprojects] Financial delete error:`, error.message);
      return res.status(500).json({
        error: 'Failed to delete subproject financial data'
      });
    }

    log(`[Subprojects] Successfully deleted financial data ID: ${financialId}`);

    res.json({
      success: true,
      message: 'Financial data deleted successfully'
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/epa-versions/:epaVersionId/financial-validation
 * Validate EPA totals vs subproject totals and return mismatch info
 */
router.get('/epa-versions/:epaVersionId/financial-validation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const epaVersionId = parseInt(req.params.epaVersionId);
    
    if (!epaVersionId || isNaN(epaVersionId)) {
      return res.status(400).json({
        error: 'Invalid EPA version ID'
      });
    }

    log(`[Subprojects] Validating financials for EPA version ID: ${epaVersionId}`);

    // Get EPA financials
    const { data: epaFinancials, error: epaError } = await supabase
      .from('epa_financials')
      .select('year, total_public_expense, eligible_public_expense')
      .eq('epa_version_id', epaVersionId);

    if (epaError) {
      log(`[Subprojects] Error fetching EPA financials:`, epaError.message);
      return res.status(500).json({
        error: 'Failed to fetch EPA financials'
      });
    }

    // Get subproject financials totals per year
    const { data: subprojectTotals, error: subprojectError } = await supabase
      .from('subproject_financials')
      .select(`
        year,
        total_public,
        eligible_public,
        Subprojects!inner (
          epa_version_id
        )
      `)
      .eq('Subprojects.epa_version_id', epaVersionId);

    if (subprojectError) {
      log(`[Subprojects] Error fetching subproject financials:`, subprojectError.message);
      return res.status(500).json({
        error: 'Failed to fetch subproject financials'
      });
    }

    // Calculate totals by year
    const subprojectSums: Record<number, { total_public: number; eligible_public: number }> = {};
    
    subprojectTotals?.forEach(item => {
      if (!subprojectSums[item.year]) {
        subprojectSums[item.year] = { total_public: 0, eligible_public: 0 };
      }
      subprojectSums[item.year].total_public += parseFloat(item.total_public || '0');
      subprojectSums[item.year].eligible_public += parseFloat(item.eligible_public || '0');
    });

    // Compare EPA vs subproject totals
    const validation: any[] = [];
    
    epaFinancials?.forEach(epa => {
      const epaTotal = parseFloat(epa.total_public_expense || '0');
      const epaEligible = parseFloat(epa.eligible_public_expense || '0');
      
      const subprojectSum = subprojectSums[epa.year] || { total_public: 0, eligible_public: 0 };
      
      const totalMismatch = Math.abs(epaTotal - subprojectSum.total_public) > 0.01;
      const eligibleMismatch = Math.abs(epaEligible - subprojectSum.eligible_public) > 0.01;
      
      validation.push({
        year: epa.year,
        epa_totals: {
          total_public: epaTotal,
          eligible_public: epaEligible
        },
        subproject_totals: {
          total_public: subprojectSum.total_public,
          eligible_public: subprojectSum.eligible_public
        },
        mismatches: {
          total_public: totalMismatch ? epaTotal - subprojectSum.total_public : 0,
          eligible_public: eligibleMismatch ? epaEligible - subprojectSum.eligible_public : 0
        },
        has_mismatch: totalMismatch || eligibleMismatch
      });
    });

    const overallMismatch = validation.some(v => v.has_mismatch);

    res.json({
      success: true,
      validation,
      has_overall_mismatch: overallMismatch
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/projects/:projectId/epa-versions
 * Get all EPA versions for a specific project
 */
router.get('/projects/:projectId/epa-versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    log(`[Subprojects] Fetching EPA versions for project ID: ${projectId}`);

    // Fetch EPA versions from project_budget_versions table with formulation mapping
    const { data: epaVersions, error } = await supabase
      .from('project_budget_versions')
      .select(`
        id,
        project_id,
        formulation_id,
        budget_type,
        epa_version,
        protocol_number,
        ada,
        decision_date,
        comments,
        created_at,
        updated_at,
        boundary_budget,
        action_type
      `)
      .eq('project_id', projectId)
      .eq('budget_type', 'ΕΠΑ')
      .order('id', { ascending: true });

    if (error) {
      log(`[Subprojects] Database error fetching EPA versions:`, error.message);
      return res.status(500).json({
        error: 'Failed to fetch EPA versions',
        details: error.message
      });
    }

    // Transform data to match frontend expectations
    const transformedVersions = (epaVersions || []).map((version, index) => ({
      ...version, // Spread version first to avoid property conflicts
      version_number: `${index + 1}`,
      epa_version: version.epa_version || `Έκδοση ${index + 1}`,
      formulation_index: version.formulation_id ? parseInt(version.formulation_id.toString()) - 1 : index, // Map formulation_id to 0-based index
    }));

    log(`[Subprojects] Found ${transformedVersions?.length || 0} EPA versions for project ${projectId}`);

    res.json({
      success: true,
      epa_versions: transformedVersions
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Create test EPA budget version for testing purposes
router.post('/projects/:projectId/test-epa-version', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    log(`[Subprojects] Creating test EPA budget version for project ID: ${projectId}`);

    // Create a test EPA budget version using basic columns only
    const { data: newVersion, error } = await supabase
      .from('project_budget_versions')
      .insert({
        project_id: projectId,
        budget_type: 'ΕΠΑ',
        epa_version: 'Έκδοση 1.0 - Αρχική Έγκριση (Test)'
      })
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Database error creating test EPA version:`, error.message);
      return res.status(500).json({
        error: 'Failed to create test EPA version',
        details: error.message
      });
    }

    log(`[Subprojects] Successfully created test EPA version with ID: ${newVersion.id}`);

    res.json({
      success: true,
      epa_version: newVersion
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/subprojects/diagnostic
 * Diagnostic endpoint to check current subproject and EPA version state
 */
router.get('/diagnostic', async (req: AuthenticatedRequest, res: Response) => {
  try {
    log(`[Subprojects] Running diagnostic check`);

    // Get all subprojects with their EPA version linkage
    const { data: subprojects, error: subprojectsError } = await supabase
      .from('Subprojects')
      .select('id, title, epa_version_id, status, created_at');

    if (subprojectsError) {
      return res.status(500).json({ error: 'Failed to fetch subprojects', details: subprojectsError.message });
    }

    // Get all EPA versions
    const { data: epaVersions, error: epaError } = await supabase
      .from('project_budget_versions')
      .select('id, project_id, budget_type, epa_version, formulation_id')
      .eq('budget_type', 'ΕΠΑ');

    if (epaError) {
      return res.status(500).json({ error: 'Failed to fetch EPA versions', details: epaError.message });
    }

    // Analyze the data
    const unlinkedSubprojects = subprojects?.filter(s => s.epa_version_id === null) || [];
    const linkedSubprojects = subprojects?.filter(s => s.epa_version_id !== null) || [];

    res.json({
      success: true,
      diagnostic: {
        total_subprojects: subprojects?.length || 0,
        unlinked_subprojects: unlinkedSubprojects.length,
        linked_subprojects: linkedSubprojects.length,
        total_epa_versions: epaVersions?.length || 0,
        epa_versions: epaVersions || [],
        unlinked_list: unlinkedSubprojects,
        linked_list: linkedSubprojects
      }
    });

  } catch (error) {
    log(`[Subprojects] Diagnostic error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/subprojects/link-to-epa/:subprojectId/:epaVersionId
 * Link an existing subproject to an EPA version
 */
router.post('/link-to-epa/:subprojectId/:epaVersionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subprojectId = parseInt(req.params.subprojectId);
    const epaVersionId = parseInt(req.params.epaVersionId);

    if (isNaN(subprojectId) || isNaN(epaVersionId)) {
      return res.status(400).json({
        error: 'Invalid subproject ID or EPA version ID'
      });
    }

    log(`[Subprojects] Linking subproject ${subprojectId} to EPA version ${epaVersionId}`);

    // Update the subproject to link it to the EPA version
    const { data: updatedSubproject, error } = await supabase
      .from('Subprojects')
      .update({ epa_version_id: epaVersionId })
      .eq('id', subprojectId)
      .select()
      .single();

    if (error) {
      log(`[Subprojects] Error linking subproject:`, error.message);
      return res.status(500).json({
        error: 'Failed to link subproject to EPA version',
        details: error.message
      });
    }

    log(`[Subprojects] Successfully linked subproject ${subprojectId} to EPA version ${epaVersionId}`);

    res.json({
      success: true,
      subproject: updatedSubproject
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export { router as subprojectsRouter };
/**
 * PROJECT-LEVEL SUBPROJECT ROUTES
 * These routes handle subprojects that are linked to projects directly
 */

/**
 * GET /api/projects/:projectId/subprojects
 * Get all subprojects for a specific project
 */
router.get('/:projectId/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    log(`[Subprojects] Fetching subprojects for project ID: ${projectId}`);

    // Get subprojects for this project through EPA versions
    const { data: subprojects, error } = await supabase
      .from('Subprojects')
      .select(`
        id,
        epa_version_id,
        title,
        description,
        status,
        created_at,
        updated_at,
        subproject_financials (
          id,
          year,
          total_public,
          eligible_public,
          created_at,
          updated_at
        ),
        project_budget_versions!inner (
          id,
          project_id,
          budget_type
        )
      `)
      .eq('project_budget_versions.project_id', projectId)
      .eq('project_budget_versions.budget_type', 'ΕΠΑ')
      .order('title');

    if (error) {
      log(`[Subprojects] Error fetching project subprojects:`, error.message);
      return res.status(500).json({
        error: 'Failed to fetch subprojects'
      });
    }

    log(`[Subprojects] Found ${subprojects?.length || 0} subprojects for project ${projectId}`);

    res.json({
      success: true,
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
 * POST /api/projects/:projectId/subprojects
 * Create a new subproject for a project
 */
router.post('/:projectId/subprojects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { title, description, status = 'active', code } = req.body;
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    if (!title) {
      return res.status(400).json({
        error: 'Title is required'
      });
    }

    log(`[Subprojects] Creating new subproject for project ID: ${projectId}`);

    // Find the latest EPA version for this project
    const { data: epaVersion, error: epaError } = await supabase
      .from('project_budget_versions')
      .select('id, epa_version')
      .eq('project_id', projectId)
      .eq('budget_type', 'ΕΠΑ')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (epaError || !epaVersion) {
      return res.status(404).json({
        error: 'No EPA version found for this project. Please create an EPA version first.'
      });
    }

    // Create the subproject
    const { data: subproject, error: subprojectError } = await supabase
      .from('Subprojects')
      .insert({
        epa_version_id: epaVersion.id,
        title,
        description,
        status
      })
      .select()
      .single();

    if (subprojectError) {
      log(`[Subprojects] Project subproject creation error:`, subprojectError.message);
      return res.status(500).json({
        error: 'Failed to create subproject'
      });
    }

    log(`[Subprojects] Successfully created subproject: ${subproject.title} for project ${projectId}`);

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

/**
 * GET /api/subprojects/all
 * Get all subprojects across all projects
 */
router.get('/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    log(`[Subprojects] Fetching all subprojects`);

    // Get subprojects with their EPA versions and projects
    const { data: subprojects, error } = await supabase
      .from('Subprojects')
      .select(`
        id,
        epa_version_id,
        title,
        description,
        status,
        created_at,
        updated_at,
        project_budget_versions!inner (
          id,
          project_id,
          epa_version
        )
      `)
      .order('title');

    if (error) {
      log(`[Subprojects] Error fetching all subprojects:`, error.message);
      return res.status(500).json({
        error: 'Failed to fetch subprojects'
      });
    }

    log(`[Subprojects] Found ${subprojects?.length || 0} total subprojects`);

    res.json({
      success: true,
      subprojects: subprojects || []
    });

  } catch (error) {
    log(`[Subprojects] Unexpected error:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;