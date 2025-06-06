import { Request, Response, Router } from 'express';
import { db } from '../drizzle';
import { supabase } from '../config/db';
import { authenticateSession } from '../authentication';
import { getAllNotifications, createTestReallocationNotifications } from '../services/budgetNotificationService';
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

    // Use the enhanced service function
    const notifications = await getAllNotifications();
    
    console.log(`[BudgetNotificationsController] Successfully fetched ${notifications.length} notifications`);
    
    return res.json(notifications);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Unexpected error:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: errorMessage
    });
  }
});

// Create test notifications for demonstration
router.post('/create-test', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    // Ensure user is an admin
    if (!req.user?.id || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }

    console.log('[BudgetNotificationsController] Creating test notifications...');

    await createTestReallocationNotifications();

    return res.json({
      status: 'success',
      message: 'Test notifications created successfully'
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Error creating test notifications:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create test notifications',
      error: errorMessage
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
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending notifications can be approved'
      });
    }

    // Update the notification status to approved
    const { error: updateError } = await supabase
      .from('budget_notifications')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('[BudgetNotificationsController] Error approving notification:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to approve notification'
      });
    }

    console.log(`[BudgetNotificationsController] Successfully approved notification ${id}`);

    return res.json({
      status: 'success',
      message: 'Notification approved successfully'
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Error approving notification:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to approve notification',
      error: errorMessage
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

    // Update the notification status to rejected
    const { error: updateError } = await supabase
      .from('budget_notifications')
      .update({ 
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('[BudgetNotificationsController] Error rejecting notification:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to reject notification'
      });
    }

    console.log(`[BudgetNotificationsController] Successfully rejected notification ${id}`);

    return res.json({
      status: 'success',
      message: 'Notification rejected successfully'
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Error rejecting notification:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to reject notification',
      error: errorMessage
    });
  }
});

export default router;