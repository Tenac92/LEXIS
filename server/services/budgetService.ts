import { supabase } from '../db';
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
      // Special case for notifications endpoint
      if (mis === 'notifications') {
        return {
          status: 'success',
          data: []
        };
      }

      if (!mis) {
        return {
          status: 'error',
          message: 'MIS parameter is required'
        };
      }

      // Get project data
      const { data: projectData, error: projectError } = await supabase
        .from('project_catalog')
        .select('na853, budget_na853')
        .eq('mis', mis)
        .single();

      if (projectError) {
        throw projectError;
      }

      // If no NA853 code found, return default values
      if (!projectData?.na853) {
        return {
          status: 'success',
          data: {
            user_view: '0',
            ethsia_pistosi: '0',
            q1: '0',
            q2: '0',
            q3: '0',
            q4: '0',
            total_spent: '0',
            current_budget: (projectData?.budget_na853 || 0).toString()
          }
        };
      }

      // Get budget data
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('na853', projectData.na853)
        .single();

      if (budgetError) {
        throw budgetError;
      }

      return {
        status: 'success',
        data: {
          user_view: budgetData?.user_view?.toString() || budgetData?.katanomes_etous?.toString() || projectData.budget_na853?.toString() || '0',
          ethsia_pistosi: budgetData?.ethsia_pistosi?.toString() || '0',
          q1: budgetData?.q1?.toString() || '0',
          q2: budgetData?.q2?.toString() || '0',
          q3: budgetData?.q3?.toString() || '0',
          q4: budgetData?.q4?.toString() || '0',
          total_spent: budgetData?.total_spent?.toString() || '0',
          current_budget: budgetData?.current_budget?.toString() || budgetData?.katanomes_etous?.toString() || projectData.budget_na853?.toString() || '0'
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
          message: !mis ? 'MIS parameter is required' : 'Valid amount parameter is required',
          allowDocx: false
        };
      }

      const { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('user_view, ethsia_pistosi, katanomes_etous')
        .eq('mis', mis)
        .single();

      if (error || !budgetData) {
        return {
          status: 'error',
          canCreate: false,
          message: 'Budget not found',
          allowDocx: false
        };
      }

      const userView = parseFloat(budgetData.user_view?.toString() || '0');
      const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
      const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');

      // Enhanced threshold checks
      const thresholds = {
        critical: katanomesEtous * 0.1,  // 10% threshold
        warning: katanomesEtous * 0.2,   // 20% threshold
        attention: katanomesEtous * 0.3   // 30% threshold
      };

      // Current amount percentage of annual budget
      const percentageOfAnnual = (amount / katanomesEtous) * 100;

      // Check if current user_view is already below critical threshold
      if (userView <= thresholds.critical) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'CRITICAL: Current budget is below 10% of annual allocation',
          requiresNotification: true,
          notificationType: 'low_budget',
          allowDocx: true,
          priority: 'high',
          metadata: {
            threshold: 'critical',
            currentPercentage: (userView / katanomesEtous) * 100,
            recommendedAction: 'Immediate budget review required'
          }
        };
      }

      if (amount > userView) {
        return {
          status: 'error',
          canCreate: false,
          message: 'Amount exceeds available budget',
          allowDocx: false,
          metadata: {
            available: userView,
            requested: amount,
            shortfall: amount - userView
          }
        };
      }

      const remainingEthsiaPistosi = ethsiaPistosi - amount;
      const remainingUserView = userView - amount;

      // Enhanced notification logic with priority levels
      if (remainingEthsiaPistosi <= thresholds.critical) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'This amount will critically deplete the annual budget',
          requiresNotification: true,
          notificationType: 'funding',
          allowDocx: true,
          priority: 'high',
          metadata: {
            threshold: 'critical',
            remaining: remainingEthsiaPistosi,
            recommendedAction: 'Immediate funding request required'
          }
        };
      }

      if (remainingUserView <= thresholds.warning) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'This amount will reduce the budget below 20% of annual allocation',
          requiresNotification: true,
          notificationType: 'reallocation',
          allowDocx: true,
          priority: 'medium',
          metadata: {
            threshold: 'warning',
            remaining: remainingUserView,
            recommendedAction: 'Budget reallocation review recommended'
          }
        };
      }

      if (remainingUserView <= thresholds.attention) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Budget approaching low threshold',
          requiresNotification: true,
          notificationType: 'threshold_warning',
          allowDocx: true,
          priority: 'low',
          metadata: {
            threshold: 'attention',
            remaining: remainingUserView,
            recommendedAction: 'Monitor budget levels'
          }
        };
      }

      return {
        status: 'success',
        canCreate: true,
        allowDocx: true,
        metadata: {
          remainingAfterOperation: remainingUserView,
          percentageUsed: ((katanomesEtous - remainingUserView) / katanomesEtous) * 100
        }
      };
    } catch (error) {
      console.error('[BudgetService] Budget validation error:', error);
      return {
        status: 'error',
        canCreate: false,
        message: 'Failed to validate budget',
        allowDocx: false
      };
    }
  }

  static async createBudgetNotification(notificationData: {
    mis: string;
    type: 'funding' | 'reallocation' | 'low_budget' | 'threshold_warning';
    amount: number;
    current_budget: number;
    ethsia_pistosi: number;
    reason?: string;
    priority: 'high' | 'medium' | 'low';
    metadata?: Record<string, unknown>;
    created_by: number;
    action_deadline?: Date;
  }) {
    try {
      const { data: notification, error } = await supabase
        .from('budget_notifications')
        .insert([{
          ...notificationData,
          status: 'pending',
          action_required: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Create audit log entry
      await supabase
        .from('budget_history')
        .insert([{
          mis: notificationData.mis,
          change_type: 'notification_created',
          change_reason: `Budget notification created: ${notificationData.type}`,
          created_by: notificationData.created_by,
          created_at: new Date().toISOString(),
          metadata: {
            notification_id: notification.id,
            notification_type: notificationData.type,
            priority: notificationData.priority
          }
        }]);

      return notification;
    } catch (error) {
      console.error('[BudgetService] Create notification error:', error);
      throw error;
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

      // Get current budget data
      const { data: budgetData, error: fetchError } = await supabase
        .from('budget_na853_split')
        .select('user_view, ethsia_pistosi, katanomes_etous')
        .eq('mis', mis)
        .single();

      if (fetchError || !budgetData) {
        throw new Error('Failed to fetch budget data');
      }

      const currentUserView = parseFloat(budgetData.user_view?.toString() || '0');
      const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');

      // Calculate new amounts
      const newUserView = Math.max(0, currentUserView - amount);
      const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - amount);

      // Update budget amounts
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update({
          user_view: newUserView.toString(),
          ethsia_pistosi: newEthsiaPistosi.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('mis', mis);

      if (updateError) {
        throw updateError;
      }

      // Create budget history entry
      const { error: historyError } = await supabase
        .from('budget_history')
        .insert({
          mis,
          previous_amount: currentUserView.toString(),
          new_amount: newUserView.toString(),
          change_type: 'document_creation',
          change_reason: 'Document creation reduced available budget',
          created_by: userId,
          created_at: new Date().toISOString()
        });

      if (historyError) {
        console.error('Failed to create history entry:', historyError);
        // Continue even if history creation fails
      }

      return {
        status: 'success',
        data: {
          user_view: newUserView.toString(),
          ethsia_pistosi: newEthsiaPistosi.toString(),
          q1: '0',
          q2: '0',
          q3: '0',
          q4: '0',
          total_spent: '0',
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
}