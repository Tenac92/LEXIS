import { Router, Request, Response } from 'express';
import { authenticateSession } from '../authentication';
import { BudgetService } from '../services/budgetService';
import { storage } from '../storage';
import { supabase } from '../config/db';
import { User } from '@shared/schema';
import { broadcastBudgetUpdate } from '../websocket';

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = Router();

// Get budget notifications - always handle this route first
router.get('/notifications', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json([]);  // Return empty array even for auth errors
    }

    console.log('[BudgetController] Fetching notifications...');

    try {
      // For now, return empty notifications array - implement getNotifications later if needed
      const notifications: any[] = [];
      console.log('[BudgetController] Successfully fetched notifications:', notifications.length);

      // Return the array directly without wrapping
      res.json(notifications);
    } catch (error) {
      console.error('[BudgetController] Error fetching notifications:', error);
      res.json([]); // Return empty array on error
    }
  } catch (error) {
    console.error('[BudgetController] Error in notifications route:', error);
    res.json([]); // Return empty array on error
  }
});

// Manual budget adjustment endpoint for administrators
router.post('/adjust', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin or manager
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin or manager privileges.'
      });
    }

    const { project_id, amount, reason, type = 'manual_adjustment' } = req.body;

    if (!project_id || !amount || !reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: project_id, amount, and reason are required'
      });
    }

    console.log(`[Budget] Admin ${req.user.id} manually adjusting budget for project ${project_id}: ${amount}`);

    // Update budget and create history entry
    await storage.updateProjectBudgetSpending(
      parseInt(project_id),
      parseFloat(amount),
      0, // No document ID for manual adjustments
      req.user.id
    );

    // Broadcast budget update to all connected clients
    try {
      const wss = (req as any).app?.get('wss');
      if (wss) {
        broadcastBudgetUpdate(wss, {
          mis: String(project_id),
          amount: amount,
          userId: String(req.user.id),
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.warn('[Budget] WebSocket broadcast failed:', wsError);
    }

    console.log(`[Budget] Successfully processed manual budget adjustment for project ${project_id}`);

    return res.json({
      status: 'success',
      message: 'Budget adjustment completed successfully',
      data: {
        project_id,
        amount,
        reason,
        adjusted_by: req.user.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Budget] Error processing manual budget adjustment:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process budget adjustment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Budget data routes - with explicit paths
router.get('/data/:mis', async (req: Request, res: Response) => {
  try {
    const { mis } = req.params;
    if (!mis) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS parameter is required'
      });
    }

    const result = await BudgetService.getBudget(mis);
    return res.json(result);
  } catch (error) {
    console.error('[BudgetController] Error fetching budget:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validate budget for document

router.post('/validate', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, amount, sessionId } = req.body;
    const requestedAmount = parseFloat(amount.toString());

    const result = await BudgetService.validateBudget(mis, requestedAmount);

    // Skip notification creation for now - can be implemented later if needed
    console.log('[BudgetController] Budget validation completed for MIS:', mis, 'Amount:', requestedAmount);

    // Get the application-wide WebSocket server
    const wss = req.app.get('wss');
    
    // If we have a WebSocket server, broadcast the budget update
    if (wss) {
      try {
        // Broadcast the budget update to all connected clients
        // They will update their UI in real-time to show the current requested amount
        broadcastBudgetUpdate(wss, {
          mis,
          amount: requestedAmount,
          timestamp: new Date().toISOString(),
          userId: req.user?.id ? req.user.id.toString() : undefined,
          sessionId // Client session ID to filter out self-updates
        });
        console.log(`[Budget] Broadcast budget update for MIS ${mis} with amount ${requestedAmount}`);
      } catch (broadcastError) {
        console.error('[Budget] Failed to broadcast budget update:', broadcastError);
        // Continue with validation response even if broadcast fails
      }
    }

    return res.json(result);
  } catch (error) {
    console.error("Budget validation error:", error);
    return res.status(500).json({ 
      status: 'error',
      canCreate: true, // Still allow creation even on error
      message: "Failed to validate budget",
      allowDocx: true
    });
  }
});

// Endpoint for broadcasting real-time updates during amount changes
// No authentication required for this lightweight endpoint to enable real-time typing updates
router.post('/broadcast-update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, amount, sessionId, simpleBudgetData } = req.body;
    const requestedAmount = parseFloat(amount.toString());

    if (!mis) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS parameter is required'
      });
    }

    if (isNaN(requestedAmount)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid amount is required'
      });
    }

    // Get the application-wide WebSocket server
    const wss = req.app.get('wss');
    
    // If we have a WebSocket server, broadcast the budget update
    if (wss) {
      try {
        // IMPROVEMENT: Now using the simplified budget data as requested by the user
        // This broadcasts a direct subtracted value to all clients for real-time updates
        // We're also broadcast to ALL clients by setting sessionId to null
        
        // Log what we're broadcasting
        console.log(`[Budget] Broadcasting real-time update with simplified budget data:`, {
          mis,
          amount: requestedAmount,
          simpleBudgetData
        });
        
        // Broadcast the update to all connected clients without validation and without filtering by sessionId
        broadcastBudgetUpdate(wss, {
          mis,
          amount: requestedAmount,
          timestamp: new Date().toISOString(),
          userId: req.user?.id?.toString(),
          sessionId: undefined, // Send to ALL clients including the sender
          // Add the simple budget calculation data
          simpleBudgetData
        });
        
        console.log(`[Budget] Broadcast real-time update for MIS ${mis} with amount ${requestedAmount}`);
      } catch (broadcastError) {
        console.error('[Budget] Failed to broadcast real-time update:', broadcastError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to broadcast update'
        });
      }
    }

    // Return a simple success response
    return res.json({
      status: 'success',
      message: 'Update broadcasted successfully'
    });
  } catch (error) {
    console.error("[Budget] Error broadcasting update:", error);
    return res.status(500).json({ 
      status: 'error',
      message: "Failed to broadcast update",
    });
  }
});

// Get available MIS and NA853 combinations
router.get('/records', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Budget] Fetching available MIS and NA853 combinations');

    const { data, error } = await supabase
      .from('project_budget')
      .select('mis, na853')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Budget] Error fetching records:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Failed to fetch budget records',
        details: error.message
      });
    }

    if (!data) {
      return res.json([]);
    }

    console.log(`[Budget] Successfully fetched ${data.length} records`);
    return res.json({
      status: 'success',
      data: data.map(record => ({
        mis: record.mis,
        na853: record.na853
      }))
    });

  } catch (error) {
    console.error('[Budget] Unexpected error:', error);
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch budget records',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get budget history with pagination and proper user unit filtering
router.get('/history', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Budget] Handling budget history request');
    
    // Check authentication
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });
    }
    
    console.log(`[Budget] User ${req.user.id} with role ${req.user.role} accessing budget history`);

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const na853 = req.query.na853 as string | undefined;
    const changeType = req.query.change_type as string | undefined;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const creator = req.query.creator as string | undefined;
    
    // Get user unit IDs for access control - admins see all data, others see only their units
    const userUnitIds = req.user.role === 'admin' ? undefined : (req.user.unit_id || undefined);
    
    console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, na853=${na853 || 'all'}, changeType=${changeType || 'all'}, userUnitIds=${userUnitIds?.join(',') || 'admin'}`);

    try {
      // Use the enhanced storage method with pagination and user unit ID filtering
      const result = await storage.getBudgetHistory(na853, page, limit, changeType, userUnitIds, dateFrom, dateTo, creator);
      
      console.log(`[Budget] Successfully fetched ${result.data.length} of ${result.pagination.total} history records`);

      return res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
        statistics: result.statistics
      });
    } catch (storageError) {
      console.error('[Budget] Error from storage.getBudgetHistory:', storageError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch budget history',
        details: storageError instanceof Error ? storageError.message : 'Storage error',
        data: [],
        pagination: { total: 0, page, limit, pages: 0 }
      });
    }
  } catch (error) {
    console.error('[Budget] History fetch error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget history',
      details: error instanceof Error ? error.message : 'Unknown error',
      data: [],
      pagination: { total: 0, page: 1, limit: 10, pages: 0 }
    });
  }
});

// Budget Overview endpoint - provides aggregated budget data filtered by user's unit access
router.get('/overview', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Budget] Fetching budget overview');
    
    // Check authentication
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    console.log(`[Budget] User ${req.user.id} with role ${req.user.role} requesting budget overview`);

    // For admins, show all budget data
    // For managers and users, filter by their unit's accessible MIS codes
    let budgetQuery = supabase.from('project_budget').select('*');
    
    if (req.user.role !== 'admin' && req.user.unit_id && req.user.unit_id.length > 0) {
      // Get MIS codes accessible to user's units
      const { data: allowedMis, error: misError } = await supabase
        .from('project_index')
        .select('Projects!inner(mis)')
        .in('monada_id', req.user.unit_id);
        
      if (misError) {
        console.error('[Budget] Error fetching allowed MIS codes:', misError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to determine accessible projects'
        });
      }
      
      // Extract unique MIS codes
      const misCodes = Array.from(new Set(
        allowedMis
          ?.map((item: any) => item.Projects?.mis)
          .filter(mis => mis !== null && mis !== undefined) || []
      ));
      
      console.log(`[Budget] User unit ${req.user.unit_id[0]} has access to ${misCodes.length} MIS codes`);
      
      if (misCodes.length > 0) {
        budgetQuery = budgetQuery.in('mis', misCodes);
      } else {
        // No accessible projects - return empty overview
        return res.json({
          status: 'success',
          data: {
            totalBudget: 0,
            allocatedBudget: 0,
            availableBudget: 0,
            projectCount: 0,
            quarterlyBreakdown: { q1: 0, q2: 0, q3: 0, q4: 0 },
            recentUpdates: []
          }
        });
      }
    }
    
    const { data: budgetData, error: budgetError } = await budgetQuery
      .order('created_at', { ascending: false });
      
    if (budgetError) {
      console.error('[Budget] Error fetching budget data:', budgetError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch budget data'
      });
    }

    // Calculate overview metrics
    let totalBudget = 0;
    let allocatedBudget = 0;
    let quarterlyBreakdown = { q1: 0, q2: 0, q3: 0, q4: 0 };
    
    budgetData?.forEach(budget => {
      const ethsiaPistosi = parseFloat(budget.ethsia_pistosi?.toString() || '0');
      const katanomesEtous = parseFloat(budget.katanomes_etous?.toString() || '0');
      const q1 = parseFloat(budget.q1?.toString() || '0');
      const q2 = parseFloat(budget.q2?.toString() || '0');
      const q3 = parseFloat(budget.q3?.toString() || '0');
      const q4 = parseFloat(budget.q4?.toString() || '0');
      
      totalBudget += ethsiaPistosi;
      allocatedBudget += katanomesEtous;
      quarterlyBreakdown.q1 += q1;
      quarterlyBreakdown.q2 += q2;
      quarterlyBreakdown.q3 += q3;
      quarterlyBreakdown.q4 += q4;
    });
    
    const availableBudget = totalBudget - allocatedBudget;
    const projectCount = budgetData?.length || 0;

    console.log(`[Budget] Overview calculated: ${projectCount} projects, ${totalBudget}€ total, ${allocatedBudget}€ allocated`);

    return res.json({
      status: 'success',
      data: {
        totalBudget,
        allocatedBudget,
        availableBudget,
        projectCount,
        quarterlyBreakdown,
        recentUpdates: [] // Can be enhanced later with budget history
      }
    });
    
  } catch (error) {
    console.error('[Budget] Error in overview endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget overview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route to analyze changes between budget updates (for admins only)
router.get('/:mis/analyze-changes', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin privileges.'
      });
    }

    const { mis } = req.params;
    if (!mis) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS parameter is required'
      });
    }

    console.log('[Budget] Analyzing changes between updates for MIS:', mis);
    
    const analysis = await BudgetService.analyzeChangesBetweenUpdates(mis);
    
    return res.json(analysis);
  } catch (error) {
    console.error('[Budget] Error analyzing budget changes:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to analyze budget changes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get budget trends for monitoring dashboard (admin only)
router.get('/trends', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin privileges.'
      });
    }

    console.log('[Budget] Fetching budget trends for monitoring dashboard');

    // Get budget history with aggregated data by month
    const { data: budgetHistory, error: historyError } = await supabase
      .from('budget_history')
      .select(`
        *,
        Projects(title, mis, na853)
      `)
      .order('change_date', { ascending: false })
      .limit(500);

    if (historyError) {
      console.error('[Budget] Error fetching budget history:', historyError);
      throw historyError;
    }

    // Get current budget data for all projects
    const { data: currentBudgets, error: budgetError } = await supabase
      .from('project_budget')
      .select(`
        *,
        Projects(title, mis, na853, status)
      `);

    if (budgetError) {
      console.error('[Budget] Error fetching current budgets:', budgetError);
      throw budgetError;
    }

    // Process data for trends
    const monthlyData = new Map();
    const currentDate = new Date();
    
    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('el-GR', { year: 'numeric', month: 'short' });
      
      monthlyData.set(monthKey, {
        month: monthKey,
        allocated: 0,
        spent: 0,
        remaining: 0,
        projects_active: 0
      });
    }

    // Aggregate current budget data
    let totalAllocated = 0;
    let totalSpent = 0;
    let activeProjects = 0;

    currentBudgets?.forEach(budget => {
      const allocated = parseFloat(budget.katanomes_etous || '0');
      const spent = parseFloat(budget.user_view || '0');
      
      totalAllocated += allocated;
      totalSpent += spent;
      
      if (budget.Projects?.status === 'active' || !budget.Projects?.status) {
        activeProjects++;
      }
    });

    // Set current month data
    const currentMonth = currentDate.toLocaleDateString('el-GR', { year: 'numeric', month: 'short' });
    if (monthlyData.has(currentMonth)) {
      monthlyData.set(currentMonth, {
        month: currentMonth,
        allocated: totalAllocated,
        spent: totalSpent,
        remaining: totalAllocated - totalSpent,
        projects_active: activeProjects
      });
    }

    return res.json({
      status: 'success',
      data: {
        trends: Array.from(monthlyData.values()),
        summary: {
          total_allocated: totalAllocated,
          total_spent: totalSpent,
          total_remaining: totalAllocated - totalSpent,
          active_projects: activeProjects,
          utilization_rate: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0
        }
      }
    });

  } catch (error) {
    console.error('[Budget] Error in trends endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget trends',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project performance metrics (admin only)
router.get('/project-performance', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin privileges.'
      });
    }

    console.log('[Budget] Fetching project performance metrics');

    // Get projects with budget data and document counts
    const { data: projectData, error } = await supabase
      .from('Projects')
      .select(`
        id, title, mis, na853, status,
        project_budget(katanomes_etous, ethsia_pistosi, user_view, q1, q2, q3, q4),
        generated_documents(id)
      `);

    if (error) {
      console.error('[Budget] Error fetching project performance:', error);
      throw error;
    }

    // Process performance metrics
    const performance = projectData?.map(project => {
      const budget = project.project_budget?.[0];
      const allocated = parseFloat(budget?.katanomes_etous || '0');
      const spent = parseFloat(budget?.user_view || '0');
      const ethsia = parseFloat(budget?.ethsia_pistosi || '0');
      const documentCount = project.generated_documents?.length || 0;
      
      const utilizationRate = allocated > 0 ? (spent / allocated) * 100 : 0;
      const variance = spent - allocated;
      
      // Calculate completion rate based on document activity and spending
      const completionRate = Math.min(
        utilizationRate + (documentCount * 5), // Factor in document activity
        100
      );

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (utilizationRate > 105) status = 'critical';
      else if (utilizationRate > 95 || utilizationRate < 20) status = 'warning';

      // Determine trend (simplified)
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (utilizationRate > 80) trend = 'up';
      else if (utilizationRate < 30) trend = 'down';

      return {
        mis: project.na853 || project.mis || project.id?.toString(),
        name: project.title || `Έργο ${project.mis}`,
        allocated_budget: allocated,
        spent_budget: spent,
        utilization_rate: Math.round(utilizationRate),
        completion_rate: Math.round(completionRate),
        variance: variance,
        status,
        trend
      };
    }).slice(0, 20) || []; // Limit to top 20 projects

    return res.json({
      status: 'success',
      data: performance
    });

  } catch (error) {
    console.error('[Budget] Error in project-performance endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch project performance',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get quarterly analysis (admin only)
router.get('/quarterly-analysis', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin privileges.'
      });
    }

    console.log('[Budget] Fetching quarterly analysis');

    // Get budget data with quarterly breakdown
    const { data: budgetData, error } = await supabase
      .from('project_budget')
      .select(`
        *,
        Projects(title, status)
      `);

    if (error) {
      console.error('[Budget] Error fetching quarterly data:', error);
      throw error;
    }

    // Calculate quarterly metrics
    const currentYear = new Date().getFullYear();
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
      let totalAllocated = 0;
      let totalSpent = 0;
      let projectCount = 0;
      let completedProjects = 0;

      budgetData?.forEach(budget => {
        const quarterField = `q${index + 1}` as keyof typeof budget;
        const quarterBudget = parseFloat(budget[quarterField]?.toString() || '0');
        const projectSpent = parseFloat(budget.user_view?.toString() || '0');
        
        totalAllocated += quarterBudget;
        totalSpent += Math.min(projectSpent, quarterBudget); // Cap spending at quarter allocation
        projectCount++;
        
        if (budget.Projects?.status === 'completed') {
          completedProjects++;
        }
      });

      const efficiencyScore = totalAllocated > 0 ? 
        Math.round(((totalSpent / totalAllocated) * 100) * 0.7 + (completedProjects / projectCount) * 100 * 0.3) : 0;
      
      const completionRate = projectCount > 0 ? Math.round((completedProjects / projectCount) * 100) : 0;

      return {
        quarter: `${quarter} ${currentYear}`,
        total_allocated: totalAllocated,
        total_spent: totalSpent,
        efficiency_score: Math.min(efficiencyScore, 100),
        project_count: projectCount,
        completion_rate: completionRate
      };
    });

    return res.json({
      status: 'success',
      data: quarters
    });

  } catch (error) {
    console.error('[Budget] Error in quarterly-analysis endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch quarterly analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;