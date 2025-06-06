/**
 * Budget Notification Service
 * Handles creation and management of budget notifications
 */

import { supabase } from '../config/db';
import { log } from '../vite';

export interface BudgetNotification {
  id?: number;
  project_id: number;
  mis?: number;
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
  projectIdentifier: string | number, 
  requestedAmount: number, 
  userId?: number
): Promise<BudgetValidationResult> {
  try {
    log(`[Budget] Validating allocation for Project: ${projectIdentifier}, Amount: ${requestedAmount}`, 'info');

    // Enhanced lookup to support both project IDs and codes
    let budgetData: any = null;
    let projectId: number | null = null;
    
    // Pattern to detect project codes like "2024ΝΑ85300001"
    const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
    const isNumericString = /^\d+$/.test(String(projectIdentifier));
    
    // First try to find the project and get its ID
    if (projectCodePattern.test(String(projectIdentifier))) {
      // It's a project code like "2024ΝΑ85300001"
      const { data: projectData, error: projectError } = await supabase
        .from('Projects')
        .select('id, mis, na853')
        .eq('na853', projectIdentifier)
        .single();
      
      if (!projectError && projectData?.id) {
        projectId = projectData.id;
        log(`[Budget] Found project ID ${projectId} for project code ${projectIdentifier}`, 'debug');
      }
    } else if (isNumericString) {
      // It's a numeric ID, use directly
      projectId = parseInt(String(projectIdentifier));
      log(`[Budget] Using direct project ID: ${projectId}`, 'debug');
    }

    // Get budget data using project_id if available
    if (projectId) {
      const { data: projectBudgetData, error: budgetError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (!budgetError && projectBudgetData) {
        budgetData = projectBudgetData;
        log(`[Budget] Found budget data using project_id: ${projectId}`, 'debug');
      }
    }

    // Fallback: try direct MIS lookup if no budget data found
    if (!budgetData && isNumericString) {
      const { data: misBudgetData, error: misError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', parseInt(String(projectIdentifier)))
        .single();
      
      if (!misError && misBudgetData) {
        budgetData = misBudgetData;
        log(`[Budget] Found budget data using MIS: ${projectIdentifier}`, 'debug');
      }
    }

    if (!budgetData) {
      log(`[Budget] No budget data found for project: ${projectIdentifier}`, 'warn');
      return {
        isValid: false,
        requiresNotification: true,
        notificationType: 'budget_not_found',
        message: 'Δεν βρέθηκαν στοιχεία προϋπολογισμού για το έργο'
      };
    }

    const katanomesEtous = parseFloat(budgetData.katanomes_etous || '0');
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi || '0');
    const userView = parseFloat(budgetData.user_view || '0');
    const quarterAvailable = parseFloat(budgetData.quarter_available || '0');
    
    // Calculate available budgets
    const availableBudget = katanomesEtous - userView;
    const yearlyAvailable = ethsiaPistosi - userView;

    log(`[Budget] Budget analysis: Available: ${availableBudget}, Yearly: ${yearlyAvailable}, Quarter: ${quarterAvailable}, Requested: ${requestedAmount}`, 'debug');

    // Check if requested amount exceeds ethsia_pistosi (funding required)
    if (requestedAmount > ethsiaPistosi) {
      await createBudgetNotification({
        project_id: projectId || 0,
        mis: budgetData.mis || 0,
        type: 'funding',
        amount: requestedAmount,
        current_budget: availableBudget,
        ethsia_pistosi: ethsiaPistosi,
        reason: `Απαιτείται χρηματοδότηση: Το ποσό ${requestedAmount.toFixed(2)}€ υπερβαίνει την ετήσια πίστωση ${ethsiaPistosi.toFixed(2)}€`,
        user_id: userId
      });

      return {
        isValid: false,
        requiresNotification: true,
        notificationType: 'funding',
        message: 'Απαιτείται χρηματοδότηση - το ποσό υπερβαίνει την ετήσια πίστωση',
        currentBudget: availableBudget,
        ethsiaPistosi
      };
    }

    // Check if requested amount exceeds 20% of annual allocation (reallocation required)
    const reallocationThreshold = katanomesEtous * 0.2;
    if (requestedAmount > reallocationThreshold && requestedAmount <= ethsiaPistosi) {
      await createBudgetNotification({
        project_id: projectId || 0,
        mis: budgetData.mis || 0,
        type: 'reallocation',
        amount: requestedAmount,
        current_budget: availableBudget,
        ethsia_pistosi: ethsiaPistosi,
        reason: `Απαιτείται ανακατανομή: Το ποσό ${requestedAmount.toFixed(2)}€ υπερβαίνει το 20% της ετήσιας κατανομής ${reallocationThreshold.toFixed(2)}€`,
        user_id: userId
      });

      return {
        isValid: true,
        requiresNotification: true,
        notificationType: 'reallocation',
        message: 'Απαιτείται ανακατανομή - το ποσό υπερβαίνει το 20% της ετήσιας κατανομής',
        currentBudget: availableBudget,
        ethsiaPistosi
      };
    }

    // Check if requested amount exceeds quarter available
    if (quarterAvailable > 0 && requestedAmount > quarterAvailable) {
      await createBudgetNotification({
        project_id: projectId || 0,
        mis: budgetData.mis || 0,
        type: 'quarter_exceeded',
        amount: requestedAmount,
        current_budget: quarterAvailable,
        ethsia_pistosi: ethsiaPistosi,
        reason: `Το ποσό ${requestedAmount.toFixed(2)}€ υπερβαίνει το διαθέσιμο ποσό τριμήνου ${quarterAvailable.toFixed(2)}€`,
        user_id: userId
      });

      return {
        isValid: false,
        requiresNotification: true,
        notificationType: 'quarter_exceeded',
        message: 'Το ποσό υπερβαίνει το διαθέσιμο ποσό τριμήνου',
        currentBudget: quarterAvailable,
        ethsiaPistosi
      };
    }

    // Budget allocation is valid
    return {
      isValid: true,
      requiresNotification: false,
      message: 'Η κατανομή προϋπολογισμού είναι έγκυρη',
      currentBudget: availableBudget,
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
    log(`[Budget] Creating notification for Project ID: ${notification.project_id}, Type: ${notification.type}`, 'info');

    const { data, error } = await supabase
      .from('budget_notifications')
      .insert({
        project_id: notification.project_id,
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