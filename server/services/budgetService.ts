/**
 * Budget Service
 * 
 * Handles budget data retrieval, validation and change management
 * Supports both alphanumeric MIS codes (like "2024ΝΑ85300001") and numeric MIS identifiers (5174692)
 */

import { createClient } from '@supabase/supabase-js';
import { supabase } from '../data';

// Configure types for budget data
interface BudgetData {
  user_view: number;
  total_budget?: number;
  annual_budget?: number;
  ethsia_pistosi: number;
  katanomes_etous: number;
  current_budget?: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  current_quarter?: string;
  last_quarter_check?: string;
  quarter_view?: number;
  total_spent?: number;
  available_budget?: number;
  quarter_available?: number;
  yearly_available?: number;
  sum?: any; // JSON column containing previous budget state
}

interface BudgetChanges {
  available_budget_diff: number;
  quarter_available_diff: number;
  yearly_available_diff: number;
  katanomes_etous_diff: number;
  ethsia_pistosi_diff: number;
}

interface BudgetUpdateIndicators {
  available_budget: number;
  quarter_available: number;
  yearly_available: number;
  katanomes_etous: number;
  ethsia_pistosi: number;
  user_view: number;
  current_quarter: number | string;
}

interface BudgetChangeAnalysis {
  status: 'success' | 'error';
  mis: string;
  isReallocation: boolean;
  changeType: 'increase' | 'decrease' | 'reallocation' | 'no_change';
  beforeUpdate: BudgetUpdateIndicators | null;
  afterUpdate: BudgetUpdateIndicators;
  changes: BudgetChanges;
  error?: string;
}

interface BudgetValidationResult {
  status: 'success' | 'warning' | 'error';
  canCreate: boolean;
  allowDocx?: boolean;
  message: string;
  metadata?: {
    budget_indicators?: {
      available_budget: number;
      quarter_available: number;
      yearly_available: number;
    };
    [key: string]: any;
  };
}

interface BudgetResponse {
  status: 'success' | 'error';
  data?: BudgetData;
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
      
      // Pattern to detect project codes like "2024ΝΑ85300001"
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isNumericString = /^\d+$/.test(mis);
      let numericalMis: number | null = null;
      
      console.log(`[BudgetService] Analyzing changes for MIS: ${mis}, isNumericString: ${isNumericString}`);
      
      // CASE 1: Project code format (like "2024ΝΑ85300001")
      if (projectCodePattern.test(mis)) {
        isProjectCode = true;
        console.log(`[BudgetService] Analyzing - MIS appears to be a project code: ${mis}`);
        
        // Try to find the numerical MIS by looking up the project
        try {
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('na853', mis) // Look up by NA853 field
            .single();
          
          if (projectError && projectError.code !== 'PGRST116') {
            console.error(`[BudgetService] Analyzing - Supabase error looking up project: ${projectError.message}`);
          }
            
          if (projectData?.mis) {
            console.log(`[BudgetService] Analyzing - Found project with numeric MIS ${projectData.mis} for project code ${mis}`);
            // Convert to number since MIS is now int4 in the database
            numericalMis = parseInt(projectData.mis.toString());
            misToSearch = String(numericalMis); // Convert to string for consistency in search
          } else {
            console.log(`[BudgetService] Analyzing - No project found with project code: ${mis}, will try to find by direct match`);
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] Analyzing - Error looking up project by code ${mis}:`, projectLookupError);
          // Continue with other strategies if lookup fails
        }
      } 
      // CASE 2: Numeric MIS
      else if (isNumericString) {
        numericalMis = parseInt(mis);
        misToSearch = String(numericalMis); // Convert to string for consistency in search
        console.log(`[BudgetService] Analyzing - Using numerical MIS: ${misToSearch}`);
      }
      
      // Try to get budget data with the determined MIS value
      const { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', misToSearch)
        .single();
        
      if (error) {
        console.error(`[BudgetService] Analyzing - Error fetching budget data: ${error.message}`);
        return {
          status: 'error',
          mis: mis,
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
          error: `Error fetching budget data: ${error.message}`
        };
      }
      
      if (!budgetData) {
        console.error(`[BudgetService] Analyzing - No budget data found for MIS: ${misToSearch}`);
        return {
          status: 'error',
          mis: mis,
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
          error: `No budget data found for MIS: ${misToSearch}`
        };
      }
      
      // If we have data, analyze changes between current state and previous state (if available)
      const currentState: BudgetUpdateIndicators = {
        available_budget: (budgetData.katanomes_etous || 0) - (budgetData.user_view || 0),
        quarter_available: 0, // Calculate based on quarter if needed
        yearly_available: (budgetData.ethsia_pistosi || 0) - (budgetData.user_view || 0),
        katanomes_etous: budgetData.katanomes_etous || 0,
        ethsia_pistosi: budgetData.ethsia_pistosi || 0,
        user_view: budgetData.user_view || 0,
        current_quarter: budgetData.last_quarter_check || 'q1'
      };
      
      // Get previous state from sum JSON column if available
      let previousState: BudgetUpdateIndicators | null = null;
      if (budgetData.sum && typeof budgetData.sum === 'object') {
        previousState = {
          available_budget: parseFloat(budgetData.sum.available_budget || 0),
          quarter_available: parseFloat(budgetData.sum.quarter_available || 0),
          yearly_available: parseFloat(budgetData.sum.yearly_available || 0),
          katanomes_etous: parseFloat(budgetData.sum.katanomes_etous || 0),
          ethsia_pistosi: parseFloat(budgetData.sum.ethsia_pistosi || 0),
          user_view: parseFloat(budgetData.sum.user_view || 0),
          current_quarter: budgetData.sum.current_quarter || 'q1'
        };
      }
      
      if (!previousState) {
        console.log(`[BudgetService] Analyzing - No previous state found in sum column, cannot compare changes`);
        return {
          status: 'success',
          mis: mis,
          isReallocation: false,
          changeType: 'no_change',
          beforeUpdate: null,
          afterUpdate: currentState,
          changes: {
            available_budget_diff: 0,
            quarter_available_diff: 0,
            yearly_available_diff: 0,
            katanomes_etous_diff: 0,
            ethsia_pistosi_diff: 0,
          }
        };
      }
      
      // Calculate differences between current and previous state
      const changes: BudgetChanges = {
        available_budget_diff: currentState.available_budget - previousState.available_budget,
        quarter_available_diff: currentState.quarter_available - previousState.quarter_available,
        yearly_available_diff: currentState.yearly_available - previousState.yearly_available,
        katanomes_etous_diff: currentState.katanomes_etous - previousState.katanomes_etous,
        ethsia_pistosi_diff: currentState.ethsia_pistosi - previousState.ethsia_pistosi
      };
      
      // Determine change type (increase, decrease, reallocation, no change)
      let changeType: 'increase' | 'decrease' | 'reallocation' | 'no_change' = 'no_change';
      let isReallocation = false;
      
      // Check if ethsia_pistosi changed (this indicates funding increase/decrease)
      if (changes.ethsia_pistosi_diff > 0) {
        changeType = 'increase';
      } else if (changes.ethsia_pistosi_diff < 0) {
        changeType = 'decrease';
      } 
      // Check if katanomes_etous changed but ethsia_pistosi didn't (this indicates reallocation)
      else if (changes.katanomes_etous_diff !== 0 && changes.ethsia_pistosi_diff === 0) {
        changeType = 'reallocation';
        isReallocation = true;
      }
      
      return {
        status: 'success',
        mis: mis,
        isReallocation,
        changeType,
        beforeUpdate: previousState,
        afterUpdate: currentState,
        changes
      };
    } catch (error: any) {
      console.error(`[BudgetService] Error analyzing budget changes:`, error);
      return {
        status: 'error',
        mis: mis,
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
        error: error.message || 'Unknown error'
      };
    }
  }

  static async validateBudget(mis: string, amount: number): Promise<BudgetValidationResult> {
    try {
      // Input validation with improved error messages
      if (!mis) {
        console.log('[BudgetService] Validation - Missing MIS parameter');
        return {
          status: 'error',
          canCreate: false,
          message: 'Απαιτείται ο κωδικός MIS του έργου'
        };
      }
      
      // Check if amount is a valid number and greater than zero
      if (isNaN(amount)) {
        console.log('[BudgetService] Validation - Invalid amount parameter (not a number)');
        return {
          status: 'error',
          canCreate: false,
          message: 'Το ποσό πρέπει να είναι αριθμός'
        };
      }
      
      if (amount <= 0) {
        console.log('[BudgetService] Validation - Invalid amount parameter (zero or negative)');
        return {
          status: 'warning',
          canCreate: false,
          allowDocx: true,
          message: 'Το ποσό πρέπει να είναι μεγαλύτερο από 0 για οικονομικό έγγραφο'
        };
      }

      // Parse MIS based on format
      let misToSearch: string | number = mis;
      let numericalMis: number | null = null;
      
      // Check if MIS is numeric or follows the pattern of project codes
      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      
      console.log(`[BudgetService] Validation - Parameters: mis=${mis}, amount=${amount}`);
      console.log(`[BudgetService] Validation - Analysis: isNumericString=${isNumericString}, isProjectCode=${projectCodePattern.test(mis)}`);
      
      // CASE 1: Project code format (like "2024ΝΑ85300001")
      if (projectCodePattern.test(mis)) {
        console.log(`[BudgetService] Validation - MIS appears to be a project code: ${mis}`);
        
        // Try to find the project with matching NA853 field (project code)
        try {
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('na853', mis)
            .single();
          
          if (projectError && projectError.code !== 'PGRST116') {
            console.error(`[BudgetService] Validation - Supabase error looking up project: ${projectError.message}`);
          }
            
          if (projectData?.mis) {
            console.log(`[BudgetService] Validation - Found project with numeric MIS ${projectData.mis} for project code ${mis}`);
            // Convert to number since MIS is now int4 in the database
            numericalMis = parseInt(projectData.mis.toString());
            misToSearch = String(numericalMis); // Convert to string for consistency in search
          } else {
            console.log(`[BudgetService] Validation - No project found with ID/code: ${mis}, will try to find by direct match`);
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] Validation - Error looking up project by ID/code ${mis}:`, projectLookupError);
          // Continue with other strategies if lookup fails
        }
      }
      
      // CASE 2: Numeric MIS (either direct input or found from case 1)
      if (isNumericString || numericalMis !== null) {
        // If we don't already have a numerical MIS from case 1, parse it now
        if (numericalMis === null) {
          numericalMis = parseInt(mis);
          misToSearch = String(numericalMis); // Convert to string for consistency in search
        }
        console.log(`[BudgetService] Validation - Using numerical MIS: ${misToSearch}`);
      } else {
        console.log(`[BudgetService] Validation - Using original MIS string: ${misToSearch}`);
      }
      
      // Try to get current budget data with the determined MIS value
      let { data: budgetData, error } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', misToSearch)
        .single();
      
      if (error) {
        console.log(`[BudgetService] Validation - Error fetching budget data: ${error.message}`);
        
        // If it's just a "not found" error, try to use the original MIS value as fallback
        if (error.code === 'PGRST116' && error.message.includes('no rows')) {
          console.log(`[BudgetService] Validation - No budget found with converted MIS, trying original: ${mis}`);
          
          // Try original MIS as fallback
          const fallbackResult = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', mis)
            .single();
            
          if (!fallbackResult.error) {
            console.log(`[BudgetService] Validation - Found budget with original MIS: ${mis}`);
            budgetData = fallbackResult.data;
            error = null;
          } else {
            console.log(`[BudgetService] Validation - No budget found with original MIS either: ${mis}`);
          }
        }
      }
      
      // If budget data still not found after all attempts
      if (!budgetData) {
        console.log(`[BudgetService] Validation - Budget not found for MIS: ${misToSearch}`);
        return {
          status: 'error',
          canCreate: false,
          message: 'Δεν βρέθηκαν στοιχεία προϋπολογισμού για το έργο',
          metadata: {
            details: `No budget data found for MIS: ${misToSearch}`
          }
        };
      }
      
      console.log(`[BudgetService] Validation - Budget data found:`, {
        ethsia_pistosi: budgetData.ethsia_pistosi,
        katanomes_etous: budgetData.katanomes_etous,
        user_view: budgetData.user_view
      });
      
      // Calculate available budget
      const available_budget = (budgetData.katanomes_etous || 0) - (budgetData.user_view || 0);
      const yearly_available = (budgetData.ethsia_pistosi || 0) - (budgetData.user_view || 0);
      
      console.log(`[BudgetService] Validation - Budget calculated:`, {
        available_budget,
        yearly_available,
        requested_amount: amount
      });
      
      // Budget validation logic - check if there's enough budget
      if (available_budget <= 0) {
        return {
          status: 'error',
          canCreate: false,
          message: 'Δεν υπάρχει διαθέσιμος προϋπολογισμός στο έργο',
          metadata: {
            budget_indicators: {
              available_budget,
              quarter_available: 0,
              yearly_available
            }
          }
        };
      }
      
      if (amount > available_budget) {
        return {
          status: 'warning',
          canCreate: false,
          allowDocx: true,
          message: `Το αιτούμενο ποσό (${amount.toFixed(2)}€) υπερβαίνει τον διαθέσιμο προϋπολογισμό (${available_budget.toFixed(2)}€)`,
          metadata: {
            budget_indicators: {
              available_budget,
              quarter_available: 0,
              yearly_available
            }
          }
        };
      }
      
      // Success - enough budget available
      return {
        status: 'success',
        canCreate: true,
        message: 'Επαρκής προϋπολογισμός για το αιτούμενο ποσό',
        metadata: {
          budget_indicators: {
            available_budget,
            quarter_available: 0,
            yearly_available
          }
        }
      };
      
    } catch (error: any) {
      console.error('[BudgetService] Validation - Error validating budget:', error);
      return {
        status: 'error',
        canCreate: false,
        message: 'Σφάλμα κατά τον έλεγχο προϋπολογισμού',
        metadata: {
          error: error.message
        }
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

      let misToSearch: string | number = mis;
      let numericalMis: number | null = null;
      
      // Check if MIS is numeric or follows the pattern of project codes
      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      
      console.log(`[BudgetService] GetBudget - Parameters: mis=${mis}`);
      console.log(`[BudgetService] GetBudget - Analysis: isNumericString=${isNumericString}, isProjectCode=${projectCodePattern.test(mis)}`);
      
      // Declare variables at the top to avoid "used before declaration" errors
      let budgetData: any = null;
      let budgetError: any = null;

      // First try direct lookup by na853 if it's a project code
      if (projectCodePattern.test(mis)) {
        console.log(`[BudgetService] GetBudget - First trying direct lookup with na853 project code: ${mis}`);
        
        try {
          // Try to find budget directly using na853 field
          const { data: directNa853Data, error: directNa853Error } = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('na853', mis)
            .single();
            
          if (!directNa853Error && directNa853Data) {
            console.log(`[BudgetService] GetBudget - Successfully found budget with NA853 code: ${mis}`);
            budgetData = directNa853Data;
            budgetError = null;
            
            // Skip other lookups and proceed with success
            console.log(`[BudgetService] Direct NA853 lookup successful, skipping other methods`);
            
            // Use this data directly
            const userView = budgetData?.user_view?.toString() || '0';
            const ethsiaPistosi = budgetData?.ethsia_pistosi?.toString() || '0';
            const katanomesEtous = budgetData?.katanomes_etous?.toString() || '0';
            
            // Check if the total_spent column exists
            const hasTotalSpent = budgetData && 'total_spent' in budgetData && budgetData.total_spent !== null;
            const totalSpent = hasTotalSpent ? budgetData.total_spent.toString() : '0';
            
            // Get current quarter
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            const currentQuarterNumber = Math.ceil(currentMonth / 3);
            const quarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';
            
            // Calculate available budget
            const available_budget = parseFloat(katanomesEtous) - parseFloat(userView);
            const quarter_available = parseFloat(budgetData[quarterKey]?.toString() || '0') - parseFloat(userView);
            const yearly_available = parseFloat(ethsiaPistosi) - parseFloat(userView);
            
            // Return budget data with correct types
            const response: BudgetResponse = {
              status: 'success',
              data: {
                user_view: parseFloat(userView),
                total_budget: parseFloat(ethsiaPistosi),
                annual_budget: parseFloat(ethsiaPistosi),
                ethsia_pistosi: parseFloat(ethsiaPistosi),
                katanomes_etous: parseFloat(katanomesEtous),
                current_budget: parseFloat(userView),
                q1: parseFloat(budgetData.q1?.toString() || '0'),
                q2: parseFloat(budgetData.q2?.toString() || '0'),
                q3: parseFloat(budgetData.q3?.toString() || '0'),
                q4: parseFloat(budgetData.q4?.toString() || '0'),
                total_spent: parseFloat(totalSpent),
                available_budget: available_budget,
                quarter_available: quarter_available,
                yearly_available: yearly_available,
                current_quarter: quarterKey
              }
            };
            
            console.log(`[BudgetService] Returning budget data for NA853 ${mis}:`, {
              ethsia_pistosi: response.data?.ethsia_pistosi,
              katanomes_etous: response.data?.katanomes_etous,
              user_view: response.data?.user_view,
              available_budget: response.data?.available_budget
            });
            
            return response;
          }
        } catch (directNa853Error) {
          console.log(`[BudgetService] Direct NA853 lookup error (non-critical):`, directNa853Error);
          // Continue with other lookup methods
        }
        
        // CASE 1: Project code format (like "2024ΝΑ85300001")
        console.log(`[BudgetService] GetBudget - MIS appears to be a project code: ${mis}`);
        
        // Try to find the project with matching NA853 field (project code)
        try {
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('na853', mis)
            .single();
          
          if (projectError && projectError.code !== 'PGRST116') {
            console.error(`[BudgetService] GetBudget - Supabase error looking up project: ${projectError.message}`);
          }
            
          if (projectData?.mis) {
            console.log(`[BudgetService] GetBudget - Found project with numeric MIS ${projectData.mis} for project code ${mis}`);
            // Convert to number since MIS is now int4 in the database
            numericalMis = parseInt(projectData.mis.toString());
            misToSearch = String(numericalMis); // Convert to string for consistency in search
          } else {
            console.log(`[BudgetService] GetBudget - No project found with ID/code: ${mis}, will try to find by direct match`);
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] GetBudget - Error looking up project by ID/code ${mis}:`, projectLookupError);
          // Continue with other strategies if lookup fails
        }
      }
      
      // CASE 2: Numeric MIS (either direct input or found from case 1)
      if (isNumericString || numericalMis !== null) {
        // If we don't already have a numerical MIS from case 1, parse it now
        if (numericalMis === null) {
          numericalMis = parseInt(mis);
          misToSearch = String(numericalMis); // Convert to string for consistency in search
        }
        console.log(`[BudgetService] GetBudget - Using numerical MIS: ${misToSearch}`);
      } else {
        console.log(`[BudgetService] GetBudget - Using original MIS string: ${misToSearch}`);
      }

      console.log(`[BudgetService] Fetching budget data for MIS ${misToSearch}`);

      // Get budget data directly using MIS
      // If we have a numeric MIS, we need to convert it to an integer for the query
      // If we couldn't convert the MIS to a numeric value, we'll first try to find the project

      try {
        // For numeric MIS, query directly against the integer column
        if (numericalMis !== null) {
          console.log(`[BudgetService] Querying budget_na853_split with numeric MIS: ${numericalMis}`);
          const result = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', numericalMis) // Use the number directly for integer column
            .single();
          
          budgetData = result.data;
          budgetError = result.error;
        } else {
          // For string/project code format, try to find the corresponding project first
          console.log(`[BudgetService] Trying to find project with NA853 code: ${mis}`);
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('na853', mis)
            .single();
          
          if (!projectError && projectData?.mis) {
            // Found the project, use its numeric MIS
            console.log(`[BudgetService] Found project with MIS: ${projectData.mis}, using for budget query`);
            const result = await supabase
              .from('budget_na853_split')
              .select('*')
              .eq('mis', projectData.mis) // Use the MIS from the project
              .single();
            
            budgetData = result.data;
            budgetError = result.error;
          } else {
            // Last resort: try direct query with original value
            console.log(`[BudgetService] No project found, trying direct budget query with: ${misToSearch}`);
            const result = await supabase
              .from('budget_na853_split')
              .select('*')
              .eq('mis', misToSearch)
              .single();
            
            budgetData = result.data;
            budgetError = result.error;
          }
        }
      } catch (err) {
        console.error(`[BudgetService] Exception in budget data query:`, err);
        
        // Safe error message extraction
        let errorMessage = 'Unknown error';
        if (err && typeof err === 'object') {
          if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          } else if (err.toString && typeof err.toString === 'function') {
            errorMessage = err.toString();
          }
        }
        
        budgetError = {
          message: `Exception querying budget: ${errorMessage}`
        };
      }

      if (budgetError) {
        console.error(`[BudgetService] Error fetching budget data for MIS ${misToSearch}:`, budgetError);
        if (budgetError.code === 'PGRST116' && budgetError.message.includes('no rows')) {
          // This is a "not found" error, not a server error, so return a structured response
          return {
            status: 'error',
            message: `Budget data not found for MIS: ${misToSearch}`,
            error: `No budget record exists with MIS: ${misToSearch}`
          };
        }
        throw budgetError;
      }

      if (!budgetData) {
        console.log(`[BudgetService] No budget data found for MIS: ${misToSearch}`);
        return {
          status: 'error',
          message: 'Budget data not found',
          error: 'No budget data returned from database'
        };
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
      
      // Calculate available budget
      const available_budget = parseFloat(katanomesEtous) - parseFloat(userView);
      const quarter_available = parseFloat(budgetData[quarterKey]?.toString() || '0') - parseFloat(userView);
      const yearly_available = parseFloat(ethsiaPistosi) - parseFloat(userView);
      
      // Return budget data with correct types
      const response: BudgetResponse = {
        status: 'success',
        data: {
          user_view: parseFloat(userView),
          total_budget: parseFloat(ethsiaPistosi),
          annual_budget: parseFloat(ethsiaPistosi),
          ethsia_pistosi: parseFloat(ethsiaPistosi),
          katanomes_etous: parseFloat(katanomesEtous),
          current_budget: parseFloat(userView),
          q1: parseFloat(budgetData.q1?.toString() || '0'),
          q2: parseFloat(budgetData.q2?.toString() || '0'),
          q3: parseFloat(budgetData.q3?.toString() || '0'),
          q4: parseFloat(budgetData.q4?.toString() || '0'),
          total_spent: parseFloat(totalSpent),
          available_budget: available_budget,
          quarter_available: quarter_available,
          yearly_available: yearly_available,
          current_quarter: quarterKey
        }
      };
      
      console.log(`[BudgetService] Returning budget data for MIS ${mis}:`, {
        ethsia_pistosi: response.data?.ethsia_pistosi,
        katanomes_etous: response.data?.katanomes_etous,
        user_view: response.data?.user_view,
        available_budget: response.data?.available_budget
      });
      
      return response;
    } catch (error: any) {
      console.error('[BudgetService] Error in getBudget:', error);
      return {
        status: 'error',
        message: 'Error fetching budget data',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Updates the budget for a project with expenditure
   * This applies a transaction amount to the budget and updates usage statistics
   * 
   * @param mis The MIS project code
   * @param amount The transaction amount to apply
   * @param userId The user ID making the transaction
   * @param sessionId Optional session ID for tracking
   * @param changeReason Optional reason for the budget change
   * @returns Status of the update operation
   */
  static async updateBudget(
    mis: string, 
    amount: number, 
    userId: string = 'system', 
    sessionId?: string,
    changeReason?: string
  ): Promise<{
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: any;
  }> {
    try {
      if (!mis) {
        console.error('[BudgetService] MIS parameter is required for updateBudget');
        return {
          status: 'error',
          message: 'MIS parameter is required'
        };
      }

      // Parse MIS based on format 
      let misToSearch: string | number = mis;
      let numericalMis: number | null = null;
      
      // Check if MIS is numeric or follows the pattern of project codes
      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      
      console.log(`[BudgetService] Update - Parameters: mis=${mis}, amount=${amount}, userId=${userId}`);
      
      // CASE 1: Project code format (like "2024ΝΑ85300001")
      if (projectCodePattern.test(mis)) {
        console.log(`[BudgetService] Update - MIS appears to be a project code: ${mis}`);
        
        // Try to find the project with matching NA853 field (project code)
        try {
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('na853', mis)
            .single();
          
          if (projectError && projectError.code !== 'PGRST116') {
            console.error(`[BudgetService] Update - Supabase error looking up project: ${projectError.message}`);
          }
            
          if (projectData?.mis) {
            console.log(`[BudgetService] Update - Found project with numeric MIS ${projectData.mis} for project code ${mis}`);
            // Convert to number since MIS is now int4 in the database
            numericalMis = parseInt(projectData.mis.toString());
            misToSearch = String(numericalMis); // Convert to string for consistency in search
          } else {
            console.log(`[BudgetService] Update - No project found with ID/code: ${mis}, will try to find by direct match`);
          }
        } catch (projectLookupError) {
          console.log(`[BudgetService] Update - Error looking up project by ID/code ${mis}:`, projectLookupError);
          // Continue with other strategies if lookup fails
        }
      }
      
      // CASE 2: Numeric MIS (either direct input or found from case 1)
      if (isNumericString || numericalMis !== null) {
        // If we don't already have a numerical MIS from case 1, parse it now
        if (numericalMis === null) {
          numericalMis = parseInt(mis);
          misToSearch = String(numericalMis); // Convert to string for consistency in search
        }
        console.log(`[BudgetService] Update - Using numerical MIS: ${misToSearch}`);
      } else {
        console.log(`[BudgetService] Update - Using original MIS string: ${misToSearch}`);
      }
      
      // First save the current state for history tracking
      await this.updateBudgetSumField(mis);
      
      // Get current budget with numeric MIS
      // Similar logic as in getBudget - handle integer column type
      let updateBudgetData;
      let error;

      try {
        // For numeric MIS, query directly against the integer column
        if (numericalMis !== null) {
          console.log(`[BudgetService] Update - Querying budget with numeric MIS: ${numericalMis}`);
          const result = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', numericalMis) // Use the number directly for integer column
            .single();
          
          updateBudgetData = result.data;
          error = result.error;
        } else {
          // Try direct query with original value (last resort)
          console.log(`[BudgetService] Update - Trying direct budget query with: ${misToSearch}`);
          const result = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', misToSearch)
            .single();
          
          updateBudgetData = result.data;
          error = result.error;
        }
      } catch (err) {
        console.error(`[BudgetService] Update - Exception in budget data query:`, err);
        
        // Safe error message extraction
        let errorMessage = 'Unknown error';
        if (err && typeof err === 'object') {
          if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          } else if (err.toString && typeof err.toString === 'function') {
            errorMessage = err.toString();
          }
        }
        
        error = {
          message: `Exception querying budget: ${errorMessage}`
        };
      }
        
      if (error || !updateBudgetData) {
        console.error(`[BudgetService] Update - Error fetching budget data: ${error?.message || 'Not found'}`);
        return {
          status: 'error',
          message: `Could not find budget for MIS: ${mis}`,
          details: error?.message
        };
      }
      
      // Apply the transaction to user_view
      const currentUserView = updateBudgetData.user_view || 0;
      const newUserView = currentUserView + amount;
      
      // Update the budget
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update({ 
          user_view: newUserView,
          last_quarter_check: `q${Math.ceil((new Date().getMonth() + 1) / 3)}`, // Update current quarter
          updated_at: new Date().toISOString()
        })
        .eq('mis', misToSearch);
        
      if (updateError) {
        console.error(`[BudgetService] Update - Error updating budget: ${updateError.message}`);
        return {
          status: 'error',
          message: 'Failed to update budget',
          details: updateError.message
        };
      }
      
      // Create a history entry
      try {
        const historyEntry = {
          project_mis: mis,
          amount: amount,
          user_id: userId,
          change_type: 'document_created',
          before_amount: currentUserView,
          after_amount: newUserView,
          quarter: `q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
          details: {
            timestamp: new Date().toISOString(),
            sessionId: sessionId || null
          }
        };
        
        const { error: historyError } = await supabase
          .from('budget_history')
          .insert(historyEntry);
          
        if (historyError) {
          console.warn(`[BudgetService] Update - Error creating history entry: ${historyError.message}`);
          // Non-fatal, continue
        } else {
          console.log(`[BudgetService] Update - Created history entry for MIS: ${mis}`);
        }
      } catch (historyError) {
        console.warn(`[BudgetService] Update - Exception in history creation: ${historyError}`);
        // Non-fatal, continue
      }
      
      console.log(`[BudgetService] Update - Successfully updated budget for MIS: ${mis}, new user_view: ${newUserView}`);
      
      // Perform a second update to the sum field to capture the new state
      await this.updateBudgetSumField(mis);
      
      return {
        status: 'success',
        message: 'Budget updated successfully',
        details: {
          previous: currentUserView,
          current: newUserView,
          difference: amount
        }
      };
    } catch (error: any) {
      console.error('[BudgetService] Update - Error in updateBudget:', error);
      return {
        status: 'error',
        message: 'Error updating budget',
        details: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Updates the budget sum field with current budget values
   * This is used for tracking changes over time
   * 
   * @param mis The MIS project code
   * @returns Success status
   */
  static async updateBudgetSumField(mis: string): Promise<boolean> {
    try {
      if (!mis) {
        console.error('[BudgetService] MIS parameter is required for updateBudgetSumField');
        return false;
      }
      
      // First get current budget data
      const budgetResult = await this.getBudget(mis);
      
      if (budgetResult.status !== 'success' || !budgetResult.data) {
        console.error(`[BudgetService] Could not get budget data for MIS ${mis} to update sum field`);
        return false;
      }
      
      // Prepare the JSON sum field
      const sumFieldData = {
        updated_at: new Date().toISOString(),
        user_view: budgetResult.data.user_view,
        ethsia_pistosi: budgetResult.data.ethsia_pistosi,
        current_quarter: budgetResult.data.current_quarter,
        katanomes_etous: budgetResult.data.katanomes_etous,
        available_budget: budgetResult.data.available_budget,
        yearly_available: budgetResult.data.yearly_available,
        quarter_available: budgetResult.data.quarter_available
      };
      
      console.log(`[BudgetService] Updating sum field for MIS ${mis}:`, sumFieldData);
      
      // Update the sum field in the database
      const { error } = await supabase
        .from('budget_na853_split')
        .update({ sum: sumFieldData })
        .eq('mis', mis);
      
      if (error) {
        console.error(`[BudgetService] Error updating sum field for MIS ${mis}:`, error);
        return false;
      }
      
      console.log(`[BudgetService] Successfully updated sum field for MIS ${mis}`);
      return true;
    } catch (error) {
      console.error('[BudgetService] Error in updateBudgetSumField:', error);
      return false;
    }
  }
}

export default BudgetService;