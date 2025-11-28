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
    const expenditureType = req.query.expenditure_type as string | undefined;
    
    // Get user unit IDs for access control - admins see all data, others see only their units
    const userUnitIds = req.user.role === 'admin' ? undefined : (req.user.unit_id || undefined);
    
    console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, na853=${na853 || 'all'}, changeType=${changeType || 'all'}, userUnitIds=${userUnitIds?.join(',') || 'admin'}`);

    try {
      // Use the enhanced storage method with pagination and user unit ID filtering
      const result = await storage.getBudgetHistory(na853, page, limit, changeType, userUnitIds, dateFrom, dateTo, creator, expenditureType);
      
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

// Enhanced Budget History Export to XLSX for Managers
// Provides comprehensive analysis with multiple worksheets including regional data
router.get('/history/export', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin or manager
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This operation requires admin or manager privileges.'
      });
    }

    console.log('[Budget] Starting comprehensive budget history export');

    // Parse query parameters for filtering
    const na853 = req.query.na853 as string | undefined;
    const changeType = req.query.change_type as string | undefined;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const creator = req.query.creator as string | undefined;
    const expenditureType = req.query.expenditure_type as string | undefined;

    // Get user unit IDs for access control - admins see all data
    const userUnitIds = req.user.role === 'admin' ? undefined : (req.user.unit_id || undefined);

    // Build the base query to fetch ALL budget history data (no pagination for export)
    let query = supabase
      .from('budget_history')
      .select(`
        id,
        project_id,
        previous_amount,
        new_amount,
        change_type,
        change_reason,
        document_id,
        created_by,
        created_at,
        updated_at,
        Projects!budget_history_project_id_fkey (
          id,
          mis,
          na853,
          project_title,
          status,
          budget_na853,
          budget_na271,
          budget_e069,
          event_year,
          implementing_agency
        ),
        generated_documents!budget_history_document_id_fkey (
          protocol_number_input,
          status,
          amount,
          project_index_id
        )
      `)
      .order('created_at', { ascending: false });

    // Apply unit-based access control for non-admin users
    // SECURITY: Managers can only see budget history for projects in their units
    let restrictedProjectIds: number[] | null = null;
    
    if (userUnitIds && userUnitIds.length > 0) {
      const { data: projectIndexData, error: projectIndexError } = await supabase
        .from('project_index')
        .select('project_id, Projects!inner(mis)')
        .in('monada_id', userUnitIds);
      
      if (projectIndexError) {
        console.error('[Budget] Error fetching project index for access control:', projectIndexError);
        throw projectIndexError;
      }
      
      if (!projectIndexData || projectIndexData.length === 0) {
        // SECURITY: Manager has no projects in their units - return empty export
        console.log('[Budget] Manager has no projects in units, returning empty export');
        
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ 'Μήνυμα': 'Δεν υπάρχουν δεδομένα για τις μονάδες σας' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Κενό');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Istoriko-Proypologismou-${formattedDate}.xlsx"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.end(buffer);
      }
      
      const projectMisIds = projectIndexData
        .map((p: any) => p.Projects?.mis)
        .filter(mis => mis != null)
        .map(mis => parseInt(String(mis)))
        .filter(id => !isNaN(id));
      const allowedMisIds = Array.from(new Set(projectMisIds));
      
      if (allowedMisIds.length === 0) {
        // SECURITY: No valid MIS IDs found - return empty export
        console.log('[Budget] No valid MIS IDs for manager, returning empty export');
        
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ 'Μήνυμα': 'Δεν υπάρχουν δεδομένα για τις μονάδες σας' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Κενό');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Istoriko-Proypologismou-${formattedDate}.xlsx"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.end(buffer);
      }
      
      const { data: allowedProjects } = await supabase
        .from('Projects')
        .select('id')
        .in('mis', allowedMisIds);
      
      if (!allowedProjects || allowedProjects.length === 0) {
        // SECURITY: No projects found - return empty export
        console.log('[Budget] No projects found for manager MIS codes, returning empty export');
        
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ 'Μήνυμα': 'Δεν υπάρχουν δεδομένα για τις μονάδες σας' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Κενό');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Istoriko-Proypologismou-${formattedDate}.xlsx"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.end(buffer);
      }
      
      restrictedProjectIds = allowedProjects.map(p => p.id);
      query = query.in('project_id', restrictedProjectIds);
      console.log(`[Budget] Manager access restricted to ${restrictedProjectIds.length} projects`);
    }

    // Apply filters
    if (na853 && na853 !== 'all') {
      const { data: projectData } = await supabase
        .from('Projects')
        .select('id')
        .eq('na853', na853)
        .single();
      if (projectData) {
        query = query.eq('project_id', projectData.id);
      }
    }

    if (changeType && changeType !== 'all') {
      query = query.eq('change_type', changeType);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59.999Z');
    }

    if (creator && creator !== 'all') {
      const { data: creatorData } = await supabase
        .from('users')
        .select('id')
        .eq('name', creator)
        .single();
      if (creatorData) {
        query = query.eq('created_by', creatorData.id);
      }
    }

    // Fetch budget history data
    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('[Budget] Error fetching budget history for export:', historyError);
      throw historyError;
    }

    // Fetch all project budget data for summaries
    const { data: budgetData, error: budgetError } = await supabase
      .from('project_budget')
      .select('*');

    if (budgetError) {
      console.warn('[Budget] Warning: Could not fetch budget data:', budgetError);
    }

    // Fetch geographic data - regions, regional units, municipalities
    const [regionsRes, regionalUnitsRes, municipalitiesRes] = await Promise.all([
      supabase.from('regions').select('code, name'),
      supabase.from('regional_units').select('code, name, region_code'),
      supabase.from('municipalities').select('code, name, unit_code')
    ]);

    const regions = regionsRes.data || [];
    const regionalUnits = regionalUnitsRes.data || [];
    const municipalities = municipalitiesRes.data || [];

    // Create lookup maps
    const regionMap = new Map(regions.map(r => [r.code, r.name]));
    const unitMap = new Map(regionalUnits.map(u => [u.code, { name: u.name, regionCode: u.region_code }]));
    const muniMap = new Map(municipalities.map(m => [m.code, { name: m.name, unitCode: m.unit_code }]));

    // Fetch project_index data to get geographic associations
    const { data: projectIndexData } = await supabase
      .from('project_index')
      .select(`
        id,
        project_id,
        monada_id,
        expenditure_type_id,
        project_index_regions(region_code),
        project_index_units(unit_code),
        project_index_munis(muni_code)
      `);

    // Create a map of project_id to geographic data
    const projectGeoMap = new Map<number, { regions: string[], units: string[], municipalities: string[] }>();
    
    if (projectIndexData) {
      projectIndexData.forEach((pi: any) => {
        const projectId = pi.project_id;
        if (!projectGeoMap.has(projectId)) {
          projectGeoMap.set(projectId, { regions: [], units: [], municipalities: [] });
        }
        const geo = projectGeoMap.get(projectId)!;

        // Extract region names
        if (pi.project_index_regions) {
          pi.project_index_regions.forEach((r: any) => {
            const regionName = regionMap.get(r.region_code);
            if (regionName && !geo.regions.includes(regionName)) {
              geo.regions.push(regionName);
            }
          });
        }

        // Extract regional unit names
        if (pi.project_index_units) {
          pi.project_index_units.forEach((u: any) => {
            const unit = unitMap.get(u.unit_code);
            if (unit && !geo.units.includes(unit.name)) {
              geo.units.push(unit.name);
            }
          });
        }

        // Extract municipality names
        if (pi.project_index_munis) {
          pi.project_index_munis.forEach((m: any) => {
            const muni = muniMap.get(m.muni_code);
            if (muni && !geo.municipalities.includes(muni.name)) {
              geo.municipalities.push(muni.name);
            }
          });
        }
      });
    }

    // Fetch user data for creator names
    const userIds = Array.from(new Set(historyData?.filter(e => e.created_by).map(e => e.created_by) || []));
    let userMap: Record<number, string> = {};
    
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name')
        .or(userIds.map(id => `id.eq.${id}`).join(','));
      
      if (userData) {
        userMap = userData.reduce((acc, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {} as Record<number, string>);
      }
    }

    // Fetch Monada (unit) data for unit names
    const { data: monadaData } = await supabase.from('Monada').select('id, unit');
    const monadaMap = new Map((monadaData || []).map(m => [m.id, m.unit]));

    // Create budget map for quick lookups
    const budgetMap = new Map((budgetData || []).map(b => [b.mis, b]));

    // Import XLSX library
    const XLSX = await import('xlsx');

    // ============================================
    // WORKSHEET 1: Detailed Budget History
    // ============================================
    const detailedHistory = (historyData || []).map((entry: any) => {
      const project = entry.Projects || {};
      const projectId = project.id;
      const geo = projectGeoMap.get(projectId) || { regions: [], units: [], municipalities: [] };
      const budget = budgetMap.get(project.mis);
      const document = entry.generated_documents;

      const prevAmount = parseFloat(entry.previous_amount) || 0;
      const newAmount = parseFloat(entry.new_amount) || 0;
      const change = newAmount - prevAmount;

      // Get change type in Greek
      const changeTypeLabels: Record<string, string> = {
        'spending': 'Δαπάνη',
        'refund': 'Επιστροφή',
        'document_created': 'Δημιουργία Εγγράφου',
        'import': 'Εισαγωγή',
        'quarter_change': 'Αλλαγή Τριμήνου',
        'year_end_closure': 'Κλείσιμο Έτους',
        'manual_adjustment': 'Χειροκίνητη Προσαρμογή',
        'notification_created': 'Δημιουργία Ειδοποίησης'
      };

      return {
        'Α/Α': entry.id,
        'Ημερομηνία': entry.created_at ? new Date(entry.created_at).toLocaleDateString('el-GR') : '',
        'Ώρα': entry.created_at ? new Date(entry.created_at).toLocaleTimeString('el-GR') : '',
        'MIS': project.mis || '',
        'ΝΑ853': project.na853 || '',
        'Τίτλος Έργου': project.project_title || '',
        'Κατάσταση Έργου': project.status || '',
        'Περιφέρεια': geo.regions.join(', ') || '',
        'Περιφερειακή Ενότητα': geo.units.join(', ') || '',
        'Δήμος': geo.municipalities.join(', ') || '',
        'Τύπος Αλλαγής': changeTypeLabels[entry.change_type] || entry.change_type || '',
        'Προηγούμενο Ποσό': prevAmount,
        'Νέο Ποσό': newAmount,
        'Μεταβολή': change,
        'Αρ. Πρωτοκόλλου': document?.protocol_number_input || '',
        'Κατάσταση Εγγράφου': document?.status || '',
        'Χρήστης': entry.created_by ? (userMap[entry.created_by] || `Χρήστης ${entry.created_by}`) : 'Σύστημα',
        'Αιτία/Σχόλια': entry.change_reason || ''
      };
    });

    // ============================================
    // WORKSHEET 2: Project Summary
    // ============================================
    const projectSummaryMap = new Map<string, {
      mis: string;
      na853: string;
      title: string;
      status: string;
      regions: string[];
      units: string[];
      municipalities: string[];
      totalAllocated: number;
      totalSpent: number;
      available: number;
      changeCount: number;
      spendingCount: number;
      refundCount: number;
      lastChange: string;
    }>();

    (historyData || []).forEach((entry: any) => {
      const project = entry.Projects || {};
      const mis = project.mis?.toString() || '';
      
      if (!mis) return;

      if (!projectSummaryMap.has(mis)) {
        const geo = projectGeoMap.get(project.id) || { regions: [], units: [], municipalities: [] };
        const budget = budgetMap.get(parseInt(mis));
        
        projectSummaryMap.set(mis, {
          mis,
          na853: project.na853 || '',
          title: project.project_title || '',
          status: project.status || '',
          regions: geo.regions,
          units: geo.units,
          municipalities: geo.municipalities,
          totalAllocated: parseFloat(budget?.katanomes_etous || '0'),
          totalSpent: parseFloat(budget?.user_view || '0'),
          available: parseFloat(budget?.katanomes_etous || '0') - parseFloat(budget?.user_view || '0'),
          changeCount: 0,
          spendingCount: 0,
          refundCount: 0,
          lastChange: ''
        });
      }

      const summary = projectSummaryMap.get(mis)!;
      summary.changeCount++;
      
      if (entry.change_type === 'spending' || entry.change_type === 'document_created') {
        summary.spendingCount++;
      } else if (entry.change_type === 'refund') {
        summary.refundCount++;
      }

      if (!summary.lastChange || entry.created_at > summary.lastChange) {
        summary.lastChange = entry.created_at;
      }
    });

    const projectSummary = Array.from(projectSummaryMap.values()).map(p => ({
      'MIS': p.mis,
      'ΝΑ853': p.na853,
      'Τίτλος Έργου': p.title,
      'Κατάσταση': p.status,
      'Περιφέρεια': p.regions.join(', '),
      'Περιφερειακή Ενότητα': p.units.join(', '),
      'Δήμος': p.municipalities.join(', '),
      'Κατανομές Έτους': p.totalAllocated,
      'Συνολικές Δαπάνες': p.totalSpent,
      'Διαθέσιμο': p.available,
      '% Απορρόφησης': p.totalAllocated > 0 ? Math.round((p.totalSpent / p.totalAllocated) * 100) : 0,
      'Πλήθος Αλλαγών': p.changeCount,
      'Πλήθος Δαπανών': p.spendingCount,
      'Πλήθος Επιστροφών': p.refundCount,
      'Τελευταία Αλλαγή': p.lastChange ? new Date(p.lastChange).toLocaleDateString('el-GR') : ''
    }));

    // ============================================
    // WORKSHEET 3: Regional Summary
    // ============================================
    const regionSummaryMap = new Map<string, {
      region: string;
      projectCount: number;
      totalAllocated: number;
      totalSpent: number;
      available: number;
      changeCount: number;
    }>();

    projectSummaryMap.forEach((project) => {
      const regionNames = project.regions.length > 0 ? project.regions : ['Χωρίς Περιφέρεια'];
      
      regionNames.forEach(regionName => {
        if (!regionSummaryMap.has(regionName)) {
          regionSummaryMap.set(regionName, {
            region: regionName,
            projectCount: 0,
            totalAllocated: 0,
            totalSpent: 0,
            available: 0,
            changeCount: 0
          });
        }
        
        const summary = regionSummaryMap.get(regionName)!;
        summary.projectCount++;
        summary.totalAllocated += project.totalAllocated;
        summary.totalSpent += project.totalSpent;
        summary.available += project.available;
        summary.changeCount += project.changeCount;
      });
    });

    const regionalSummary = Array.from(regionSummaryMap.values())
      .sort((a, b) => b.totalAllocated - a.totalAllocated)
      .map(r => ({
        'Περιφέρεια': r.region,
        'Πλήθος Έργων': r.projectCount,
        'Συνολικές Κατανομές': r.totalAllocated,
        'Συνολικές Δαπάνες': r.totalSpent,
        'Διαθέσιμο': r.available,
        '% Απορρόφησης': r.totalAllocated > 0 ? Math.round((r.totalSpent / r.totalAllocated) * 100) : 0,
        'Πλήθος Αλλαγών': r.changeCount
      }));

    // ============================================
    // WORKSHEET 4: Change Type Analysis
    // ============================================
    const changeTypeSummary = new Map<string, {
      type: string;
      typeGreek: string;
      count: number;
      totalAmount: number;
      avgAmount: number;
    }>();

    const changeTypeLabels: Record<string, string> = {
      'spending': 'Δαπάνη',
      'refund': 'Επιστροφή',
      'document_created': 'Δημιουργία Εγγράφου',
      'import': 'Εισαγωγή',
      'quarter_change': 'Αλλαγή Τριμήνου',
      'year_end_closure': 'Κλείσιμο Έτους',
      'manual_adjustment': 'Χειροκίνητη Προσαρμογή',
      'notification_created': 'Δημιουργία Ειδοποίησης'
    };

    (historyData || []).forEach((entry: any) => {
      const type = entry.change_type || 'unknown';
      const change = (parseFloat(entry.new_amount) || 0) - (parseFloat(entry.previous_amount) || 0);
      
      if (!changeTypeSummary.has(type)) {
        changeTypeSummary.set(type, {
          type,
          typeGreek: changeTypeLabels[type] || type,
          count: 0,
          totalAmount: 0,
          avgAmount: 0
        });
      }
      
      const summary = changeTypeSummary.get(type)!;
      summary.count++;
      summary.totalAmount += change;
    });

    const changeTypeAnalysis = Array.from(changeTypeSummary.values())
      .sort((a, b) => b.count - a.count)
      .map(c => ({
        'Τύπος Αλλαγής': c.typeGreek,
        'Πλήθος': c.count,
        'Συνολική Μεταβολή': c.totalAmount,
        'Μέση Μεταβολή': c.count > 0 ? Math.round(c.totalAmount / c.count * 100) / 100 : 0
      }));

    // ============================================
    // WORKSHEET 5: Monthly Trend Analysis
    // ============================================
    const monthlyTrend = new Map<string, {
      month: string;
      year: number;
      monthNum: number;
      count: number;
      totalSpending: number;
      totalRefunds: number;
      netChange: number;
    }>();

    (historyData || []).forEach((entry: any) => {
      if (!entry.created_at) return;
      
      const date = new Date(entry.created_at);
      const year = date.getFullYear();
      const monthNum = date.getMonth();
      const monthNames = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 
                          'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
      const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
      
      if (!monthlyTrend.has(monthKey)) {
        monthlyTrend.set(monthKey, {
          month: monthNames[monthNum],
          year,
          monthNum,
          count: 0,
          totalSpending: 0,
          totalRefunds: 0,
          netChange: 0
        });
      }
      
      const summary = monthlyTrend.get(monthKey)!;
      summary.count++;
      
      const change = (parseFloat(entry.new_amount) || 0) - (parseFloat(entry.previous_amount) || 0);
      summary.netChange += change;
      
      if (entry.change_type === 'spending' || entry.change_type === 'document_created') {
        summary.totalSpending += Math.abs(change);
      } else if (entry.change_type === 'refund') {
        summary.totalRefunds += Math.abs(change);
      }
    });

    const monthlyAnalysis = Array.from(monthlyTrend.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, m]) => ({
        'Μήνας': m.month,
        'Έτος': m.year,
        'Πλήθος Αλλαγών': m.count,
        'Δαπάνες': m.totalSpending,
        'Επιστροφές': m.totalRefunds,
        'Καθαρή Μεταβολή': m.netChange
      }));

    // ============================================
    // WORKSHEET 6: User Activity Summary
    // ============================================
    const userActivityMap = new Map<string, {
      userName: string;
      changeCount: number;
      totalAmount: number;
      spendingCount: number;
      refundCount: number;
      lastActivity: string;
    }>();

    (historyData || []).forEach((entry: any) => {
      const userId = entry.created_by;
      const userName = userId ? (userMap[userId] || `Χρήστης ${userId}`) : 'Σύστημα';
      
      if (!userActivityMap.has(userName)) {
        userActivityMap.set(userName, {
          userName,
          changeCount: 0,
          totalAmount: 0,
          spendingCount: 0,
          refundCount: 0,
          lastActivity: ''
        });
      }
      
      const summary = userActivityMap.get(userName)!;
      summary.changeCount++;
      
      const change = Math.abs((parseFloat(entry.new_amount) || 0) - (parseFloat(entry.previous_amount) || 0));
      summary.totalAmount += change;
      
      if (entry.change_type === 'spending' || entry.change_type === 'document_created') {
        summary.spendingCount++;
      } else if (entry.change_type === 'refund') {
        summary.refundCount++;
      }
      
      if (!summary.lastActivity || entry.created_at > summary.lastActivity) {
        summary.lastActivity = entry.created_at;
      }
    });

    const userActivity = Array.from(userActivityMap.values())
      .sort((a, b) => b.changeCount - a.changeCount)
      .map(u => ({
        'Χρήστης': u.userName,
        'Πλήθος Ενεργειών': u.changeCount,
        'Συνολικό Ποσό': u.totalAmount,
        'Δαπάνες': u.spendingCount,
        'Επιστροφές': u.refundCount,
        'Τελευταία Ενέργεια': u.lastActivity ? new Date(u.lastActivity).toLocaleDateString('el-GR') : ''
      }));

    // ============================================
    // CREATE WORKBOOK
    // ============================================
    const wb = XLSX.utils.book_new();

    // Helper function to apply European number formatting
    const applyEuropeanNumberFormatting = (ws: any, numericColumns: string[]) => {
      for (const cell in ws) {
        if (cell.startsWith('!')) continue;
        
        const cellRef = XLSX.utils.decode_cell(cell);
        const col = XLSX.utils.encode_col(cellRef.c);
        const headerCell = ws[`${col}1`];
        
        if (headerCell && numericColumns.includes(headerCell.v)) {
          if (ws[cell] && typeof ws[cell].v === 'number') {
            ws[cell].z = '#,##0.00';
          }
        }
      }
    };

    // Create and add worksheets
    // 1. Detailed History
    if (detailedHistory.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(detailedHistory);
      ws1['!cols'] = Object.keys(detailedHistory[0]).map(key => ({ wch: key.length < 12 ? 15 : key.length + 5 }));
      applyEuropeanNumberFormatting(ws1, ['Προηγούμενο Ποσό', 'Νέο Ποσό', 'Μεταβολή']);
      XLSX.utils.book_append_sheet(wb, ws1, 'Αναλυτικό Ιστορικό');
    }

    // 2. Project Summary
    if (projectSummary.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(projectSummary);
      ws2['!cols'] = Object.keys(projectSummary[0]).map(key => ({ wch: key.length < 12 ? 15 : key.length + 5 }));
      applyEuropeanNumberFormatting(ws2, ['Κατανομές Έτους', 'Συνολικές Δαπάνες', 'Διαθέσιμο']);
      XLSX.utils.book_append_sheet(wb, ws2, 'Σύνοψη Έργων');
    }

    // 3. Regional Summary
    if (regionalSummary.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(regionalSummary);
      ws3['!cols'] = Object.keys(regionalSummary[0]).map(key => ({ wch: key.length < 12 ? 18 : key.length + 5 }));
      applyEuropeanNumberFormatting(ws3, ['Συνολικές Κατανομές', 'Συνολικές Δαπάνες', 'Διαθέσιμο']);
      XLSX.utils.book_append_sheet(wb, ws3, 'Ανά Περιφέρεια');
    }

    // 4. Change Type Analysis
    if (changeTypeAnalysis.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(changeTypeAnalysis);
      ws4['!cols'] = Object.keys(changeTypeAnalysis[0]).map(() => ({ wch: 20 }));
      applyEuropeanNumberFormatting(ws4, ['Συνολική Μεταβολή', 'Μέση Μεταβολή']);
      XLSX.utils.book_append_sheet(wb, ws4, 'Ανά Τύπο Αλλαγής');
    }

    // 5. Monthly Trend
    if (monthlyAnalysis.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(monthlyAnalysis);
      ws5['!cols'] = Object.keys(monthlyAnalysis[0]).map(() => ({ wch: 18 }));
      applyEuropeanNumberFormatting(ws5, ['Δαπάνες', 'Επιστροφές', 'Καθαρή Μεταβολή']);
      XLSX.utils.book_append_sheet(wb, ws5, 'Μηνιαία Τάση');
    }

    // 6. User Activity
    if (userActivity.length > 0) {
      const ws6 = XLSX.utils.json_to_sheet(userActivity);
      ws6['!cols'] = Object.keys(userActivity[0]).map(() => ({ wch: 18 }));
      applyEuropeanNumberFormatting(ws6, ['Συνολικό Ποσό']);
      XLSX.utils.book_append_sheet(wb, ws6, 'Δραστηριότητα Χρηστών');
    }

    // If no worksheets were added (no data), add an empty message sheet
    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 
        'Μήνυμα': 'Δεν βρέθηκαν δεδομένα με τα επιλεγμένα κριτήρια αναζήτησης' 
      }]);
      ws['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Κενό');
    }

    // Generate buffer and send
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format filename with current date
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    const filename = `Istoriko-Proypologismou-${formattedDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    res.end(buffer);
    console.log(`[Budget] Excel export successful: ${filename} with ${historyData?.length || 0} records`);

  } catch (error) {
    console.error('[Budget] Error generating budget history export:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate budget history export',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;