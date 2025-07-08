/**
 * Budget Notifications API Routes
 * Handles budget notification endpoints for your Supabase table
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../authentication';
import { 
  getBudgetNotifications, 
  getPendingNotifications, 
  updateNotificationStatus,
  createBudgetNotification 
} from '../../services/budgetNotificationService';
import { log } from '../../vite';

const router = Router();

/**
 * Get pending notifications for user's units
 * GET /api/notifications/pending
 */
router.get('/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.unit_id) {
      return res.status(401).json({ message: 'Μη εξουσιοδοτημένη πρόσβαση' });
    }

    const notifications = await getPendingNotifications(req.user.unit_id);
    
    log(`[Notifications] Found ${notifications.length} pending notifications for user ${req.user.id}`, 'info');
    
    return res.status(200).json({
      notifications,
      count: notifications.length
    });

  } catch (error) {
    log(`[Notifications] Error fetching pending notifications: ${error}`, 'error');
    return res.status(500).json({ 
      message: 'Σφάλμα κατά την ανάκτηση ειδοποιήσεων' 
    });
  }
});

/**
 * Get notifications for a specific MIS
 * GET /api/notifications/mis/:mis
 */
router.get('/mis/:mis', async (req: Request, res: Response) => {
  try {
    const mis = parseInt(req.params.mis);
    
    if (isNaN(mis)) {
      return res.status(400).json({ message: 'Μη έγκυρος MIS' });
    }

    const notifications = await getBudgetNotifications(mis);
    
    return res.status(200).json({
      mis,
      notifications,
      count: notifications.length
    });

  } catch (error) {
    log(`[Notifications] Error fetching notifications for MIS: ${error}`, 'error');
    return res.status(500).json({ 
      message: 'Σφάλμα κατά την ανάκτηση ειδοποιήσεων' 
    });
  }
});

/**
 * Update notification status
 * PATCH /api/notifications/:id/status
 */
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'Μη έγκυρο ID ειδοποίησης' });
    }

    if (!status || !['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Μη έγκυρη κατάσταση ειδοποίησης' });
    }

    const success = await updateNotificationStatus(notificationId, status);
    
    if (!success) {
      return res.status(500).json({ message: 'Αποτυχία ενημέρωσης ειδοποίησης' });
    }

    log(`[Notifications] Updated notification ${notificationId} to status: ${status}`, 'info');
    
    return res.status(200).json({
      message: 'Η ειδοποίηση ενημερώθηκε επιτυχώς',
      notificationId,
      status
    });

  } catch (error) {
    log(`[Notifications] Error updating notification status: ${error}`, 'error');
    return res.status(500).json({ 
      message: 'Σφάλμα κατά την ενημέρωση της ειδοποίησης' 
    });
  }
});

/**
 * Create a manual budget notification
 * POST /api/notifications
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mis, type, amount, current_budget, ethsia_pistosi, reason } = req.body;
    
    if (!mis || !type || !amount || current_budget === undefined || ethsia_pistosi === undefined) {
      return res.status(400).json({ 
        message: 'Απαιτούνται όλα τα απαραίτητα πεδία' 
      });
    }

    const notification = await createBudgetNotification({
      mis: parseInt(mis),
      type,
      amount: parseFloat(amount),
      current_budget: parseFloat(current_budget),
      ethsia_pistosi: parseFloat(ethsia_pistosi),
      reason,
      user_id: req.user?.id ? parseInt(req.user.id.toString()) : undefined
    });

    if (!notification) {
      return res.status(500).json({ message: 'Αποτυχία δημιουργίας ειδοποίησης' });
    }

    log(`[Notifications] Created manual notification for MIS: ${mis}`, 'info');
    
    return res.status(201).json({
      message: 'Η ειδοποίηση δημιουργήθηκε επιτυχώς',
      notification
    });

  } catch (error) {
    log(`[Notifications] Error creating notification: ${error}`, 'error');
    return res.status(500).json({ 
      message: 'Σφάλμα κατά τη δημιουργία της ειδοποίησης' 
    });
  }
});

export default router;