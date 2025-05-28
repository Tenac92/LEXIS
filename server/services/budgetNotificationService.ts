/**
 * Budget Notification Service
 * Handles creation and management of budget notifications
 */

import { supabase } from '../config/db';
import { log } from '../vite';

export interface BudgetNotification {
  id?: number;
  mis: number;
  type: string;
  amount: number;
  current_budget: number;
  ethsia_pistosi: number;
  reason?: string;
  status?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetValidationResult {
  isValid: boolean;
  requiresNotification: boolean;
  notificationType?: string;
  message?: string;
  currentBudget?: number;
  ethsiaPistosi?: number;
}

/**
 * Validates budget allocation and determines if notification is needed
 */
export async function validateBudgetAllocation(
  mis: number, 
  requestedAmount: number, 
  userId?: number
): Promise<BudgetValidationResult> {
  try {
    log(`[Budget] Validating allocation for MIS: ${mis}, Amount: ${requestedAmount}`, 'info');

    // Get current budget data
    const { data: budgetData, error } = await supabase
      .from('budget_na853_split')
      .select('katanomes_etous, ethsia_pistosi, proip')
      .eq('mis', mis)
      .single();

    if (error || !budgetData) {
      log(`[Budget] No budget data found for MIS: ${mis}`, 'warn');
      return {
        isValid: false,
        requiresNotification: true,
        notificationType: 'budget_not_found',
        message: 'Δεν βρέθηκαν στοιχεία προϋπολογισμού για το έργο'
      };
    }

    const currentBudget = budgetData.katanomes_etous || 0;
    const ethsiaPistosi = budgetData.ethsia_pistosi || 0;
    const proip = budgetData.proip || 0;

    log(`[Budget] Current budget: ${currentBudget}, Ethsia Pistosi: ${ethsiaPistosi}, PROIP: ${proip}`, 'debug');

    // Check if requested amount exceeds available budget
    if (requestedAmount > currentBudget) {
      await createBudgetNotification({
        mis,
        type: 'budget_exceeded',
        amount: requestedAmount,
        current_budget: currentBudget,
        ethsia_pistosi: ethsiaPistosi,
        reason: `Το αιτούμενο ποσό ${requestedAmount}€ υπερβαίνει τον διαθέσιμο προϋπολογισμό ${currentBudget}€`,
        user_id: userId
      });

      return {
        isValid: false,
        requiresNotification: true,
        notificationType: 'budget_exceeded',
        message: `Το αιτούμενο ποσό υπερβαίνει τον διαθέσιμο προϋπολογισμό`,
        currentBudget,
        ethsiaPistosi
      };
    }

    // Check if allocation would exceed 80% of budget (warning threshold)
    const warningThreshold = currentBudget * 0.8;
    if (requestedAmount > warningThreshold) {
      await createBudgetNotification({
        mis,
        type: 'budget_warning',
        amount: requestedAmount,
        current_budget: currentBudget,
        ethsia_pistosi: ethsiaPistosi,
        reason: `Το αιτούμενο ποσό ${requestedAmount}€ υπερβαίνει το 80% του διαθέσιμου προϋπολογισμού`,
        status: 'warning',
        user_id: userId
      });

      return {
        isValid: true,
        requiresNotification: true,
        notificationType: 'budget_warning',
        message: 'Προειδοποίηση: Το ποσό υπερβαίνει το 80% του διαθέσιμου προϋπολογισμού',
        currentBudget,
        ethsiaPistosi
      };
    }

    // Budget allocation is valid
    return {
      isValid: true,
      requiresNotification: false,
      message: 'Η κατανομή προϋπολογισμού είναι έγκυρη',
      currentBudget,
      ethsiaPistosi
    };

  } catch (error) {
    log(`[Budget] Error validating budget allocation: ${error}`, 'error');
    return {
      isValid: false,
      requiresNotification: true,
      notificationType: 'validation_error',
      message: 'Σφάλμα κατά την επικύρωση του προϋπολογισμού'
    };
  }
}

/**
 * Creates a new budget notification
 */
export async function createBudgetNotification(notification: Omit<BudgetNotification, 'id' | 'created_at' | 'updated_at'>): Promise<BudgetNotification | null> {
  try {
    log(`[Budget] Creating notification for MIS: ${notification.mis}, Type: ${notification.type}`, 'info');

    const { data, error } = await supabase
      .from('budget_notifications')
      .insert({
        mis: notification.mis,
        type: notification.type,
        amount: notification.amount,
        current_budget: notification.current_budget,
        ethsia_pistosi: notification.ethsia_pistosi,
        reason: notification.reason,
        status: notification.status || 'pending',
        user_id: notification.user_id
      })
      .select()
      .single();

    if (error) {
      log(`[Budget] Error creating notification: ${error.message}`, 'error');
      return null;
    }

    log(`[Budget] Successfully created notification with ID: ${data.id}`, 'info');
    return data;

  } catch (error) {
    log(`[Budget] Error creating budget notification: ${error}`, 'error');
    return null;
  }
}

/**
 * Gets all budget notifications for a specific MIS
 */
export async function getBudgetNotifications(mis: number): Promise<BudgetNotification[]> {
  try {
    const { data, error } = await supabase
      .from('budget_notifications')
      .select('*')
      .eq('mis', mis)
      .order('created_at', { ascending: false });

    if (error) {
      log(`[Budget] Error fetching notifications: ${error.message}`, 'error');
      return [];
    }

    return data || [];

  } catch (error) {
    log(`[Budget] Error getting budget notifications: ${error}`, 'error');
    return [];
  }
}

/**
 * Updates the status of a budget notification
 */
export async function updateNotificationStatus(notificationId: number, status: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('budget_notifications')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) {
      log(`[Budget] Error updating notification status: ${error.message}`, 'error');
      return false;
    }

    log(`[Budget] Successfully updated notification ${notificationId} to status: ${status}`, 'info');
    return true;

  } catch (error) {
    log(`[Budget] Error updating notification status: ${error}`, 'error');
    return false;
  }
}

/**
 * Gets pending notifications for a user's units
 */
export async function getPendingNotifications(userUnits: string[]): Promise<BudgetNotification[]> {
  try {
    if (!userUnits || userUnits.length === 0) {
      return [];
    }

    // Get projects for the user's units first
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('mis')
      .ilike('implementing_agency', `%${userUnits[0]}%`);

    if (projectsError || !projects) {
      log(`[Budget] Error fetching projects for unit notifications: ${projectsError?.message}`, 'error');
      return [];
    }

    const projectMis = projects.map(p => p.mis);

    if (projectMis.length === 0) {
      return [];
    }

    // Get notifications for these projects
    const { data, error } = await supabase
      .from('budget_notifications')
      .select('*')
      .in('mis', projectMis)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      log(`[Budget] Error fetching pending notifications: ${error.message}`, 'error');
      return [];
    }

    return data || [];

  } catch (error) {
    log(`[Budget] Error getting pending notifications: ${error}`, 'error');
    return [];
  }
}