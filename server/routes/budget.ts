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
      const notifications = await BudgetService.getNotifications();
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

    // If validation requires notification, create it
    if (result.requiresNotification && result.notificationType && req.user?.id) {
      try {
        const budgetData = await storage.getBudgetData(mis);

        await storage.createBudgetHistoryEntry({
          mis,
          change_type: 'notification_created',
          change_date: new Date().toISOString(),
          previous_version: budgetData ? {
            user_view: budgetData.user_view || 0,
            ethsia_pistosi: budgetData.ethsia_pistosi || 0,
            katanomes_etous: budgetData.katanomes_etous || 0,
            na853: budgetData.na853 || ''
          } : null,
          updated_version: budgetData ? {
            user_view: budgetData.user_view || 0,
            ethsia_pistosi: budgetData.ethsia_pistosi || 0,
            katanomes_etous: budgetData.katanomes_etous || 0,
            na853: budgetData.na853 || ''
          } : null,
          changes: {
            reason: `Budget notification created: ${result.notificationType}`,
            notification_type: result.notificationType,
            priority: result.priority,
            requested_amount: requestedAmount
          },
          user_id: req.user.id ? parseInt(req.user.id) : null
        });
      } catch (notifError) {
        console.error('Failed to create budget notification:', notifError);
        // Continue with validation response even if notification creation fails
      }
    }

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
          userId: req.user?.id?.toString(),
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
          sessionId: null, // Send to ALL clients including the sender
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
    const mis = req.query.mis as string | undefined;
    const changeType = req.query.change_type as string | undefined;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const creator = req.query.creator as string | undefined;
    
    // Get user unit IDs for access control - admins see all data, others see only their units
    const userUnitIds = req.user.role === 'admin' ? undefined : (req.user.unit_id || undefined);
    
    console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, mis=${mis || 'all'}, changeType=${changeType || 'all'}, userUnitIds=${userUnitIds?.join(',') || 'admin'}`);

    try {
      // Use the enhanced storage method with pagination and user unit ID filtering
      const result = await storage.getBudgetHistory(mis, page, limit, changeType, userUnitIds, dateFrom, dateTo, creator);
      
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
          ?.map(item => item.Projects?.mis)
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

export default router;