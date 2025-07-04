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

// Get budget history with pagination
router.get('/history', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
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
    
    // Temporarily allow all authenticated users to access budget history
    console.log(`[Budget] User ${req.user.id} with role ${req.user.role} accessing budget history`);
    
    // Original role check (commented out for debugging)
    /*
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      console.log(`[Budget] Unauthorized access attempt by user ${req.user.id} with role ${req.user.role}`);
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions to access budget history',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });
    }
    */

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const mis = req.query.mis as string | undefined;
    const changeType = req.query.change_type as string | undefined;

    console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, mis=${mis || 'all'}, changeType=${changeType || 'all'}`);

    try {
      // Use the enhanced storage method with pagination
      const result = await storage.getBudgetHistory(mis, page, limit, changeType);
      
      console.log(`[Budget] Successfully fetched ${result.data.length} of ${result.pagination.total} history records`);

      return res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination
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

router.put('/bulk-update', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Budget] Starting bulk update for project_budget');

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

    // Track success and failure counts
    const results = {
      success: 0,
      failures: 0,
      errors: [] as string[]
    };

    // Process each update sequentially
    for (const update of updates) {
      try {
        const { mis, na853, data } = update;

        if (!mis || !na853) {
          throw new Error(`Invalid update data: missing mis or na853`);
        }

        // Get current budget data before updating
        const { data: currentBudget, error: fetchError } = await supabase
          .from('project_budget')
          .select('*')
          .eq('mis', mis)
          .eq('na853', na853)
          .single();

        if (fetchError || !currentBudget) {
          throw new Error(`Budget split record not found for MIS ${mis} and NA853 ${na853}`);
        }

        // Calculate the difference between current and new values
        // Note: If this is not a budget reduction but rather a budget update that might increase,
        // you may need to modify the approach
        const currentUserView = parseFloat(currentBudget.user_view?.toString() || '0');
        const newUserView = parseFloat(data.user_view?.toString() || '0');
        
        // Create a detailed change reason for traceability
        const changeReason = `Bulk update of budget data for MIS ${mis} (NA853: ${na853})`;
        
        // Update the budget split record directly
        const { error: updateError } = await supabase
          .from('project_budget')
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

        // Create a budget history entry with detailed metadata using the new schema
        await storage.createBudgetHistoryEntry({
          mis,
          change_type: 'manual_adjustment',
          change_date: new Date().toISOString(),
          previous_version: {
            ethsia_pistosi: currentBudget.ethsia_pistosi || 0,
            q1: currentBudget.q1 || 0,
            q2: currentBudget.q2 || 0,
            q3: currentBudget.q3 || 0,
            q4: currentBudget.q4 || 0,
            katanomes_etous: currentBudget.katanomes_etous || 0,
            user_view: currentBudget.user_view || 0,
            na853: na853,
            total_spent: currentBudget.total_spent || 0
          },
          updated_version: {
            ethsia_pistosi: data.ethsia_pistosi || 0,
            q1: data.q1 || 0,
            q2: data.q2 || 0,
            q3: data.q3 || 0,
            q4: data.q4 || 0,
            katanomes_etous: data.katanomes_etous || 0,
            user_view: data.user_view || 0,
            na853: na853,
            total_spent: currentBudget.total_spent || 0 // Total spent remains unchanged
          },
          changes: {
            reason: changeReason,
            operation_type: 'bulk_update',
            quarters_delta: {
              q1: parseFloat(data.q1?.toString() || '0') - parseFloat(currentBudget.q1?.toString() || '0'),
              q2: parseFloat(data.q2?.toString() || '0') - parseFloat(currentBudget.q2?.toString() || '0'),
              q3: parseFloat(data.q3?.toString() || '0') - parseFloat(currentBudget.q3?.toString() || '0'),
              q4: parseFloat(data.q4?.toString() || '0') - parseFloat(currentBudget.q4?.toString() || '0')
            },
            user_view_delta: parseFloat(data.user_view?.toString() || '0') - parseFloat(currentBudget.user_view?.toString() || '0')
          },
          user_id: parseInt(userId)
        });

        console.log(`[Budget] Successfully updated budget split for MIS ${mis} and tracked in history`);
        results.success++;
      } catch (updateError) {
        // Log the error but continue with other updates
        console.error(`[Budget] Error updating budget: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
        results.failures++;
        results.errors.push(updateError instanceof Error ? updateError.message : 'Unknown error');
      }
    }

    // Return summary of results
    if (results.failures === 0) {
      res.json({ 
        success: true, 
        message: `Successfully updated ${results.success} budget splits and tracked changes in history` 
      });
    } else {
      res.json({ 
        success: results.success > 0, 
        message: `Processed ${results.success + results.failures} updates: ${results.success} succeeded, ${results.failures} failed`,
        errors: results.errors
      });
    }
  } catch (error) {
    console.error('[Budget] Bulk update error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to process bulk update' 
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