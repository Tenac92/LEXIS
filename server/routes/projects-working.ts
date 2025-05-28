import { Router } from 'express';
import { supabase } from '../drizzle';
import { AuthenticatedRequest, authenticateSession } from '../authentication';

const router = Router();

// WORKING PROJECT ENDPOINT - completely bypasses all JSONB issues
router.get('/api/projects-working/:unitName', authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    let { unitName } = req.params;
    
    // Decode URL-encoded Greek characters
    try {
      unitName = decodeURIComponent(unitName);
    } catch (decodeError) {
      console.log(`[ProjectsWorking] URL decode failed, using original: ${unitName}`);
    }
    
    console.log(`[ProjectsWorking] Fetching authentic projects for unit: ${unitName}`);
    
    // Get authentic project data safely without any JSONB operations
    const { data: allProjects, error: queryError } = await supabase
      .from('Projects')
      .select('id, mis, na853, title, budget_na853, implementing_agency, status')
      .limit(1000);
      
    if (queryError) {
      console.error(`[ProjectsWorking] Query failed:`, queryError);
      return res.status(500).json({
        message: 'Database query failed',
        error: queryError.message
      });
    }
    
    console.log(`[ProjectsWorking] Retrieved ${allProjects?.length || 0} authentic projects from database`);
    
    // Filter projects using authentic data for your specific unit
    const filteredProjects = allProjects?.filter(project => {
      const agency = project.implementing_agency;
      try {
        if (Array.isArray(agency)) {
          return agency.some(a => String(a).includes(unitName));
        }
        if (typeof agency === 'string') {
          return agency.includes(unitName);
        }
        if (agency && typeof agency === 'object') {
          const agencyStr = JSON.stringify(agency);
          return agencyStr.includes(unitName);
        }
      } catch (filterError) {
        console.log(`[ProjectsWorking] Filter error for project ${project.id}:`, filterError);
      }
      return false;
    }) || [];
    
    console.log(`[ProjectsWorking] SUCCESS: Found ${filteredProjects.length} authentic projects for unit ${unitName}`);
    
    return res.json(filteredProjects);
  } catch (error) {
    console.error('[ProjectsWorking] Critical error:', error);
    res.status(500).json({
      message: 'Critical server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;