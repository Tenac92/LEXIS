import { supabase } from '../config/db';
import type { Database } from '@shared/schema';

/**
 * Helper function to parse numerical values with European number formatting
 * Example: "22.000,00" -> 22000.00
 * Also handles US format: "22,000.50" -> 22000.50
 */
function parseEuropeanNumber(value: any): number {
  if (!value) return 0;
  
  // Convert to string if it's not already
  const strValue = value.toString().trim();
  
  // Return 0 for empty strings
  if (!strValue) return 0;
  
  // Check if the string has both periods and commas
  if (strValue.includes('.') && strValue.includes(',')) {
    // Check if it's European format with comma as decimal separator (e.g., "22.000,00")
    if (strValue.lastIndexOf(',') > strValue.lastIndexOf('.')) {
      // European format: replace dots with nothing (remove thousands separators) and commas with dots (decimal separator)
      const normalizedStr = strValue.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalizedStr);
    }
    // Otherwise it's likely US format with comma as thousands separator (e.g., "22,000.50")
    else {
      // US format: remove all commas
      const normalizedStr = strValue.replace(/,/g, '');
      return parseFloat(normalizedStr);
    }
  }
  
  // If it's just a comma as decimal separator (e.g., "22,50")
  if (strValue.includes(',') && !strValue.includes('.')) {
    return parseFloat(strValue.replace(',', '.'));
  }
  
  // Default case: try regular parseFloat
  return parseFloat(strValue);
}

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
    // New budget indicators
    available_budget?: string;
    quarter_available?: string;
    yearly_available?: string;
    // Quarter tracking
    last_quarter_check?: string;
    current_quarter?: string;
    // JSON sum field for metadata
    sum?: any;
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

// Interface for budget change analysis returned by analyzeChangesBetweenUpdates
export interface BudgetChangeAnalysis {
  status: 'success' | 'error';
  mis: string;
  isReallocation: boolean;
  changeType: 'funding_increase' | 'funding_decrease' | 'reallocation' | 'no_change';
  beforeUpdate: {
    available_budget: number;
    quarter_available: number;
    yearly_available: number;
    katanomes_etous: number;
    ethsia_pistosi: number;
    user_view: number;
    current_quarter: number;
  } | null;
  afterUpdate: {
    available_budget: number;
    quarter_available: number;
    yearly_available: number;
    katanomes_etous: number;
    ethsia_pistosi: number;
    user_view: number;
    current_quarter: number;
  };
  changes: {
    available_budget_diff: number;
    quarter_available_diff: number;
    yearly_available_diff: number;
    katanomes_etous_diff: number;
    ethsia_pistosi_diff: number;
  };
  message?: string;
  error?: string;
}

export class BudgetService {
  /**
   * Analyzes changes between admin budget updates by comparing the sum JSON column
   * with current budget values. This is used to handle anakatanomh (reallocation) requests.
   * 
   * @param mis The MIS project code
   * @returns Analysis of changes between updates
   */
  static async analyzeChangesBetweenUpdates(mis: string): Promise<BudgetChangeAnalysis> {
    try {
      if (!mis) {
        return {
          status: 'error',
          mis: '',
          isReallocation: false,
          changeType: 'no_change',
          beforeUpdate: null,
          afterUpdate: {
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            user_view: 0,
            current_quarter: 0
          },
          changes: {
            available_budget_diff: 0,
            quarter_available_diff: 0,
            yearly_available_diff: 0,
            katanomes_etous_diff: 0,
            ethsia_pistosi_diff: 0,
          },
          error: 'MIS parameter is required'
        };
      }

      // Check if the MIS is purely numeric or has a project code format
      let misToSearch = mis;
      let isProjectCode = false;

      // Check if MIS might be a project ID with a code pattern (e.g., "2024ΝΑ85300001")
      if (mis.match(/^\d{4}[Α-Ωα-ωA-Za-z]+\d+$/)) {
        console.log(`[BudgetService] analyzeChangesBetweenUpdates: MIS appears to be a project code pattern: ${mis}`);
        isProjectCode = true;
        
        // If it matches a project code pattern, try to get its numeric MIS from Projects table
        try {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', mis)
            .single();
            
          if (projectData?.mis) {
            console.log(`[BudgetService] analyzeChangesBetweenUpdates: Found numeric MIS ${projectData.mis} for project code ${mis}`);
            misToSearch = projectData.mis;
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] analyzeChangesBetweenUpdates: Error looking up project by ID ${mis}:`, projectLookupError);
          // Continue with original MIS if lookup fails
        }
      }

      console.log(`[BudgetService] Analyzing changes for MIS ${misToSearch}`);

      // Get current budget data with sum column
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_na853_split')
        .select('*, sum')
        .eq('mis', misToSearch)
        .single();

      if (budgetError || !budgetData) {
        return {
          status: 'error',
          mis,
          isReallocation: false,
          changeType: 'no_change',
          beforeUpdate: null,
          afterUpdate: {
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            user_view: 0,
            current_quarter: 0
          },
          changes: {
            available_budget_diff: 0,
            quarter_available_diff: 0,
            yearly_available_diff: 0,
            katanomes_etous_diff: 0,
            ethsia_pistosi_diff: 0,
          },
          error: budgetError ? budgetError.message : 'Budget data not found'
        };
      }

      // Get current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const quarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';
      
      // Get current quarter value
      let currentQuarterValue;
      switch(quarterKey) {
        case 'q1': currentQuarterValue = budgetData.q1 || 0; break;
        case 'q2': currentQuarterValue = budgetData.q2 || 0; break;
        case 'q3': currentQuarterValue = budgetData.q3 || 0; break;
        case 'q4': currentQuarterValue = budgetData.q4 || 0; break;
        default: currentQuarterValue = 0;
      }

      // Current values - use parseEuropeanNumber to handle European number format (e.g., "22.000,00")
      const userView = parseEuropeanNumber(budgetData.user_view);
      const katanomesEtous = parseEuropeanNumber(budgetData.katanomes_etous);
      const ethsiaPistosi = parseEuropeanNumber(budgetData.ethsia_pistosi);
      
      // Calculate current budget indicators
      const availableBudget = Math.max(0, katanomesEtous - userView);
      const quarterAvailable = Math.max(0, currentQuarterValue - userView);
      const yearlyAvailable = Math.max(0, ethsiaPistosi - userView);

      // Check if we have stored values in sum
      const hasSumData = budgetData.sum && typeof budgetData.sum === 'object';
      
      // If no sum data, we can't do analysis
      if (!hasSumData) {
        return {
          status: 'error',
          mis,
          isReallocation: false,
          changeType: 'no_change',
          beforeUpdate: null,
          afterUpdate: {
            available_budget: availableBudget,
            quarter_available: quarterAvailable,
            yearly_available: yearlyAvailable,
            katanomes_etous: katanomesEtous,
            ethsia_pistosi: ethsiaPistosi,
            user_view: userView,
            current_quarter: currentQuarterNumber
          },
          changes: {
            available_budget_diff: 0,
            quarter_available_diff: 0,
            yearly_available_diff: 0,
            katanomes_etous_diff: 0,
            ethsia_pistosi_diff: 0,
          },
          message: 'No previous budget data available for comparison'
        };
      }

      // Previous values from sum - use parseEuropeanNumber to handle European number format
      const prevSum = budgetData.sum as any;
      const prevAvailableBudget = parseEuropeanNumber(prevSum.available_budget);
      const prevQuarterAvailable = parseEuropeanNumber(prevSum.quarter_available);
      const prevYearlyAvailable = parseEuropeanNumber(prevSum.yearly_available);
      const prevKatanomesEtous = parseEuropeanNumber(prevSum.katanomes_etous);
      const prevEthsiaPistosi = parseEuropeanNumber(prevSum.ethsia_pistosi);
      const prevUserView = parseEuropeanNumber(prevSum.user_view);
      const prevQuarter = parseInt(prevSum.current_quarter?.toString() || '0');

      // Calculate differences
      const availableBudgetDiff = availableBudget - prevAvailableBudget;
      const quarterAvailableDiff = quarterAvailable - prevQuarterAvailable;
      const yearlyAvailableDiff = yearlyAvailable - prevYearlyAvailable;
      const katanomesEtousDiff = katanomesEtous - prevKatanomesEtous;
      const ethsiaPistosiDiff = ethsiaPistosi - prevEthsiaPistosi;

      // Determine change type
      let changeType: 'funding_increase' | 'funding_decrease' | 'reallocation' | 'no_change' = 'no_change';
      let isReallocation = false;

      if (Math.abs(katanomesEtousDiff) < 0.01 && Math.abs(ethsiaPistosiDiff) < 0.01) {
        // No significant change in overall funding
        changeType = 'no_change';
      } else if (katanomesEtousDiff > 0 && ethsiaPistosiDiff >= 0) {
        // Funding increase
        changeType = 'funding_increase';
      } else if (katanomesEtousDiff < 0 && ethsiaPistosiDiff <= 0) {
        // Funding decrease
        changeType = 'funding_decrease';
      } else {
        // Reallocation (anakatanomh)
        changeType = 'reallocation';
        isReallocation = true;
        
        // If this is a reallocation, try to resolve any pending reallocation notifications
        await this.resolveReallocationNotifications(misToSearch, katanomesEtousDiff);
      }

      return {
        status: 'success',
        mis,
        isReallocation,
        changeType,
        beforeUpdate: {
          available_budget: prevAvailableBudget,
          quarter_available: prevQuarterAvailable,
          yearly_available: prevYearlyAvailable,
          katanomes_etous: prevKatanomesEtous,
          ethsia_pistosi: prevEthsiaPistosi,
          user_view: prevUserView,
          current_quarter: prevQuarter
        },
        afterUpdate: {
          available_budget: availableBudget,
          quarter_available: quarterAvailable,
          yearly_available: yearlyAvailable,
          katanomes_etous: katanomesEtous,
          ethsia_pistosi: ethsiaPistosi,
          user_view: userView,
          current_quarter: currentQuarterNumber
        },
        changes: {
          available_budget_diff: availableBudgetDiff,
          quarter_available_diff: quarterAvailableDiff,
          yearly_available_diff: yearlyAvailableDiff,
          katanomes_etous_diff: katanomesEtousDiff,
          ethsia_pistosi_diff: ethsiaPistosiDiff
        },
        message: `Analysis completed for MIS ${mis}. Change type: ${changeType}.`
      };
    } catch (error) {
      console.error('[BudgetService] Error analyzing budget changes:', error);
      return {
        status: 'error',
        mis,
        isReallocation: false,
        changeType: 'no_change',
        beforeUpdate: null,
        afterUpdate: {
          available_budget: 0,
          quarter_available: 0,
          yearly_available: 0,
          katanomes_etous: 0,
          ethsia_pistosi: 0,
          user_view: 0,
          current_quarter: 0
        },
        changes: {
          available_budget_diff: 0,
          quarter_available_diff: 0,
          yearly_available_diff: 0,
          katanomes_etous_diff: 0,
          ethsia_pistosi_diff: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async getBudget(mis: string): Promise<BudgetResponse> {
    try {
      if (!mis) {
        return {
          status: 'error',
          message: 'MIS parameter is required'
        };
      }

      // Check if the MIS is purely numeric or has a project code format
      let misToSearch = mis;
      let tryNumericMis = false;

      // Check if the MIS might be a project ID with a code pattern (e.g., "2024ΝΑ85300001")
      if (mis.match(/^\d{4}[Α-Ωα-ωA-Za-z]+\d+$/)) {
        console.log(`[BudgetService] MIS appears to be a project code pattern: ${mis}`);
        
        // If it matches a project code pattern, try to get its numeric MIS from Projects table
        try {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', mis)
            .single();
            
          if (projectData?.mis) {
            console.log(`[BudgetService] Found numeric MIS ${projectData.mis} for project code ${mis}`);
            misToSearch = projectData.mis;
            tryNumericMis = true;
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] Error looking up project by ID ${mis}:`, projectLookupError);
          // Continue with original MIS if lookup fails
        }
      } else if (!isNaN(parseInt(mis))) {
        // If MIS is numeric, proceed as normal
        tryNumericMis = true;
      }

      console.log(`[BudgetService] Fetching budget data for MIS ${misToSearch}`);

      // Get budget data directly using MIS
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', misToSearch)
        .single();

      if (budgetError) {
        throw budgetError;
      }

      // Use user_view as current_budget if current_budget is not set or zero
      const userView = budgetData?.user_view?.toString() || '0';
      const ethsiaPistosi = budgetData?.ethsia_pistosi?.toString() || '0';
      const katanomesEtous = budgetData?.katanomes_etous?.toString() || '0';
      
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
      const hasLastQuarterCheck = budgetData && 'last_quarter_check' in budgetData && budgetData.last_quarter_check !== null;
      
      // Parse current quarter values - use parseEuropeanNumber to handle European number format (e.g., "22.000,00")
      const currentQ1 = parseEuropeanNumber(budgetData?.q1);
      const currentQ2 = parseEuropeanNumber(budgetData?.q2);
      const currentQ3 = parseEuropeanNumber(budgetData?.q3);
      const currentQ4 = parseEuropeanNumber(budgetData?.q4);
      
      // Get current trimester value
      const currentQuarterValue = parseEuropeanNumber(budgetData?.[quarterKey]);
      
      // Extract the quarter number from the last_quarter_check (e.g., extract '1' from 'q1')
      const lastQuarterCheck = hasLastQuarterCheck 
        ? budgetData.last_quarter_check?.toString() || `q${currentQuarterNumber}`
        : `q${currentQuarterNumber}`;
      
      const lastQuarterChecked = lastQuarterCheck && lastQuarterCheck.startsWith('q') 
        ? parseInt(lastQuarterCheck.substring(1)) 
        : 0;
      
      // Check for quarter transition (e.g., Q1->Q2)
      const isQuarterTransition = lastQuarterChecked > 0 && lastQuarterChecked < currentQuarterNumber;
      
      console.log(`[BudgetService] Quarter check - Last checked: ${lastQuarterChecked}, Current: ${currentQuarterNumber}, Transition: ${isQuarterTransition}`);
      
      let needsUpdate = false;
      let updatedUserView = parseEuropeanNumber(userView);
      let updatedQ1 = currentQ1;
      let updatedQ2 = currentQ2;
      let updatedQ3 = currentQ3;
      let updatedQ4 = currentQ4;
      
      // Handle quarter transitions
      if (isQuarterTransition) {
        needsUpdate = true;
        
        // Calculate the quarter transition (add previous quarter value to current quarter)
        if (lastQuarterChecked === 1 && currentQuarterNumber === 2) {
          // Q1->Q2 transition
          console.log(`[BudgetService] Quarter transition from Q1 to Q2 - q1 value: ${currentQ1}, adding to q2: ${currentQ2}`);
          
          // Apply the quarter transition logic: q2=q2+q1
          updatedQ2 = currentQ2 + currentQ1;
          updatedQ1 = 0; // Reset q1 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q1->Q2 transition:`, {
            q1: `${currentQ1} -> ${updatedQ1}`,
            q2: `${currentQ2} -> ${updatedQ2}`
          });
          
        } else if (lastQuarterChecked === 2 && currentQuarterNumber === 3) {
          // Q2->Q3 transition
          console.log(`[BudgetService] Quarter transition from Q2 to Q3 - q2 value: ${currentQ2}, adding to q3: ${currentQ3}`);
          
          // Apply the quarter transition logic: q3=q3+q2
          updatedQ3 = currentQ3 + currentQ2;
          updatedQ2 = 0; // Reset q2 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q2->Q3 transition:`, {
            q2: `${currentQ2} -> ${updatedQ2}`,
            q3: `${currentQ3} -> ${updatedQ3}`
          });
          
        } else if (lastQuarterChecked === 3 && currentQuarterNumber === 4) {
          // Q3->Q4 transition
          console.log(`[BudgetService] Quarter transition from Q3 to Q4 - q3 value: ${currentQ3}, adding to q4: ${currentQ4}`);
          
          // Apply the quarter transition logic: q4=q4+q3
          updatedQ4 = currentQ4 + currentQ3;
          updatedQ3 = 0; // Reset q3 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q3->Q4 transition:`, {
            q3: `${currentQ3} -> ${updatedQ3}`,
            q4: `${currentQ4} -> ${updatedQ4}`
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
          last_quarter_check: `q${currentQuarterNumber}`,
          updated_at: new Date().toISOString()
        };
        
        console.log(`[BudgetService] Automatically updating budget data due to quarter transition:`, updatePayload);
        
        const { error: updateError } = await supabase
          .from('budget_na853_split')
          .update(updatePayload)
          .eq('mis', misToSearch);
          
        if (updateError) {
          console.error(`[BudgetService] Error updating budget data:`, updateError);
        } else {
          console.log(`[BudgetService] Successfully updated budget data with quarter transition values`);
          
          // Update our local copy of the data
          budgetData.q1 = updatedQ1.toString();
          budgetData.q2 = updatedQ2.toString();
          budgetData.q3 = updatedQ3.toString();
          budgetData.q4 = updatedQ4.toString();
          // Remove quarter_view from the database record
          if ('quarter_view' in budgetData) {
            delete budgetData.quarter_view;
          }
        }
      }
      
      // Calculate budget indicators
      // Get the values of the current trimester
      let currentTrimesterValue = 0;
      switch (quarterKey) {
        case 'q1': currentTrimesterValue = needsUpdate ? updatedQ1 : currentQ1; break;
        case 'q2': currentTrimesterValue = needsUpdate ? updatedQ2 : currentQ2; break;
        case 'q3': currentTrimesterValue = needsUpdate ? updatedQ3 : currentQ3; break;
        case 'q4': currentTrimesterValue = needsUpdate ? updatedQ4 : currentQ4; break;
      }
      
      // Convert string values to numbers for calculations using European number format
      const userViewNum = parseEuropeanNumber(userView);
      const ethsiaPistosiNum = parseEuropeanNumber(ethsiaPistosi);
      const katanomesEtousNum = parseEuropeanNumber(katanomesEtous);
      
      // Calculate budget indicators:
      // Διαθέσιμος = katanomes_etous - user_view
      // Τρίμηνο = current_q - user_view
      // Ετήσιος = ethsia_pistosi - user-view
      const availableBudget = Math.max(0, katanomesEtousNum - userViewNum);
      const currentQuarterAvailable = Math.max(0, currentTrimesterValue - userViewNum);
      const yearlyAvailable = Math.max(0, ethsiaPistosiNum - userViewNum);
      
      // Return with budget indicators
      // Check if the sum column exists and handle it
      const hasSum = budgetData && 'sum' in budgetData && budgetData.sum !== null;
      const sumData = hasSum ? budgetData.sum : null;
      
      return {
        status: 'success',
        data: {
          user_view: userView,
          ethsia_pistosi: ethsiaPistosi,
          q1: needsUpdate ? updatedQ1.toString() : budgetData.q1?.toString() || '0',
          q2: needsUpdate ? updatedQ2.toString() : budgetData.q2?.toString() || '0',
          q3: needsUpdate ? updatedQ3.toString() : budgetData.q3?.toString() || '0',
          q4: needsUpdate ? updatedQ4.toString() : budgetData.q4?.toString() || '0',
          total_spent: totalSpent,
          current_budget: userView, // Set current_budget to match user_view
          last_quarter_check: needsUpdate ? `q${currentQuarterNumber}` : lastQuarterCheck,
          current_quarter: quarterKey,
          // Add new budget indicators
          available_budget: availableBudget.toString(),
          quarter_available: currentQuarterAvailable.toString(), 
          yearly_available: yearlyAvailable.toString(),
          // Include sum data if available
          sum: sumData
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

      // Check if the MIS is purely numeric or has a project code format
      let misToSearch = mis;
      let isProjectCode = false;

      // Check if MIS might be a project ID with a code pattern (e.g., "2024ΝΑ85300001")
      if (mis.match(/^\d{4}[Α-Ωα-ωA-Za-z]+\d+$/)) {
        console.log(`[BudgetService] MIS appears to be a project code pattern: ${mis}`);
        isProjectCode = true;
        
        // If it matches a project code pattern, try to get its numeric MIS from Projects table
        try {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', mis)
            .single();
            
          if (projectData?.mis) {
            console.log(`[BudgetService] Found numeric MIS ${projectData.mis} for project code ${mis}`);
            misToSearch = projectData.mis;
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] Error looking up project by ID ${mis}:`, projectLookupError);
          // Continue with original MIS if lookup fails
        }
      }
      
      console.log(`[BudgetService] Validating budget for MIS: ${misToSearch}, amount: ${amount}`);

      // Try to get current budget data
      let { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('user_view, ethsia_pistosi, katanomes_etous, q1, q2, q3, q4')
        .eq('mis', misToSearch)
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

      // Parse budget values and handle potential null/undefined values - use parseEuropeanNumber for proper format handling
      const userView = parseEuropeanNumber(budgetData.user_view);
      const ethsiaPistosi = parseEuropeanNumber(budgetData.ethsia_pistosi);
      const katanomesEtous = parseEuropeanNumber(budgetData.katanomes_etous);
      
      // Get quarterly data using parseEuropeanNumber
      const q1 = parseEuropeanNumber(budgetData.q1);
      const q2 = parseEuropeanNumber(budgetData.q2);
      const q3 = parseEuropeanNumber(budgetData.q3);
      const q4 = parseEuropeanNumber(budgetData.q4);
      
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

      // Get current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const quarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';
      
      // Get current quarter value
      let currentQuarterValue = 0;
      switch (quarterKey) {
        case 'q1': currentQuarterValue = q1; break;
        case 'q2': currentQuarterValue = q2; break;
        case 'q3': currentQuarterValue = q3; break;
        case 'q4': currentQuarterValue = q4; break;
      }
      
      // Calculate budget indicators based on the new design
      // Διαθέσιμος = katanomes_etous - user_view
      // Τρίμηνο = current_q - user_view
      // Ετήσιος = ethsia_pistosi - user_view
      const availableBeforeOperation = Math.max(0, katanomesEtous - userView);
      const quarterAvailableBeforeOperation = Math.max(0, currentQuarterValue - userView);
      const yearlyAvailableBeforeOperation = Math.max(0, ethsiaPistosi - userView);
      
      // Calculate indicators after operation
      const newUserView = userView + amount;
      const availableAfterOperation = Math.max(0, katanomesEtous - newUserView);
      const quarterAvailableAfterOperation = Math.max(0, currentQuarterValue - newUserView);
      const yearlyAvailableAfterOperation = Math.max(0, ethsiaPistosi - newUserView);
      
      // If available would go negative, return an error
      if (katanomesEtous > 0 && newUserView > katanomesEtous) {
        return {
          status: 'error',
          canCreate: false,
          message: `Ανεπαρκής διαθέσιμος προϋπολογισμός (Διαθέσιμος: ${availableBeforeOperation}, Έγγραφο: ${amount})`,
          metadata: {
            available: availableBeforeOperation,
            requested: amount,
            shortfall: Math.abs(katanomesEtous - newUserView)
          }
        };
      }

      // Calculate 20% threshold of katanomes_etous (or ethsia_pistosi if katanomes_etous is 0)
      const baseValue = katanomesEtous > 0 ? katanomesEtous : ethsiaPistosi;
      const threshold = baseValue * 0.2;
      
      // Check if available budget would fall below 20% threshold
      if (availableAfterOperation <= threshold && baseValue > 0) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Ο διαθέσιμος προϋπολογισμός θα πέσει κάτω από το 20% της ετήσιας κατανομής. Απαιτείται ειδοποίηση διαχειριστή.',
          requiresNotification: true,
          notificationType: 'low_budget',
          priority: 'high',
          allowDocx: true,
          metadata: {
            availableBeforeOperation,
            availableAfterOperation,
            threshold: threshold,
            baseValue: baseValue,
            percentageRemaining: (availableAfterOperation / baseValue) * 100
          }
        };
      }
      
      // Check if budget is getting low (below 30%)
      if (availableAfterOperation <= baseValue * 0.3 && baseValue > 0) {
        return {
          status: 'warning',
          canCreate: true,
          message: 'Ο διαθέσιμος προϋπολογισμός είναι χαμηλός (κάτω από 30% της ετήσιας κατανομής).',
          requiresNotification: false,
          allowDocx: true,
          metadata: {
            availableBeforeOperation,
            availableAfterOperation,
            threshold: baseValue * 0.3,
            baseValue: baseValue,
            percentageRemaining: (availableAfterOperation / baseValue) * 100
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
          availableBeforeOperation,
          availableAfterOperation,
          userView,
          newUserView,
          baseValue: baseValue,
          percentageAvailable: baseValue > 0 ? (availableAfterOperation / baseValue) * 100 : 100,
          budget_indicators: {
            available_budget: availableAfterOperation,
            quarter_available: quarterAvailableAfterOperation,
            yearly_available: yearlyAvailableAfterOperation
          }
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

  static async updateBudget(mis: string, amount: number, userId: string | number, documentId?: number, changeReason?: string): Promise<BudgetResponse> {
    try {
      if (!mis || isNaN(amount) || amount <= 0 || !userId) {
        return {
          status: 'error',
          message: 'Missing required parameters'
        };
      }

      // Check if the MIS is purely numeric or has a project code format
      let misToSearch = mis;
      let isProjectCode = false;

      // Check if MIS might be a project ID with a code pattern (e.g., "2024ΝΑ85300001")
      if (mis.match(/^\d{4}[Α-Ωα-ωA-Za-z]+\d+$/)) {
        console.log(`[BudgetService] updateBudget: MIS appears to be a project code pattern: ${mis}`);
        isProjectCode = true;
        
        // If it matches a project code pattern, try to get its numeric MIS from Projects table
        try {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', mis)
            .single();
            
          if (projectData?.mis) {
            console.log(`[BudgetService] updateBudget: Found numeric MIS ${projectData.mis} for project code ${mis}`);
            misToSearch = projectData.mis;
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] updateBudget: Error looking up project by ID ${mis}:`, projectLookupError);
          // Continue with original MIS if lookup fails
        }
      }

      console.log(`[BudgetService] Updating budget for MIS: ${misToSearch}, amount: ${amount}, userId: ${userId}, documentId: ${documentId || 'none'}`);

      // Try to get current budget data
      let { data: budgetData, error: fetchError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', misToSearch)
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

      // Parse current values - use parseEuropeanNumber to handle European number format
      const currentUserView = parseEuropeanNumber(budgetData.user_view);
      const currentEthsiaPistosi = parseEuropeanNumber(budgetData.ethsia_pistosi);
      const currentKatanomesEtous = parseEuropeanNumber(budgetData.katanomes_etous);
      const total_spent = parseEuropeanNumber(budgetData.total_spent);

      // Get current quarter
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const quarterKey = `q${Math.ceil(currentMonth / 3)}` as 'q1' | 'q2' | 'q3' | 'q4';

      // Parse current quarter values - use parseEuropeanNumber to handle European number format
      const currentQ1 = parseEuropeanNumber(budgetData.q1);
      const currentQ2 = parseEuropeanNumber(budgetData.q2);
      const currentQ3 = parseEuropeanNumber(budgetData.q3);
      const currentQ4 = parseEuropeanNumber(budgetData.q4);
      const currentQuarterValue = parseEuropeanNumber(budgetData[quarterKey]);
      
      // Check for quarter transitions using the last_quarter_check column
      const lastQuarterCheck = budgetData.last_quarter_check?.toString() || '';
      // Extract the quarter number from the text (e.g., extract '1' from 'q1')
      const lastQuarterChecked = lastQuarterCheck && lastQuarterCheck.startsWith('q') 
        ? parseInt(lastQuarterCheck.substring(1)) 
        : 0;
      const currentQuarterNumber = Math.ceil(currentMonth / 3);
      const isQuarterTransition = lastQuarterChecked > 0 && lastQuarterChecked < currentQuarterNumber;
      
      console.log(`[BudgetService] Quarter check - Last checked: ${lastQuarterChecked}, Current: ${currentQuarterNumber}, Transition: ${isQuarterTransition}`);
      
      // Define new quarter values with defaults from current values
      let newQ1 = currentQ1;
      let newQ2 = currentQ2;
      let newQ3 = currentQ3;
      let newQ4 = currentQ4;
      
      if (isQuarterTransition) {
        // Calculate the quarter transition (add previous quarter value to current quarter)
        if (lastQuarterChecked === 1 && currentQuarterNumber === 2) {
          // Q1->Q2 transition
          console.log(`[BudgetService] Quarter transition from Q1 to Q2 - q1 value: ${currentQ1}, adding to q2: ${currentQ2}`);
          
          // Apply the quarter transition logic: q2=q2+q1
          newQ2 = currentQ2 + currentQ1;
          newQ1 = 0; // Reset q1 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q1->Q2 transition:`, {
            q1: `${currentQ1} -> ${newQ1}`,
            q2: `${currentQ2} -> ${newQ2}`
          });
          
        } else if (lastQuarterChecked === 2 && currentQuarterNumber === 3) {
          // Q2->Q3 transition
          console.log(`[BudgetService] Quarter transition from Q2 to Q3 - q2 value: ${currentQ2}, adding to q3: ${currentQ3}`);
          
          // Apply the quarter transition logic: q3=q3+q2
          newQ3 = currentQ3 + currentQ2;
          newQ2 = 0; // Reset q2 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q2->Q3 transition:`, {
            q2: `${currentQ2} -> ${newQ2}`,
            q3: `${currentQ3} -> ${newQ3}`
          });
          
        } else if (lastQuarterChecked === 3 && currentQuarterNumber === 4) {
          // Q3->Q4 transition
          console.log(`[BudgetService] Quarter transition from Q3 to Q4 - q3 value: ${currentQ3}, adding to q4: ${currentQ4}`);
          
          // Apply the quarter transition logic: q4=q4+q3
          newQ4 = currentQ4 + currentQ3;
          newQ3 = 0; // Reset q3 as it has ended
          
          console.log(`[BudgetService] Updated quarterly values after Q3->Q4 transition:`, {
            q3: `${currentQ3} -> ${newQ3}`,
            q4: `${currentQ4} -> ${newQ4}`
          });
        }
      }
      
      // Calculate new user view by adding the amount (user_view is counter of all spending)
      const newUserView = currentUserView + amount;
      const newTotalSpent = total_spent + amount;
      
      // These values should not be updated by document creation operations
      const newEthsiaPistosi = currentEthsiaPistosi; // Do not change ethsia_pistosi
      const newKatanomesEtous = currentKatanomesEtous; // Do not change katanomes_etous
      
      // Calculate budget indicators
      const availableBudget = Math.max(0, newKatanomesEtous - newUserView);
      
      // Get current trimester value for budget indicators
      let currentTrimesterValue = 0;
      switch (quarterKey) {
        case 'q1': currentTrimesterValue = isQuarterTransition ? newQ1 : currentQ1; break;
        case 'q2': currentTrimesterValue = isQuarterTransition ? newQ2 : currentQ2; break;
        case 'q3': currentTrimesterValue = isQuarterTransition ? newQ3 : currentQ3; break;
        case 'q4': currentTrimesterValue = isQuarterTransition ? newQ4 : currentQ4; break;
      }
      
      const currentQuarterAvailable = Math.max(0, currentTrimesterValue - newUserView);
      const yearlyAvailable = Math.max(0, newEthsiaPistosi - newUserView);

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
        last_quarter_check: `q${currentQuarterNumber}`
      };
      
      // Only include total_spent if the column exists
      if (hasTotalSpentColumn) {
        updatePayload.total_spent = newTotalSpent.toString();
      }
      
      // If quarter_view exists in the database, set it to null to remove it
      if ('quarter_view' in budgetData) {
        updatePayload.quarter_view = null;
      }
      
      // Check for 'sum' column and update it if it exists
      const hasSum = budgetData && 'sum' in budgetData;
      if (hasSum) {
        // Create a new sum object or update the existing one
        const currentSum = budgetData.sum || {};
        const updatedSum = {
          ...currentSum,
          user_view: newUserView,
          updated_at: new Date().toISOString(),
          ethsia_pistosi: newEthsiaPistosi,
          current_quarter: quarterKey,
          available_budget: availableBudget,
          quarter_available: currentQuarterAvailable,
          yearly_available: yearlyAvailable
        };
        
        // Add sum to update payload
        updatePayload.sum = updatedSum;
        console.log(`[BudgetService] Including sum data in update:`, JSON.stringify(updatedSum, null, 2));
      }
      
      // Update budget amounts
      console.log(`[BudgetService] Updating budget_na853_split with payload:`, JSON.stringify(updatePayload, null, 2));
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update(updatePayload)
        .eq('mis', misToSearch);

      if (updateError) {
        throw updateError;
      }

      // Create a budget history entry with metadata
      const quarterChanges = {
        q1: { previous: currentQ1, new: newQ1 },
        q2: { previous: currentQ2, new: newQ2 },
        q3: { previous: currentQ3, new: newQ3 },
        q4: { previous: currentQ4, new: newQ4 }
      };
      
      // Update history message to show budget is being used, not reduced (since we're adding to user_view)
      const historyEntry = {
        mis: misToSearch,
        previous_amount: currentUserView.toString(),
        new_amount: newUserView.toString(),
        change_type: documentId ? 'document_creation' : 'manual_adjustment',
        change_reason: changeReason || (documentId ? 
          `Document creation [ID:${documentId}] added ${amount} to budget usage. Current quarter: ${quarterKey}` : 
          `Manual budget adjustment added ${amount} to budget usage. Current quarter: ${quarterKey}`),
        document_id: documentId || null,
        created_by: userId.toString(),
        metadata: {
          quarterly_changes: quarterChanges,
          budget_indicators: {
            available_budget: availableBudget,
            quarter_available: currentQuarterAvailable,
            yearly_available: yearlyAvailable
          },
          amount_used: amount
        }
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

      // Build response object
      const responseData: any = {
        user_view: newUserView.toString(),
        ethsia_pistosi: newEthsiaPistosi.toString(),
        q1: newQ1.toString(),
        q2: newQ2.toString(),
        q3: newQ3.toString(),
        q4: newQ4.toString(),
        total_spent: newTotalSpent.toString(),
        current_budget: newUserView.toString(),
        last_quarter_check: `q${currentQuarterNumber}`,
        current_quarter: quarterKey,
        // Add new budget indicators
        available_budget: availableBudget.toString(),
        quarter_available: currentQuarterAvailable.toString(), 
        yearly_available: yearlyAvailable.toString()
      };
      
      // Include sum if it exists in the database record
      if (hasSum) {
        responseData.sum = updatePayload.sum;
      }
      
      return {
        status: 'success',
        data: responseData
      };
    } catch (error) {
      console.error('[BudgetService] Budget update error:', error);
      
      // Even on error, try to log the attempted operation
      try {
        // Make a safe version of MIS number
        let safeNumber: number;
        try {
          safeNumber = parseInt(mis);
          if (isNaN(safeNumber)) {
            safeNumber = 0;
          }
        } catch {
          safeNumber = 0;
        }
        
        await supabase
          .from('budget_history')
          .insert({
            mis: safeNumber.toString(),
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

  /**
   * Resolves reallocation notifications that match a budget change detection.
   * Used when admin uploads change katanomes_etous and a notification exists.
   * 
   * @param mis Project MIS number
   * @param katanomesEtousDiff The change in katanomes_etous value
   * @returns Result of the operation
   */
  static async resolveReallocationNotifications(mis: string, katanomesEtousDiff: number): Promise<boolean> {
    try {
      if (!mis || Math.abs(katanomesEtousDiff) < 0.01) {
        console.log('[BudgetService] No significant budget change to process');
        return false;
      }

      // Check if the MIS is purely numeric or has a project code format
      let misToSearch = mis;
      let isProjectCode = false;

      // Check if MIS might be a project ID with a code pattern (e.g., "2024ΝΑ85300001")
      if (mis.match(/^\d{4}[Α-Ωα-ωA-Za-z]+\d+$/)) {
        console.log(`[BudgetService] resolveReallocation: MIS appears to be a project code pattern: ${mis}`);
        isProjectCode = true;
        
        // If it matches a project code pattern, try to get its numeric MIS from Projects table
        try {
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', mis)
            .single();
            
          if (projectData?.mis) {
            console.log(`[BudgetService] resolveReallocation: Found numeric MIS ${projectData.mis} for project code ${mis}`);
            misToSearch = projectData.mis;
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] resolveReallocation: Error looking up project by ID ${mis}:`, projectLookupError);
          // Continue with original MIS if lookup fails
        }
      }

      console.log(`[BudgetService] Attempting to resolve reallocation notifications for MIS: ${misToSearch}`);
      
      // Find pending reallocation notifications for this MIS
      const { data: notifications, error } = await supabase
        .from('budget_notifications')
        .select('*')
        .eq('mis', misToSearch)
        .eq('type', 'reallocation')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[BudgetService] Error fetching reallocation notifications:', error);
        return false;
      }
      
      if (!notifications || notifications.length === 0) {
        console.log(`[BudgetService] No pending reallocation notifications found for MIS: ${misToSearch}`);
        return false;
      }
      
      console.log(`[BudgetService] Found ${notifications.length} pending reallocation notification(s) for MIS: ${misToSearch}`);
      
      // Mark the most recent notification as completed
      // Note: We could check if the amount matches exactly, but a more lenient approach is to
      // just mark any pending reallocation notification as completed after an admin update
      const latestNotification = notifications[0];
      
      const { error: updateError } = await supabase
        .from('budget_notifications')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', latestNotification.id);
      
      if (updateError) {
        console.error('[BudgetService] Error updating notification status:', updateError);
        return false;
      }
      
      console.log(`[BudgetService] Successfully resolved reallocation notification ID: ${latestNotification.id} for MIS: ${misToSearch}`);
      return true;
    } catch (error) {
      console.error('[BudgetService] Error resolving reallocation notifications:', error);
      return false;
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