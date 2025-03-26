import { Request, Response, Router } from 'express';
import { db } from '../drizzle';
import { supabase } from '../config/db';
import { authenticateSession } from '../auth';
import type { User } from '@shared/schema';

interface AuthRequest extends Request {
  user?: User;
}

export const router = Router();

// Get all budget notifications (admin view)
router.get('/admin', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    // Ensure user is an admin
    if (!req.user?.id || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    console.log('[BudgetNotificationsController] Admin fetching all notifications...');

    const { data, error } = await supabase
      .from('budget_notifications')
      .select(`
        id,
        mis,
        type,
        amount,
        current_budget,
        ethsia_pistosi,
        reason,
        status,
        user_id,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BudgetNotificationsController] Error fetching notifications:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }

    // Ensure we return an array even if data is null
    const notifications = data || [];
    console.log(`[BudgetNotificationsController] Successfully fetched ${notifications.length} notifications`);
    
    return res.json(notifications);
  } catch (error) {
    console.error('[BudgetNotificationsController] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Approve a notification
router.post('/:id/approve', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    // Ensure user is an admin
    if (!req.user?.id || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid notification ID is required'
      });
    }

    console.log(`[BudgetNotificationsController] Admin approving notification ID: ${id}`);

    // Get the notification to verify it exists and is pending
    const { data: notification, error: fetchError } = await supabase
      .from('budget_notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      console.error('[BudgetNotificationsController] Error fetching notification:', fetchError);
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found',
        error: fetchError?.message
      });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot approve notification with status: ${notification.status}`
      });
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from('budget_notifications')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('[BudgetNotificationsController] Error updating notification:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to approve notification',
        error: updateError.message
      });
    }

    // Create budget history entry for this approval
    await supabase
      .from('budget_history')
      .insert({
        mis: notification.mis,
        previous_amount: notification.current_budget,
        new_amount: notification.current_budget, // No change in budget yet, just approval
        change_type: 'notification_approved',
        change_reason: `Budget notification approved: ${notification.type}`,
        created_by: req.user.id,
        document_id: null,
        created_at: new Date().toISOString(),
        metadata: {
          notification_id: notification.id,
          notification_type: notification.type,
          notification_amount: notification.amount
        }
      });

    return res.json({
      status: 'success',
      message: 'Notification approved successfully'
    });
  } catch (error) {
    console.error('[BudgetNotificationsController] Unexpected error in approve endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reject a notification
router.post('/:id/reject', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    // Ensure user is an admin
    if (!req.user?.id || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid notification ID is required'
      });
    }

    console.log(`[BudgetNotificationsController] Admin rejecting notification ID: ${id}`);

    // Get the notification to verify it exists and is pending
    const { data: notification, error: fetchError } = await supabase
      .from('budget_notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      console.error('[BudgetNotificationsController] Error fetching notification:', fetchError);
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found',
        error: fetchError?.message
      });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot reject notification with status: ${notification.status}`
      });
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from('budget_notifications')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('[BudgetNotificationsController] Error updating notification:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to reject notification',
        error: updateError.message
      });
    }

    // Create budget history entry for this rejection
    await supabase
      .from('budget_history')
      .insert({
        mis: notification.mis,
        previous_amount: notification.current_budget,
        new_amount: notification.current_budget, // No change in budget for rejection
        change_type: 'notification_rejected',
        change_reason: `Budget notification rejected: ${notification.type}`,
        created_by: req.user.id,
        document_id: null,
        created_at: new Date().toISOString(),
        metadata: {
          notification_id: notification.id,
          notification_type: notification.type,
          notification_amount: notification.amount
        }
      });

    return res.json({
      status: 'success',
      message: 'Notification rejected successfully'
    });
  } catch (error) {
    console.error('[BudgetNotificationsController] Unexpected error in reject endpoint:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});