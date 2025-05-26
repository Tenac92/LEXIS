import { Request, Response, Router } from 'express';
import { db } from '../drizzle';
import { supabase } from '../config/db';
import { authenticateSession } from '../authentication';
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

    // First get the notifications
    const { data: notificationsData, error } = await supabase
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
    
    // Ensure we have notifications data
    if (!notificationsData || !notificationsData.length) {
      return res.json([]);
    }
    
    // Get unique MIS values to fetch project data
    const misSet = new Set<string>();
    notificationsData.forEach(notification => {
      if (notification.mis) {
        misSet.add(notification.mis);
      }
    });
    const misValues = Array.from(misSet);
    
    // Get unique user IDs to fetch user data
    const userIdSet = new Set<number>();
    notificationsData.forEach(notification => {
      if (notification.user_id) {
        userIdSet.add(notification.user_id);
      }
    });
    const userIds = Array.from(userIdSet);
    
    // Fetch project data for the MIS values
    const { data: projectsData, error: projectsError } = await supabase
      .from('Projects')
      .select('mis, na853')
      .in('mis', misValues);
      
    if (projectsError) {
      console.error('[BudgetNotificationsController] Error fetching projects:', projectsError);
      // Continue even if there's an error getting projects
    }
    
    // Create a map of MIS to NA853 values
    const misToNa853Map = new Map();
    if (projectsData && projectsData.length) {
      projectsData.forEach(project => {
        misToNa853Map.set(project.mis, project.na853);
      });
    }
    
    // Fetch user data
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, department')
      .in('id', userIds);
      
    if (usersError) {
      console.error('[BudgetNotificationsController] Error fetching users:', usersError);
      // Continue even if there's an error getting users
    }
    
    // Create a map of user ID to user details
    const userMap = new Map();
    if (usersData && usersData.length) {
      usersData.forEach(user => {
        userMap.set(user.id, user);
      });
    }
    
    // Combine the data
    const data = notificationsData.map(notification => {
      const na853 = misToNa853Map.get(notification.mis) || null;
      const user = userMap.get(notification.user_id) || null;
      
      return {
        ...notification,
        na853,
        user
      };
    });

    // Ensure we return an array even if data is null
    const notifications = data || [];
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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Unexpected error in approve endpoint:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BudgetNotificationsController] Unexpected error in reject endpoint:', errorMessage);
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: errorMessage
    });
  }
});