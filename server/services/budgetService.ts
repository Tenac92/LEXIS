import { supabase } from '../config/db';
import type { Database } from '@shared/schema';

export interface BudgetResponse {
  status: 'success' | 'error' | 'warning';
  data?: {
    user_view: string;
    ethsia_pistosi: string;
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    total_spent: string;
    current_budget: string;
  };
  message?: string;
  error?: string;
}

export interface BudgetValidationResult {
  canCreate: boolean;
  status: 'success' | 'error' | 'warning';
  message?: string;
  requiresNotification?: boolean;
  notificationType?: 'funding' | 'reallocation' | 'low_budget' | 'threshold_warning';
  allowDocx?: boolean;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

export class BudgetService {
  static async getBudget(mis: string): Promise<BudgetResponse> {
    try {
      if (!mis) {
        return {
          status: 'error',
          message: 'MIS parameter is required'
        };
      }

      // Get budget data directly using MIS
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', mis)
        .single();

      if (budgetError) {
        throw budgetError;
      }

      // Use user_view as current_budget if current_budget is not set or zero
      const userView = budgetData?.user_view?.toString() || '0';
      
      return {
        status: 'success',
        data: {
          user_view: userView,
          ethsia_pistosi: budgetData?.ethsia_pistosi?.toString() || '0',
          q1: budgetData?.q1?.toString() || '0',
          q2: budgetData?.q2?.toString() || '0',
          q3: budgetData?.q3?.toString() || '0',
          q4: budgetData?.q4?.toString() || '0',
          total_spent: budgetData?.total_spent?.toString() || '0',
          current_budget: userView // Set current_budget to match user_view
        }
      };
    } catch (error) {
      console.error('[BudgetService] Error fetching budget:', error);
      return {
        status: 'error',
        message: 'Failed to fetch budget data',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async validateBudget(mis: string, amount: number): Promise<BudgetValidationResult> {
    try {
      if (!mis || isNaN(amount) || amount <= 0) {
        return {
          status: 'error',
          canCreate: false,
          message: !mis ? 'MIS parameter is required' : 'Valid amount parameter is required'
        };
      }

      console.log(`[BudgetService] Validating budget for MIS: ${mis}, amount: ${amount}`);

      // Try to get current budget data
      let { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('user_view, ethsia_pistosi, katanomes_etous')
        .eq('mis', mis)
        .single();

      // If not found, try to get project data to find the correct MIS
      if (error || !budgetData) {
        console.log(`[BudgetService] Budget not found directly for MIS: ${mis}, trying project lookup`);
        
        // Try to find project by either its ID or MIS field
        const { data: projectData } = await supabase
          .from('Projects')
          .select('id, mis')
          .or(`id.eq.${mis},mis.eq.${mis}`)
          .single();
        
        if (projectData?.mis) {
          console.log(`[BudgetService] Found project with MIS: ${projectData.mis}`);
          
          // Try again with the project's MIS value
          const retryResult = await supabase
            .from('budget_na853_split')
            .select('user_view, ethsia_pistosi, katanomes_etous')
            .eq('mis', projectData.mis)
            .single();
            
          budgetData = retryResult.data;
          error = retryResult.error;
        }
      }

      // If we still don't have budget data, return an error but allow document creation
      if (error || !budgetData) {
        console.log(`[BudgetService] Budget not found for MIS: ${mis} after lookup attempts`);
        
        return {
          status: 'warning',
          canCreate: true, // Allow document creation even without budget data
          message: 'Ο προϋπολογισμός δεν βρέθηκε για αυτό το MIS. Η δημιουργία εγγράφου επιτρέπεται χωρίς έλεγχο προϋπολογισμού.',
          allowDocx: true
        };
      }

      const userView = parseFloat(budgetData.user_view?.toString() || '0');
      const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');

      // Calculate 20% threshold of katanomes_etous
      const threshold = katanomesEtous * 0.2;
      const remainingAfterOperation = userView - amount;

      // Check if remaining budget falls below 20% threshold
      if (remainingAfterOperation <= threshold) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Budget will fall below 20% of annual allocation. Admin notification required.',
          requiresNotification: true,
          notificationType: 'low_budget',
          priority: 'high',
          metadata: {
            remainingBudget: remainingAfterOperation,
            threshold: threshold,
            percentageRemaining: (remainingAfterOperation / katanomesEtous) * 100
          }
        };
      }

      return {
        status: 'success',
        canCreate: true,
        metadata: {
          remainingBudget: remainingAfterOperation,
          percentageRemaining: (remainingAfterOperation / katanomesEtous) * 100
        }
      };
    } catch (error) {
      console.error('[BudgetService] Budget validation error:', error);
      return {
        status: 'error',
        canCreate: false,
        message: 'Failed to validate budget'
      };
    }
  }

  static async updateBudget(mis: string, amount: number, userId: number): Promise<BudgetResponse> {
    try {
      if (!mis || isNaN(amount) || amount <= 0 || !userId) {
        return {
          status: 'error',
          message: 'Missing required parameters'
        };
      }

      console.log(`[BudgetService] Updating budget for MIS: ${mis}, amount: ${amount}, userId: ${userId}`);

      // Try to get current budget data
      let { data: budgetData, error: fetchError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', mis)
        .single();

      // If not found, try to get project data to find the correct MIS
      if (fetchError || !budgetData) {
        console.log(`[BudgetService] Budget not found directly for MIS: ${mis}, trying project lookup`);
        
        // Try to find project by either its ID or MIS field
        const { data: projectData } = await supabase
          .from('Projects')
          .select('id, mis')
          .or(`id.eq.${mis},mis.eq.${mis}`)
          .single();
        
        if (projectData?.mis) {
          console.log(`[BudgetService] Found project with MIS: ${projectData.mis}`);
          
          // Try again with the project's MIS value
          const retryResult = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', projectData.mis)
            .single();
            
          budgetData = retryResult.data;
          fetchError = retryResult.error;
        }
      }

      // If we still don't have budget data, return a default success response
      if (fetchError || !budgetData) {
        console.log(`[BudgetService] Budget not found for MIS: ${mis} after lookup attempts`);
        
        return {
          status: 'warning',
          message: 'Budget not found, but update is allowed without budget tracking',
          data: {
            user_view: '0',
            ethsia_pistosi: '0',
            q1: '0',
            q2: '0',
            q3: '0',
            q4: '0',
            total_spent: amount.toString(),
            current_budget: '0'
          }
        };
      }

      // Parse current values
      const currentUserView = parseFloat(budgetData.user_view?.toString() || '0');
      const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');

      // Get current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const quarterKey = `q${Math.ceil(currentMonth / 3)}` as 'q1' | 'q2' | 'q3' | 'q4';

      // Parse current quarter value
      const currentQuarterValue = parseFloat(budgetData[quarterKey]?.toString() || '0');

      // Calculate new amounts
      const newUserView = Math.max(0, currentUserView - amount);
      const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - amount);
      const newQuarterValue = Math.max(0, currentQuarterValue - amount);

      // Update budget amounts
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update({
          user_view: newUserView.toString(),
          ethsia_pistosi: newEthsiaPistosi.toString(),
          [quarterKey]: newQuarterValue.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('mis', mis);

      if (updateError) {
        throw updateError;
      }

      // Create budget history entry
      await supabase
        .from('budget_history')
        .insert({
          mis,
          previous_amount: currentUserView.toString(),
          new_amount: newUserView.toString(),
          change_type: 'document_creation',
          change_reason: 'Document creation reduced available budget',
          created_by: userId,
          metadata: {
            quarter: quarterKey,
            quarter_previous: currentQuarterValue,
            quarter_new: newQuarterValue
          }
        });

      return {
        status: 'success',
        data: {
          user_view: newUserView.toString(),
          ethsia_pistosi: newEthsiaPistosi.toString(),
          q1: quarterKey === 'q1' ? newQuarterValue.toString() : budgetData.q1?.toString() || '0',
          q2: quarterKey === 'q2' ? newQuarterValue.toString() : budgetData.q2?.toString() || '0',
          q3: quarterKey === 'q3' ? newQuarterValue.toString() : budgetData.q3?.toString() || '0',
          q4: quarterKey === 'q4' ? newQuarterValue.toString() : budgetData.q4?.toString() || '0',
          total_spent: (parseFloat(budgetData.total_spent?.toString() || '0') + amount).toString(),
          current_budget: newUserView.toString()
        }
      };
    } catch (error) {
      console.error('[BudgetService] Budget update error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update budget'
      };
    }
  }

  static async getNotifications() {
    try {
      console.log('[BudgetService] Fetching notifications...');

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
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[BudgetService] Error fetching notifications:', error);
        // Return empty array instead of throwing error
        return [];
      }

      // Ensure data is an array
      const notificationArray = Array.isArray(data) ? data : [];

      // Transform and validate the data
      const transformedData = notificationArray.map(notification => ({
        id: Number(notification.id),
        mis: String(notification.mis),
        type: notification.type,
        amount: Number(notification.amount),
        current_budget: Number(notification.current_budget),
        ethsia_pistosi: Number(notification.ethsia_pistosi),
        reason: String(notification.reason || ''),
        status: notification.status,
        user_id: Number(notification.user_id),
        created_at: notification.created_at,
        updated_at: notification.updated_at
      }));

      console.log('[BudgetService] Successfully fetched notifications:', {
        count: transformedData.length,
        isArray: Array.isArray(transformedData),
        sample: transformedData[0]
      });

      return transformedData;
    } catch (error) {
      console.error('[BudgetService] Error in getNotifications:', error);
      // Return empty array instead of throwing error
      return [];
    }
  }
}