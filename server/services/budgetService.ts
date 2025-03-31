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
      
      // Check if the total_spent column exists
      const hasTotalSpent = budgetData && 'total_spent' in budgetData && budgetData.total_spent !== null;
      const totalSpent = hasTotalSpent ? budgetData.total_spent.toString() : '0';
      
      console.log(`[BudgetService] Budget data retrieved for MIS ${mis}, total_spent column exists: ${hasTotalSpent}`);
      
      return {
        status: 'success',
        data: {
          user_view: userView,
          ethsia_pistosi: budgetData?.ethsia_pistosi?.toString() || '0',
          q1: budgetData?.q1?.toString() || '0',
          q2: budgetData?.q2?.toString() || '0',
          q3: budgetData?.q3?.toString() || '0',
          q4: budgetData?.q4?.toString() || '0',
          total_spent: totalSpent, // Handle missing total_spent column
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
      // Input validation with improved error messages
      if (!mis) {
        console.log('[BudgetService] Missing MIS parameter');
        return {
          status: 'error',
          canCreate: false,
          message: 'Απαιτείται ο κωδικός MIS του έργου'
        };
      }
      
      // Check if amount is a valid number and greater than zero
      if (isNaN(amount)) {
        console.log('[BudgetService] Invalid amount parameter (not a number)');
        return {
          status: 'error',
          canCreate: false,
          message: 'Το ποσό πρέπει να είναι αριθμός'
        };
      }
      
      if (amount <= 0) {
        console.log('[BudgetService] Invalid amount parameter (zero or negative)');
        return {
          status: 'error',
          canCreate: false,
          message: 'Το ποσό πρέπει να είναι μεγαλύτερο από 0'
        };
      }

      console.log(`[BudgetService] Validating budget for MIS: ${mis}, amount: ${amount}`);

      // Try to get current budget data
      let { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('user_view, ethsia_pistosi, katanomes_etous, q1, q2, q3, q4')
        .eq('mis', mis)
        .single();

      // If not found directly, try to get project data to find the correct MIS
      if (error || !budgetData) {
        console.log(`[BudgetService] Budget not found directly for MIS: ${mis}, trying project lookup`);
        
        // Try to find project by either its ID or MIS field
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id, mis')
          .or(`id.eq.${mis},mis.eq.${mis}`)
          .single();
        
        if (projectError) {
          console.log(`[BudgetService] Project not found for MIS/ID: ${mis}`);
        } else if (projectData?.mis) {
          console.log(`[BudgetService] Found project with MIS: ${projectData.mis}`);
          
          // Try again with the project's MIS value
          const retryResult = await supabase
            .from('budget_na853_split')
            .select('user_view, ethsia_pistosi, katanomes_etous, q1, q2, q3, q4')
            .eq('mis', projectData.mis)
            .single();
            
          budgetData = retryResult.data;
          error = retryResult.error;
        }
      }

      // If we still don't have budget data, return a warning but allow document creation
      if (error || !budgetData) {
        console.log(`[BudgetService] Budget not found for MIS: ${mis} after lookup attempts`);
        
        return {
          status: 'warning',
          canCreate: true, // Allow document creation even without budget data
          message: 'Ο προϋπολογισμός δεν βρέθηκε για αυτό το MIS. Η δημιουργία εγγράφου επιτρέπεται χωρίς έλεγχο προϋπολογισμού.',
          allowDocx: true
        };
      }

      // Parse budget values and handle potential null/undefined values
      const userView = parseFloat(budgetData.user_view?.toString() || '0');
      const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
      const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');
      
      // Get quarterly data 
      const q1 = parseFloat(budgetData.q1?.toString() || '0');
      const q2 = parseFloat(budgetData.q2?.toString() || '0');
      const q3 = parseFloat(budgetData.q3?.toString() || '0');
      const q4 = parseFloat(budgetData.q4?.toString() || '0');
      
      // Ensure we have at least some budget data
      if (userView === 0 && katanomesEtous === 0 && ethsiaPistosi === 0) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Ο προϋπολογισμός του έργου έχει μηδενικές τιμές. Η δημιουργία εγγράφου επιτρέπεται με προσοχή.',
          allowDocx: true,
          metadata: {
            budgetValues: { userView, ethsiaPistosi, katanomesEtous, q1, q2, q3, q4 }
          }
        };
      }

      // Calculate remaining budget after the operation
      const remainingAfterOperation = userView - amount;
      
      // If remaining amount is negative, return an error
      if (remainingAfterOperation < 0) {
        return {
          status: 'error',
          canCreate: false,
          message: `Ανεπαρκές διαθέσιμο υπόλοιπο προϋπολογισμού. Διαθέσιμο: ${userView}, Απαιτούμενο: ${amount}`,
          metadata: {
            available: userView,
            requested: amount,
            shortfall: Math.abs(remainingAfterOperation)
          }
        };
      }

      // Calculate 20% threshold of katanomes_etous (or ethsia_pistosi if katanomes_etous is 0)
      const baseValue = katanomesEtous > 0 ? katanomesEtous : ethsiaPistosi;
      const threshold = baseValue * 0.2;
      
      // Check if remaining budget falls below 20% threshold
      if (remainingAfterOperation <= threshold && baseValue > 0) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Ο προϋπολογισμός θα πέσει κάτω από το 20% της ετήσιας κατανομής. Απαιτείται ειδοποίηση διαχειριστή.',
          requiresNotification: true,
          notificationType: 'low_budget',
          priority: 'high',
          allowDocx: true,
          metadata: {
            remainingBudget: remainingAfterOperation,
            threshold: threshold,
            baseValue: baseValue,
            percentageRemaining: (remainingAfterOperation / baseValue) * 100
          }
        };
      }
      
      // Check if budget is getting low (below 30%)
      if (remainingAfterOperation <= baseValue * 0.3 && baseValue > 0) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Ο προϋπολογισμός είναι χαμηλός (κάτω από 30% της ετήσιας κατανομής).',
          requiresNotification: false,
          allowDocx: true,
          metadata: {
            remainingBudget: remainingAfterOperation,
            threshold: baseValue * 0.3,
            baseValue: baseValue,
            percentageRemaining: (remainingAfterOperation / baseValue) * 100
          }
        };
      }

      // All checks passed, return success
      return {
        status: 'success',
        canCreate: true,
        allowDocx: true,
        message: 'Επαρκής προϋπολογισμός για τη δημιουργία του εγγράφου.',
        metadata: {
          remainingBudget: remainingAfterOperation,
          previousBudget: userView,
          baseValue: baseValue,
          percentageRemaining: baseValue > 0 ? (remainingAfterOperation / baseValue) * 100 : 100
        }
      };
    } catch (error) {
      console.error('[BudgetService] Budget validation error:', error);
      // In case of unexpected errors, still allow document creation but with a warning
      return {
        status: 'warning',
        canCreate: true,
        message: 'Σφάλμα κατά την επικύρωση του προϋπολογισμού. Η δημιουργία εγγράφου επιτρέπεται με προσοχή.',
        allowDocx: true,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async updateBudget(mis: string, amount: number, userId: number, documentId?: number, changeReason?: string): Promise<BudgetResponse> {
    try {
      if (!mis || isNaN(amount) || amount <= 0 || !userId) {
        return {
          status: 'error',
          message: 'Missing required parameters'
        };
      }

      console.log(`[BudgetService] Updating budget for MIS: ${mis}, amount: ${amount}, userId: ${userId}, documentId: ${documentId || 'none'}`);

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
        
        // Even though we couldn't find the budget, log the attempted operation in budget_history
        try {
          await supabase
            .from('budget_history')
            .insert({
              mis,
              previous_amount: '0',
              new_amount: '0',
              change_type: documentId ? 'document_creation' : 'manual_adjustment',
              change_reason: changeReason || 'Budget update attempted but no budget record found',
              document_id: documentId || null,
              created_by: userId,
              metadata: {
                error: 'Budget record not found',
                attempted_deduction: amount
              }
            });
        } catch (historyError) {
          console.error('[BudgetService] Failed to create history entry for missing budget:', historyError);
        }
        
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
      const currentKatanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');
      const total_spent = parseFloat(budgetData.total_spent?.toString() || '0');

      // Get current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const quarterKey = `q${Math.ceil(currentMonth / 3)}` as 'q1' | 'q2' | 'q3' | 'q4';

      // Parse current quarter values
      const currentQ1 = parseFloat(budgetData.q1?.toString() || '0');
      const currentQ2 = parseFloat(budgetData.q2?.toString() || '0');
      const currentQ3 = parseFloat(budgetData.q3?.toString() || '0');
      const currentQ4 = parseFloat(budgetData.q4?.toString() || '0');
      const currentQuarterValue = parseFloat(budgetData[quarterKey]?.toString() || '0');
      
      // Check for quarter transitions by looking at the last_quarter_check field
      const lastQuarterCheck = budgetData.last_quarter_check?.toString() || '';
      const lastQuarterChecked = lastQuarterCheck ? parseInt(lastQuarterCheck.charAt(1)) : 0;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const isQuarterTransition = lastQuarterChecked > 0 && lastQuarterChecked < currentQuarterNumber;
      
      console.log(`[BudgetService] Quarter check - Last: ${lastQuarterChecked}, Current: ${currentQuarterNumber}, Transition: ${isQuarterTransition}`);
      
      // If quarter has changed, calculate remaining budgets from previous quarters
      let remainingBudget = 0;
      if (isQuarterTransition) {
        // Calculate the remaining budget from previous quarters to add to current quarter
        if (lastQuarterChecked === 1 && currentQuarterNumber === 2) {
          remainingBudget = Math.max(0, currentQ1); // Remaining from Q1
          console.log(`[BudgetService] Quarter transition from Q1 to Q2 - Remaining budget: ${remainingBudget}`);
        } else if (lastQuarterChecked === 2 && currentQuarterNumber === 3) {
          remainingBudget = Math.max(0, currentQ2); // Remaining from Q2
          console.log(`[BudgetService] Quarter transition from Q2 to Q3 - Remaining budget: ${remainingBudget}`);
        } else if (lastQuarterChecked === 3 && currentQuarterNumber === 4) {
          remainingBudget = Math.max(0, currentQ3); // Remaining from Q3
          console.log(`[BudgetService] Quarter transition from Q3 to Q4 - Remaining budget: ${remainingBudget}`);
        }
      }
      
      // Calculate new amounts
      const newUserView = Math.max(0, currentUserView - amount);
      const newQuarterValue = Math.max(0, currentQuarterValue + remainingBudget - amount); // Add remaining budget from previous quarter if applicable
      
      // These values should not be updated by document creation operations
      const newEthsiaPistosi = currentEthsiaPistosi; // Do not change ethsia_pistosi
      const newKatanomesEtous = currentKatanomesEtous; // Do not change katanomes_etous
      const newTotalSpent = total_spent + amount;

      // Check if the total_spent column exists by querying the first row
      console.log(`[BudgetService] Checking if total_spent column exists in budget_na853_split`);
      const { data: columnCheckData, error: columnCheckError } = await supabase
        .from('budget_na853_split')
        .select('total_spent')
        .limit(1);
        
      const hasTotalSpentColumn = !columnCheckError && columnCheckData !== null;
      console.log(`[BudgetService] total_spent column exists: ${hasTotalSpentColumn}`);
      
      // Prepare update payload based on available columns
      const updatePayload: any = {
        // Update user_view field and quarterly values as per requirement
        // Do not update the katanomes_etous or ethsia_pistosi fields (they are reference values)
        user_view: newUserView.toString(),
        [quarterKey]: newQuarterValue.toString(),
        last_quarter_check: quarterKey, // Update the last quarter check to track transitions
        updated_at: new Date().toISOString()
      };
      
      // Only include total_spent if the column exists
      if (hasTotalSpentColumn) {
        updatePayload.total_spent = newTotalSpent.toString();
      }
      
      // Update budget amounts
      console.log(`[BudgetService] Updating budget_na853_split with payload:`, JSON.stringify(updatePayload, null, 2));
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update(updatePayload)
        .eq('mis', mis);

      if (updateError) {
        throw updateError;
      }

      // Create a budget history entry without the metadata field
      // Extract important details separately
      const quarterChanges = {
        q1: { previous: currentQ1, new: quarterKey === 'q1' ? newQuarterValue : currentQ1 },
        q2: { previous: currentQ2, new: quarterKey === 'q2' ? newQuarterValue : currentQ2 },
        q3: { previous: currentQ3, new: quarterKey === 'q3' ? newQuarterValue : currentQ3 },
        q4: { previous: currentQ4, new: quarterKey === 'q4' ? newQuarterValue : currentQ4 }
      };
      
      // Create history entry with only the fields that exist in the table
      const historyEntry = {
        mis,
        previous_amount: currentUserView.toString(),
        new_amount: newUserView.toString(),
        change_type: documentId ? 'document_creation' : 'manual_adjustment',
        change_reason: changeReason || (documentId ? 
          `Document creation [ID:${documentId}] reduced available budget by ${amount}. Current quarter: ${quarterKey}${isQuarterTransition ? `. Quarter transition detected from q${lastQuarterChecked} to q${currentQuarterNumber}, ${remainingBudget} budget transferred.` : ''}` : 
          `Manual budget adjustment reduced available budget by ${amount}. Current quarter: ${quarterKey}${isQuarterTransition ? `. Quarter transition detected from q${lastQuarterChecked} to q${currentQuarterNumber}, ${remainingBudget} budget transferred.` : ''}`),
        document_id: documentId || null,
        created_by: userId.toString()
      };

      console.log(`[BudgetService] Creating budget history entry for MIS ${mis} with change_type: ${historyEntry.change_type}, document_id: ${historyEntry.document_id}, created_by: ${historyEntry.created_by}`);
      
      // Insert the history entry and log the exact payload
      console.log(`[BudgetService] Sending budget history entry to database:`, JSON.stringify(historyEntry, null, 2));
      const { error: historyError, data: historyData } = await supabase
        .from('budget_history')
        .insert(historyEntry)
        .select();

      if (historyError) {
        console.error('[BudgetService] Failed to create budget history entry:', historyError);
        console.error('[BudgetService] Error details:', historyError.message, historyError.details);
        // Continue execution even if history logging fails
      } else {
        console.log('[BudgetService] Budget history entry created successfully with ID:', historyData?.[0]?.id);
      }

      return {
        status: 'success',
        data: {
          user_view: newUserView.toString(),
          ethsia_pistosi: newEthsiaPistosi.toString(),
          q1: quarterKey === 'q1' ? newQuarterValue.toString() : budgetData.q1?.toString() || '0',
          q2: quarterKey === 'q2' ? newQuarterValue.toString() : budgetData.q2?.toString() || '0',
          q3: quarterKey === 'q3' ? newQuarterValue.toString() : budgetData.q3?.toString() || '0',
          q4: quarterKey === 'q4' ? newQuarterValue.toString() : budgetData.q4?.toString() || '0',
          total_spent: newTotalSpent.toString(),
          current_budget: newUserView.toString()
        }
      };
    } catch (error) {
      console.error('[BudgetService] Budget update error:', error);
      
      // Even on error, try to log the attempted operation
      try {
        await supabase
          .from('budget_history')
          .insert({
            mis,
            previous_amount: '0',
            new_amount: '0',
            change_type: 'error',
            change_reason: `Budget update failed: ${error instanceof Error ? error.message : 'Unknown error'}. Attempted deduction: ${amount}`,
            document_id: documentId || null,
            created_by: userId.toString()
          });
      } catch (historyError) {
        console.error('[BudgetService] Failed to create error history entry:', historyError);
      }
      
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update budget'
      };
    }
  }

  static async getNotifications() {
    try {
      console.log('[BudgetService] Fetching notifications...');

      // Use a more robust approach to fetch data from Supabase
      try {
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
          sample: transformedData.length > 0 ? 'sample exists' : 'no data'
        });

        return transformedData;
      } catch (innerError) {
        // If data from Supabase fails with an unexpected error, log and return empty array
        console.error('[BudgetService] Unexpected error in supabase query:', innerError);
        return [];
      }
    } catch (error) {
      console.error('[BudgetService] Error in getNotifications:', error);
      // Return empty array instead of throwing error
      return [];
    }
  }
}