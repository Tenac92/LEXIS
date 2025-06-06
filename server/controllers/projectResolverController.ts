/**
 * Project Resolver Controller
 * Handles API endpoints for project resolution by any identifier
 */

import { Router } from 'express';
import { resolveProject, getProjectId, getProjectNA853 } from '../utils/projectResolver';
import { authenticateSession, AuthenticatedRequest } from '../authentication';

const router = Router();

/**
 * Resolve project by any identifier (id, mis, na853)
 * GET /api/projects/resolve/:identifier
 */
router.get('/resolve/:identifier', async (req: AuthenticatedRequest, res) => {
  try {
    const { identifier } = req.params;
    
    if (!identifier) {
      return res.status(400).json({ 
        error: 'Project identifier is required' 
      });
    }

    const project = await resolveProject(identifier);
    
    if (!project) {
      return res.status(404).json({ 
        error: `Project not found for identifier: ${identifier}` 
      });
    }

    res.json(project);
  } catch (error) {
    console.error('[ProjectResolver] Error resolving project:', error);
    res.status(500).json({ 
      error: 'Failed to resolve project' 
    });
  }
});

/**
 * Get project ID by any identifier
 * GET /api/projects/id/:identifier
 */
router.get('/id/:identifier', async (req: AuthenticatedRequest, res) => {
  try {
    const { identifier } = req.params;
    
    if (!identifier) {
      return res.status(400).json({ 
        error: 'Project identifier is required' 
      });
    }

    const projectId = await getProjectId(identifier);
    
    if (!projectId) {
      return res.status(404).json({ 
        error: `Project not found for identifier: ${identifier}` 
      });
    }

    res.json({ id: projectId });
  } catch (error) {
    console.error('[ProjectResolver] Error getting project ID:', error);
    res.status(500).json({ 
      error: 'Failed to get project ID' 
    });
  }
});

/**
 * Get project NA853 by any identifier
 * GET /api/projects/na853/:identifier
 */
router.get('/na853/:identifier', async (req: AuthenticatedRequest, res) => {
  try {
    const { identifier } = req.params;
    
    if (!identifier) {
      return res.status(400).json({ 
        error: 'Project identifier is required' 
      });
    }

    const na853 = await getProjectNA853(identifier);
    
    if (!na853) {
      return res.status(404).json({ 
        error: `Project not found for identifier: ${identifier}` 
      });
    }

    res.json({ na853 });
  } catch (error) {
    console.error('[ProjectResolver] Error getting project NA853:', error);
    res.status(500).json({ 
      error: 'Failed to get project NA853' 
    });
  }
});

/**
 * Batch resolve multiple project identifiers
 * POST /api/projects/batch-resolve
 * Body: { identifiers: string[] }
 */
router.post('/batch-resolve', authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    const { identifiers } = req.body;
    
    if (!Array.isArray(identifiers)) {
      return res.status(400).json({ 
        error: 'Identifiers must be an array' 
      });
    }

    const results: { [key: string]: any } = {};
    
    // Process in batches to avoid overwhelming the database
    for (const identifier of identifiers) {
      const project = await resolveProject(identifier);
      results[identifier] = project;
    }

    res.json(results);
  } catch (error) {
    console.error('[ProjectResolver] Error batch resolving projects:', error);
    res.status(500).json({ 
      error: 'Failed to batch resolve projects' 
    });
  }
});

export default router;