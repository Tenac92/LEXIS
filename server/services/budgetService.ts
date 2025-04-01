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
    // New fields for quarter transition support
    quarter_view?: string;
    last_quarter_check?: string;
    current_quarter?: string;
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
      
      // Get current quarter
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const quarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';

      // Check for quarter-related fields
      const hasQuarterView = budgetData && 'quarter_view' in budgetData && budgetData.quarter_view !== null;
      const hasLastQuarterCheck = budgetData && 'last_quarter_check' in budgetData && budgetData.last_quarter_check !== null;
      
      console.log(`[BudgetService] Budget data fields: total_spent=${hasTotalSpent}, quarter_view=${hasQuarterView}, last_quarter_check=${hasLastQuarterCheck}`);

      // Parse current quarter values
      const currentQ1 = parseFloat(budgetData?.q1?.toString() || '0');
      const currentQ2 = parseFloat(budgetData?.q2?.toString() || '0');
      const currentQ3 = parseFloat(budgetData?.q3?.toString() || '0');
      const currentQ4 = parseFloat(budgetData?.q4?.toString() || '0');
      let currentQuarterView = parseFloat(budgetData?.quarter_view?.toString() || '0');
      
      // Get current trimester value
      const currentTrimesterValue = parseFloat(budgetData?.[quarterKey]?.toString() || '0');
      
      // Extract the quarter number from the last_quarter_check (e.g., extract '1' from 'q1')
      const lastQuarterCheck = hasLastQuarterCheck 
        ? budgetData.last_quarter_check?.toString() || `q${currentQuarterNumber}`
        : `q${currentQuarterNumber}`;
      
      const lastQuarterChecked = lastQuarterCheck && lastQuarterCheck.startsWith('q') 
        ? parseInt(lastQuarterCheck.substring(1)) 
        : 0;
      
      // Check if we need to reset quarter_view for the new year
      const lastUpdatedTime = budgetData?.updated_at ? new Date(budgetData.updated_at) : null;
      const lastUpdatedYear = lastUpdatedTime ? lastUpdatedTime.getFullYear() : currentYear;
      
      // Check if we need to reset quarter_view (new year)
      let isNewYear = lastUpdatedYear < currentYear;
      if (isNewYear) {
        console.log(`[BudgetService] Detected new year (${lastUpdatedYear} -> ${currentYear}), resetting quarter_view`);
      }
      
      // Check for quarter transition (e.g., Q1->Q2)
      const isQuarterTransition = lastQuarterChecked > 0 && lastQuarterChecked < currentQuarterNumber;
      
      console.log(`[BudgetService] Quarter check - Last checked: ${lastQuarterChecked}, Current: ${currentQuarterNumber}, Transition: ${isQuarterTransition}, New Year: ${isNewYear}`);
      
      let needsUpdate = false;
      let updatedUserView = parseFloat(userView);
      let updatedQ1 = currentQ1;
      let updatedQ2 = currentQ2;
      let updatedQ3 = currentQ3;
      let updatedQ4 = currentQ4;
      let updatedQuarterView = currentQuarterView;
      
      // Handle new year reset
      if (isNewYear) {
        needsUpdate = true;
        updatedQuarterView = 0; // Reset quarter_view to 0 for the new year
        console.log(`[BudgetService] Resetting quarter_view to 0 for new year ${currentYear}`);
      }
      
      // Handle quarter transitions
      if (isQuarterTransition) {
        needsUpdate = true;
        
        // Calculate the quarter transition (add previous quarter value to current quarter)
        if (lastQuarterChecked === 1 && currentQuarterNumber === 2) {
          // Q1->Q2 transition
          console.log(`[BudgetService] Quarter transition from Q1 to Q2 - q1 value: ${currentQ1}, adding to q2: ${currentQ2}`);
          
          // Apply the new quarter transition logic: q2=q2+q1
          updatedQ2 = currentQ2 + currentQ1;
          updatedQ1 = 0; // Reset q1 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q1->Q2 transition:`, {
            q1: `${currentQ1} -> ${updatedQ1}`,
            q2: `${currentQ2} -> ${updatedQ2}`,
            quarter_view: `${currentQuarterView} -> ${updatedQuarterView}`
          });
          
        } else if (lastQuarterChecked === 2 && currentQuarterNumber === 3) {
          // Q2->Q3 transition
          console.log(`[BudgetService] Quarter transition from Q2 to Q3 - q2 value: ${currentQ2}, adding to q3: ${currentQ3}`);
          
          // Apply the new quarter transition logic: q3=q3+q2
          updatedQ3 = currentQ3 + currentQ2;
          updatedQ2 = 0; // Reset q2 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q2->Q3 transition:`, {
            q2: `${currentQ2} -> ${updatedQ2}`,
            q3: `${currentQ3} -> ${updatedQ3}`,
            quarter_view: `${currentQuarterView} -> ${updatedQuarterView}`
          });
          
        } else if (lastQuarterChecked === 3 && currentQuarterNumber === 4) {
          // Q3->Q4 transition
          console.log(`[BudgetService] Quarter transition from Q3 to Q4 - q3 value: ${currentQ3}, adding to q4: ${currentQ4}`);
          
          // Apply the new quarter transition logic: q4=q4+q3
          updatedQ4 = currentQ4 + currentQ3;
          updatedQ3 = 0; // Reset q3 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q3->Q4 transition:`, {
            q3: `${currentQ3} -> ${updatedQ3}`,
            q4: `${currentQ4} -> ${updatedQ4}`,
            quarter_view: `${currentQuarterView} -> ${updatedQuarterView}`
          });
        }
      }
      
      // Update the budget data if needed
      if (needsUpdate) {
        const updatePayload: any = {
          q1: updatedQ1.toString(),
          q2: updatedQ2.toString(),
          q3: updatedQ3.toString(),
          q4: updatedQ4.toString(),
          quarter_view: updatedQuarterView.toString(),
          last_quarter_check: `q${currentQuarterNumber}`,
          updated_at: new Date().toISOString()
        };
        
        console.log(`[BudgetService] Automatically updating budget data due to quarter transition or empty quarter_view:`, updatePayload);
        
        const { error: updateError } = await supabase
          .from('budget_na853_split')
          .update(updatePayload)
          .eq('mis', mis);
          
        if (updateError) {
          console.error(`[BudgetService] Error updating budget data:`, updateError);
        } else {
          console.log(`[BudgetService] Successfully updated budget data with quarter transition values`);
          
          // After updating, return the updated values
          return {
            status: 'success',
            data: {
              user_view: updatedUserView.toString(),
              ethsia_pistosi: budgetData?.ethsia_pistosi?.toString() || '0',
              q1: updatedQ1.toString(),
              q2: updatedQ2.toString(),
              q3: updatedQ3.toString(),
              q4: updatedQ4.toString(),
              total_spent: totalSpent,
              current_budget: updatedUserView.toString(),
              quarter_view: updatedQuarterView.toString(),
              last_quarter_check: `q${currentQuarterNumber}`,
              current_quarter: quarterKey
            }
          };
        }
      }
      
      // If no update was needed or if the update failed, return the original values
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
          current_budget: userView, // Set current_budget to match user_view
          quarter_view: hasQuarterView ? budgetData.quarter_view?.toString() : budgetData?.[quarterKey]?.toString() || '0',
          last_quarter_check: lastQuarterCheck, // Add last_quarter_check
          current_quarter: quarterKey // Add current_quarter information
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
      
      // Check for quarter transitions using the last_quarter_check column
      const lastQuarterCheck = budgetData.last_quarter_check?.toString() || '';
      // Extract the quarter number from the text (e.g., extract '1' from 'q1')
      const lastQuarterChecked = lastQuarterCheck && lastQuarterCheck.startsWith('q') 
        ? parseInt(lastQuarterCheck.substring(1)) 
        : 0;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const isQuarterTransition = lastQuarterChecked > 0 && lastQuarterChecked < currentQuarterNumber;
      
      console.log(`[BudgetService] Quarter check - Last checked: ${lastQuarterChecked}, Current: ${currentQuarterNumber}, Transition: ${isQuarterTransition}`);
      
      // Calculate remaining budget from previous quarters if a transition occurred
      let remainingBudget = 0;
      // Define new quarter values with defaults from current values
      let newQ1 = currentQ1;
      let newQ2 = currentQ2;
      let newQ3 = currentQ3;
      let newQ4 = currentQ4;
      let newQuarterView = parseFloat(budgetData.quarter_view?.toString() || '0');
      
      if (isQuarterTransition) {
        // Calculate the remaining budget from previous quarters to add to current quarter
        if (lastQuarterChecked === 1 && currentQuarterNumber === 2) {
          // Use quarter_view instead of q1 directly to get app-specific usage
          const quarterView = parseFloat(budgetData.quarter_view?.toString() || budgetData.q1?.toString() || '0');
          remainingBudget = Math.max(0, quarterView); // Remaining from Q1
          console.log(`[BudgetService] Quarter transition from Q1 to Q2 - Remaining budget: ${remainingBudget}`);
          
          // Apply the quarter transition logic: q2=q2+quarter_view, quarter_view=quarter_view+q2, q1=0
          newQ2 = currentQ2 + remainingBudget;
          newQuarterView = newQ2; // Reset quarter_view to match the new quarter
          newQ1 = 0; // Reset q1 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q1->Q2 transition:`, {
            q1: `${currentQ1} -> ${newQ1}`,
            q2: `${currentQ2} -> ${newQ2}`,
            quarter_view: `${quarterView} -> ${newQuarterView}`
          });
          
        } else if (lastQuarterChecked === 2 && currentQuarterNumber === 3) {
          // Use quarter_view instead of q2 directly
          const quarterView = parseFloat(budgetData.quarter_view?.toString() || budgetData.q2?.toString() || '0');
          remainingBudget = Math.max(0, quarterView); // Remaining from Q2
          console.log(`[BudgetService] Quarter transition from Q2 to Q3 - Remaining budget: ${remainingBudget}`);
          
          // Apply the quarter transition logic: q3=q3+quarter_view, quarter_view=quarter_view+q3, q2=0
          newQ3 = currentQ3 + remainingBudget;
          newQuarterView = newQ3; // Reset quarter_view to match the new quarter
          newQ2 = 0; // Reset q2 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q2->Q3 transition:`, {
            q2: `${currentQ2} -> ${newQ2}`,
            q3: `${currentQ3} -> ${newQ3}`,
            quarter_view: `${quarterView} -> ${newQuarterView}`
          });
          
        } else if (lastQuarterChecked === 3 && currentQuarterNumber === 4) {
          // Use quarter_view instead of q3 directly
          const quarterView = parseFloat(budgetData.quarter_view?.toString() || budgetData.q3?.toString() || '0');
          remainingBudget = Math.max(0, quarterView); // Remaining from Q3
          console.log(`[BudgetService] Quarter transition from Q3 to Q4 - Remaining budget: ${remainingBudget}`);
          
          // Apply the quarter transition logic: q4=q4+quarter_view, quarter_view=quarter_view+q4, q3=0
          newQ4 = currentQ4 + remainingBudget;
          newQuarterView = newQ4; // Reset quarter_view to match the new quarter
          newQ3 = 0; // Reset q3 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q3->Q4 transition:`, {
            q3: `${currentQ3} -> ${newQ3}`,
            q4: `${currentQ4} -> ${newQ4}`,
            quarter_view: `${quarterView} -> ${newQuarterView}`
          });
        }
      }
      
      // Calculate new amounts - we need to update the user view with deduction but maintain quarter handling
      const newUserView = Math.max(0, currentUserView - amount);
      
      // Calculate the new quarter value for the current quarter
      // For the current quarter, apply the deduction
      let newQuarterValue;
      if (quarterKey === 'q1') {
        newQuarterValue = Math.max(0, newQ1 - amount);
        newQ1 = newQuarterValue;
      } else if (quarterKey === 'q2') {
        newQuarterValue = Math.max(0, newQ2 - amount);
        newQ2 = newQuarterValue;
      } else if (quarterKey === 'q3') {
        newQuarterValue = Math.max(0, newQ3 - amount);
        newQ3 = newQuarterValue;
      } else { // q4
        newQuarterValue = Math.max(0, newQ4 - amount);
        newQ4 = newQuarterValue;
      }
      
      // After deduction, update the quarter_view
      newQuarterView = Math.max(0, newQuarterView - amount);
      
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
        q1: newQ1.toString(),
        q2: newQ2.toString(),
        q3: newQ3.toString(),
        q4: newQ4.toString(),
        updated_at: new Date().toISOString(),
        // Update the last_quarter_check to current quarter (text format)
        last_quarter_check: `q${currentQuarterNumber}`,
        // Update quarter_view with the newly calculated value based on quarter transitions
        quarter_view: newQuarterView.toString()
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
          `Document creation [ID:${documentId}] reduced available budget by ${amount}. Current quarter: ${quarterKey}` : 
          `Manual budget adjustment reduced available budget by ${amount}. Current quarter: ${quarterKey}`),
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
          q1: newQ1.toString(),
          q2: newQ2.toString(),
          q3: newQ3.toString(),
          q4: newQ4.toString(),
          total_spent: newTotalSpent.toString(),
          current_budget: newUserView.toString(),
          quarter_view: newQuarterView.toString(),
          last_quarter_check: `q${currentQuarterNumber}`
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