/**
 * Budget Notification Service
 * Handles creation and management of budget notifications
 */

import { supabase } from '../config/db';
import { log } from '../vite';

export interface BudgetNotification {
  id?: number;
  mis: number;
  na853?: string;
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
        .from('project_budget')
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
        .from('project_budget')
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

    // Get NA853 code for display
    let na853Code = '';
    if (projectId) {
      const { data: projectData } = await supabase
        .from('Projects')
        .select('na853')
        .eq('id', projectId)
        .single();
      na853Code = projectData?.na853 || '';
    }

    // Check if requested amount exceeds ethsia_pistosi (funding required)
    if (requestedAmount > ethsiaPistosi) {
      await createBudgetNotification({
        mis: budgetData.mis || 0,
        na853: na853Code,
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
        mis: budgetData.mis || 0,
        na853: na853Code,
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
    log(`[Budget] Creating notification for project identifier: ${notification.mis}, Type: ${notification.type}`, 'info');

    // Determine project_id: notification.mis can be either a project_id or a MIS code
    // First try to find the project by id (since frontend usually passes project_id)
    // Then fall back to looking up by MIS if that fails
    let projectId = 0;
    if (notification.mis) {
      // First, try to find by project id directly (most common case from frontend)
      const { data: projectById, error: idError } = await supabase
        .from('Projects')
        .select('id, mis')
        .eq('id', notification.mis)
        .single();
      
      if (!idError && projectById?.id) {
        projectId = projectById.id;
        log(`[Budget] Found project by id: ${projectId}`, 'debug');
      } else {
        // Fall back to MIS lookup (for legacy cases)
        const { data: projectByMis, error: misError } = await supabase
          .from('Projects')
          .select('id')
          .eq('mis', notification.mis)
          .single();
        
        if (!misError && projectByMis?.id) {
          projectId = projectByMis.id;
          log(`[Budget] Found project by MIS: ${projectId}`, 'debug');
        } else {
          log(`[Budget] Could not find project for identifier: ${notification.mis}`, 'warn');
        }
      }
    }

    // Check if a similar notification already exists to avoid duplicates
    const { data: existingNotifications, error: checkError } = await supabase
      .from('budget_notifications')
      .select('id')
      .eq('project_id', projectId)
      .eq('type', notification.type)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Within last 24 hours

    if (checkError) {
      log(`[Budget] Error checking existing notifications: ${checkError.message}`, 'warn');
    }

    // If similar notification exists, update it instead of creating duplicate
    if (existingNotifications && existingNotifications.length > 0) {
      const existingId = existingNotifications[0].id;
      log(`[Budget] Updating existing notification ${existingId} instead of creating duplicate`, 'info');
      
      const { data: updatedData, error: updateError } = await supabase
        .from('budget_notifications')
        .update({
          amount: notification.amount,
          current_budget: notification.current_budget,
          ethsia_pistosi: notification.ethsia_pistosi,
          reason: notification.reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingId)
        .select()
        .single();

      if (updateError) {
        log(`[Budget] Error updating existing notification: ${updateError.message}`, 'error');
        // Fall through to create new notification
      } else {
        log(`[Budget] Successfully updated existing notification with ID: ${existingId}`, 'info');
        return updatedData;
      }
    }

    // Create new notification
    const { data, error } = await supabase
      .from('budget_notifications')
      .insert({
        project_id: projectId,
        type: notification.type,
        amount: notification.amount,
        current_budget: notification.current_budget,
        ethsia_pistosi: notification.ethsia_pistosi,
        reason: notification.reason,
        status: notification.status || 'pending',
        user_id: notification.user_id || 0
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

/**
 * Gets all notifications for admin users
 */
export async function getAllNotifications(): Promise<BudgetNotification[]> {
  try {
    const { data, error } = await supabase
      .from('budget_notifications')
      .select(`
        id,
        project_id,
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
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      log(`[Budget] Error fetching all notifications: ${error.message}`, 'error');
      return [];
    }

    log(`[Budget] Successfully fetched ${data?.length || 0} notifications`, 'info');
    
    // Fetch project details and map project_id to mis and NA853 for backwards compatibility
    const mappedData = await Promise.all(
      (data || []).map(async (notif) => {
        let na853 = '';
        if (notif.project_id) {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('na853')
            .eq('id', notif.project_id)
            .single();
          na853 = projectData?.na853 || '';
        }
        return {
          ...notif,
          mis: notif.project_id,
          na853
        };
      })
    );

    return mappedData;

  } catch (error) {
    log(`[Budget] Error getting all notifications: ${error}`, 'error');
    return [];
  }
}

/**
 * Creates test reallocation notifications for demonstration
 */
export async function createTestReallocationNotifications(): Promise<void> {
  try {
    log('[Budget] Creating test reallocation notifications...', 'info');

    // Get first 3 projects to use as test projects
    const { data: projects, error: projError } = await supabase
      .from('Projects')
      .select('id, mis')
      .limit(3);

    if (projError || !projects || projects.length < 3) {
      log('[Budget] Could not find enough projects for test notifications', 'warn');
      return;
    }

    // Clear existing test notifications first
    await supabase
      .from('budget_notifications')
      .delete()
      .eq('user_id', 49);

    // Create sample reallocation notification
    const reallocationNotification = await createBudgetNotification({
      mis: projects[0].mis,
      type: 'reallocation',
      amount: 1500,
      current_budget: 4489,
      ethsia_pistosi: 5000,
      reason: 'Απαιτείται ανακατανομή: Το ποσό 1,500€ υπερβαίνει το 20% της ετήσιας κατανομής 1,000€',
      status: 'pending',
      user_id: 49
    });

    // Create sample funding notification
    const fundingNotification = await createBudgetNotification({
      mis: projects[1].mis,
      type: 'funding',
      amount: 12000,
      current_budget: 8000,
      ethsia_pistosi: 10000,
      reason: 'Απαιτείται χρηματοδότηση: Το ποσό 12,000€ υπερβαίνει την ετήσια πίστωση 10,000€',
      status: 'pending',
      user_id: 49
    });

    if (reallocationNotification && fundingNotification) {
      log('[Budget] Successfully created test notifications', 'info');
    } else {
      log('[Budget] Some test notifications may have failed to create', 'warn');
    }

  } catch (error) {
    log(`[Budget] Error creating test notifications: ${error}`, 'error');
  }
}