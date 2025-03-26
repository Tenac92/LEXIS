import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { BudgetService } from '../services/budgetService';
import { storage } from '../storage';
import { supabase } from '../config/db';
import { User } from '@shared/schema';

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = Router();

// Get budget notifications - always handle this route first
router.get('/notifications', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/data/:mis([0-9]+)', async (req, res) => {
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
router.post('/validate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, amount } = req.body;
    const requestedAmount = parseFloat(amount.toString());

    const result = await BudgetService.validateBudget(mis, requestedAmount);

    // If validation requires notification, create it
    if (result.requiresNotification && result.notificationType && req.user?.id) {
      try {
        const budgetData = await storage.getBudgetData(mis);

        await storage.createBudgetHistoryEntry({
          mis,
          change_type: 'notification_created',
          change_reason: `Budget notification created: ${result.notificationType}`,
          created_by: req.user.id,
          created_at: new Date().toISOString(),
          metadata: {
            notification_type: result.notificationType,
            priority: result.priority,
            current_budget: budgetData?.user_view,
            requested_amount: requestedAmount
          }
        });
      } catch (notifError) {
        console.error('Failed to create budget notification:', notifError);
        // Continue with validation response even if notification creation fails
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

// Get available MIS and NA853 combinations
router.get('/records', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Fetching available MIS and NA853 combinations');

    const { data, error } = await supabase
      .from('budget_na853_split')
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

// Get budget history with pagination
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Budget] Fetching budget history');
    
    // Check authentication
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });
    }
    
    // Only admin and manager roles can access budget history
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      console.log(`[Budget] Unauthorized access attempt by user ${req.user.id} with role ${req.user.role}`);
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions to access budget history',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const mis = req.query.mis as string | undefined;
    const changeType = req.query.change_type as string | undefined;

    console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, mis=${mis || 'all'}, changeType=${changeType || 'all'}`);

    // Build query filter
    let queryFilter = supabase.from('budget_history');
    
    // Filter by MIS if provided
    if (mis) {
      queryFilter = queryFilter.eq('mis', mis);
    }
    
    // Filter by change type if provided
    if (changeType && changeType !== 'all') {
      queryFilter = queryFilter.eq('change_type', changeType);
    }
    
    // Get total count for pagination
    const { count } = await queryFilter.select('*', { count: 'exact', head: true });

    // Get paginated data with joins for user information
    const { data, error } = await queryFilter
      .select(`
        id,
        mis,
        previous_amount,
        new_amount,
        change_type,
        change_reason,
        document_id,
        created_by,
        created_at,
        metadata,
        users(id, name, email),
        generated_documents(id, status)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Budget] Error fetching history:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch budget history',
        details: error.message,
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });
    }

    // Format the response data
    const formattedData = data?.map(entry => ({
      id: entry.id,
      mis: entry.mis,
      previous_amount: entry.previous_amount || '0',
      new_amount: entry.new_amount || '0',
      change_type: entry.change_type,
      change_reason: entry.change_reason || '',
      document_id: entry.document_id,
      document_status: entry.generated_documents?.[0]?.status,
      created_by: entry.users?.name || 'System',
      created_at: entry.created_at,
      metadata: entry.metadata || {}
    })) || [];
    
    console.log(`[Budget] Successfully fetched ${formattedData.length} history records`);

    return res.json({
      status: 'success',
      data: formattedData,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('[Budget] History fetch error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/bulk-update', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Starting bulk update for budget_na853_split');

    // Check authentication
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { updates } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    // Process each update sequentially
    for (const update of updates) {
      const { mis, na853, data } = update;

      if (!mis || !na853) {
        throw new Error(`Invalid update data: missing mis or na853`);
      }

      // Get current budget data before updating
      const { data: currentBudget, error: fetchError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', mis)
        .eq('na853', na853)
        .single();

      if (fetchError || !currentBudget) {
        throw new Error(`Budget split record not found for MIS ${mis} and NA853 ${na853}`);
      }

      // Update the budget split record
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update({
          ethsia_pistosi: data.ethsia_pistosi,
          q1: data.q1,
          q2: data.q2,
          q3: data.q3,
          q4: data.q4,
          katanomes_etous: data.katanomes_etous,
          user_view: data.user_view,
          updated_at: new Date().toISOString()
        })
        .eq('mis', mis)
        .eq('na853', na853);

      if (updateError) {
        throw new Error(`Failed to update budget split for MIS ${mis}: ${updateError.message}`);
      }

      // Log the change in budget history
      await supabase
        .from('budget_history')
        .insert({
          mis,
          previous_amount: currentBudget.user_view?.toString() || '0',
          new_amount: data.user_view?.toString() || '0',
          change_type: 'manual_adjustment',
          change_reason: 'Bulk update of budget data',
          created_by: userId,
          metadata: {
            previous: {
              ethsia_pistosi: currentBudget.ethsia_pistosi,
              q1: currentBudget.q1,
              q2: currentBudget.q2,
              q3: currentBudget.q3,
              q4: currentBudget.q4,
              katanomes_etous: currentBudget.katanomes_etous,
              user_view: currentBudget.user_view
            },
            new: {
              ethsia_pistosi: data.ethsia_pistosi,
              q1: data.q1,
              q2: data.q2,
              q3: data.q3,
              q4: data.q4,
              katanomes_etous: data.katanomes_etous,
              user_view: data.user_view
            },
            na853
          }
        });

      console.log(`[Budget] Successfully updated budget split for MIS ${mis} and tracked in history`);
    }

    res.json({ 
      success: true, 
      message: `Successfully updated ${updates.length} budget splits and tracked changes in history` 
    });
  } catch (error) {
    console.error('[Budget] Bulk update error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to process bulk update' 
    });
  }
});

export default router;