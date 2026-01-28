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

    const notifications = await getPendingNotifications(req.user.unit_id.map(String));
    
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

/**
 * Request budget reallocation or funding from admin
 * POST /api/notifications/request-reallocation
 * 
 * request_type: 'ανακατανομή' (for Πίστωση exceeded - hard block)
 *               'χρηματοδότηση' (for Κατανομή exceeded - soft block)
 */
router.post('/request-reallocation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, request_type, requested_amount, available_budget, shortage } = req.body;
    
    if (!project_id || !requested_amount) {
      return res.status(400).json({ 
        message: 'Απαιτούνται τα πεδία project_id και requested_amount' 
      });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Μη εξουσιοδοτημένη πρόσβαση' });
    }

    // Validate request_type - only accept 'ανακατανομή' or 'χρηματοδότηση'
    // Default to 'ανακατανομή' (hard block) as the safer option if missing/invalid
    const validRequestTypes = ['ανακατανομή', 'χρηματοδότηση'];
    const safeRequestType = validRequestTypes.includes(request_type) ? request_type : 'ανακατανομή';
    
    // Determine notification type based on request_type from frontend
    // 'ανακατανομή' = Πίστωση exceeded (hard block) - DEFAULT for safety
    // 'χρηματοδότηση' = Κατανομή exceeded (soft block)
    const isAnakatanom = safeRequestType === 'ανακατανομή';
    const notificationType = isAnakatanom ? 'anakatanom_request' : 'xrimatodotisi_request';
    const reasonPrefix = isAnakatanom ? 'Αίτημα ανακατανομής' : 'Αίτημα χρηματοδότησης';
    const successMessage = isAnakatanom 
      ? 'Το αίτημα ανακατανομής υποβλήθηκε επιτυχώς' 
      : 'Το αίτημα χρηματοδότησης υποβλήθηκε επιτυχώς';

    // Create a notification for the admin about the budget request
    const notification = await createBudgetNotification({
      mis: parseInt(project_id.toString()),
      type: notificationType,
      amount: parseFloat(requested_amount.toString()),
      current_budget: parseFloat(available_budget?.toString() || '0'),
      ethsia_pistosi: parseFloat(shortage?.toString() || '0'),
      reason: `${reasonPrefix}: Ζητούμενο ποσό €${parseFloat(requested_amount.toString()).toLocaleString('el-GR')}, Διαθέσιμο €${parseFloat(available_budget?.toString() || '0').toLocaleString('el-GR')}, Έλλειμμα €${parseFloat(shortage?.toString() || '0').toLocaleString('el-GR')}`,
      user_id: req.user.id ? parseInt(req.user.id.toString()) : undefined
    });

    if (!notification) {
      return res.status(500).json({ message: 'Αποτυχία δημιουργίας αιτήματος' });
    }

    log(`[Notifications] Created ${notificationType} for project ${project_id} by user ${req.user.id}`, 'info');
    
    return res.status(201).json({
      message: successMessage,
      notification
    });

  } catch (error) {
    log(`[Notifications] Error creating budget request: ${error}`, 'error');
    return res.status(500).json({ 
      message: 'Σφάλμα κατά την υποβολή του αιτήματος' 
    });
  }
});

export default router;