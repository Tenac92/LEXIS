/**
 * Scheduler Service
 * 
 * Manages scheduled tasks like automated quarter transitions
 * Uses node-cron for scheduling background jobs
 */

import cron from 'node-cron';
import { supabase } from '../config/db';
import { logger as appLogger } from '../utils/logger';

const logger = appLogger;
import type { WebSocketServer } from 'ws';
import { broadcastNotification } from '../websocket';

/**
 * Schedule all tasks needed by the application
 * @param wss WebSocket server instance for notifications (optional)
 */
export function initializeScheduledTasks(wss?: WebSocketServer) {
  // Schedule quarter change check for midnight on the first day of each quarter
  // Runs at 00:01 on Jan 1, Apr 1, Jul 1, and Oct 1
  scheduleQuarterTransition(wss);
  
  // Schedule year-end closure for Dec 31 23:59:59
  scheduleYearEndClosure(wss);
  
  // Also run an immediate check to ensure everything is working
  setTimeout(() => {
    logger.info('[Scheduler] Running initial quarter verification check to ensure system is properly set up');
    processQuarterTransition(wss, true); // Keep verification-only for startup check
  }, 5000); // Wait 5 seconds to let everything initialize
  
  logger.info('[Scheduler] Initialized scheduled tasks');
}

/**
 * Schedule the quarterly transition task
 * @param wss WebSocket server for notifications (optional)
 */
function scheduleQuarterTransition(wss?: WebSocketServer) {
  // Run at 23:59 on the last day of each quarter (Mar 31, Jun 30, Sep 30, Dec 31)
  // This ensures budgets are updated at quarter end, not quarter start
  // Cron format: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) weekday(0-6)
  cron.schedule('59 23 31 3,12 *', async () => { // Mar 31, Dec 31
    logger.info('[Scheduler] Running scheduled quarter transition (Q1/Q4 end)');
    await processQuarterTransition(wss);
  });
  cron.schedule('59 23 30 6,9 *', async () => { // Jun 30, Sep 30
    logger.info('[Scheduler] Running scheduled quarter transition (Q2/Q3 end)');
    await processQuarterTransition(wss);
  });
  
  // Also schedule a mid-quarter verification check (15th day of each quarter)
  cron.schedule('1 0 15 2,5,8,11 *', async () => {
    logger.info('[Scheduler] Running mid-quarter verification check');
    await processQuarterTransition(wss, true); // verification mode only
  });
  
  logger.info('[Scheduler] Quarter transition scheduled for 23:59 on last day of each quarter');
}

/**
 * Process the quarter transition for all budget records
 * @param wss WebSocket server for notifications (optional - will work without notifications if not provided)
 * @param isVerificationOnly Whether this is just a verification run
 */
export async function processQuarterTransition(wss?: WebSocketServer, isVerificationOnly = false) {
  try {
    // Get current date and determine the current quarter
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
    const currentQuarterNumber = Math.ceil(currentMonth / 3);
    const currentQuarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';
    
    logger.info(`[Quarter Transition] Processing quarter transition to ${currentQuarterKey}`);
    
    // First, check which budgets need updating (where last_quarter_check is not equal to current quarter)
    // CRITICAL: Must include current_quarter_spent to properly calculate carried forward amounts
    const { data: budgetsToUpdate, error: queryError } = await supabase
      .from('project_budget')
      .select('id, mis, na853, last_quarter_check, q1, q2, q3, q4, user_view, current_quarter_spent, sum, project_id');
    
    if (queryError) {
      logger.error(`[Quarter Transition] Error querying budgets: ${queryError.message}`);
      return;
    }
    
    if (!budgetsToUpdate || budgetsToUpdate.length === 0) {
      logger.info('[Quarter Transition] No budgets found to update');
      return;
    }
    
    logger.info(`[Quarter Transition] Found ${budgetsToUpdate.length} budget records to process`);
    
    const budgetsRequiringUpdate = budgetsToUpdate.filter((budget: any) => {
      // Convert last_quarter_check to q1, q2, q3, q4 format
      const lastCheckedQuarter = budget.last_quarter_check || 'q1';
      return lastCheckedQuarter !== currentQuarterKey;
    });
    
    logger.info(`[Quarter Transition] ${budgetsRequiringUpdate.length} budgets need quarter updates`);
    
    if (isVerificationOnly) {
      logger.info('[Quarter Transition] Verification mode - would update these budgets:', 
        budgetsRequiringUpdate.map((b: any) => b.mis).join(', '));
      return;
    }
    
    // Process each budget that needs updating
    for (const budget of budgetsRequiringUpdate) {
      await updateBudgetQuarter(budget, currentQuarterKey, wss);
    }
    
    logger.info('[Quarter Transition] Completed quarter transition process');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Quarter Transition] Error in quarter transition process: ${errorMessage}`);
  }
}

/**
 * Update an individual budget record for quarter transition
 * 
 * CRITICAL: Q1, Q2, Q3, Q4 columns contain FIXED budget allocations and should NEVER be modified.
 * Instead, we track accumulated unspent budget in sum.carried_forward.
 * 
 * This function processes quarter transitions SEQUENTIALLY to ensure all intermediate quarters'
 * allocations are properly accumulated. For example, if transitioning from Q1 to Q4, it will:
 * 1. Process Q1 → Q2 (accumulate Q1 allocation + any unspent)
 * 2. Process Q2 → Q3 (accumulate Q2 allocation + carried forward from Q1)
 * 3. Process Q3 → Q4 (accumulate Q3 allocation + carried forward from Q2)
 * 
 * Formula: new_carried_forward = (current_quarter_allocation + previous_carried_forward) - current_quarter_spent
 * 
 * @param budget The budget record to update
 * @param targetQuarterKey The target quarter key (q1, q2, q3, q4)
 * @param wss WebSocket server for notifications (optional)
 */
async function updateBudgetQuarter(budget: any, targetQuarterKey: 'q1' | 'q2' | 'q3' | 'q4', wss?: WebSocketServer) {
  try {
    // Get the old quarter key
    const startQuarterKey = budget.last_quarter_check || 'q1';
    
    // Skip if already on the target quarter
    if (startQuarterKey === targetQuarterKey) {
      return;
    }
    
    logger.info(`[Quarter Transition] Updating budget ${budget.mis} from ${startQuarterKey} to ${targetQuarterKey}`);
    
    // Map quarter keys to numbers for sequential processing
    const quarterMap: Record<'q1' | 'q2' | 'q3' | 'q4', number> = { q1: 1, q2: 2, q3: 3, q4: 4 };
    const startQuarter = quarterMap[(startQuarterKey as any) as 'q1'];
    const targetQuarter = quarterMap[(targetQuarterKey as any) as 'q1'];
    
    // Prepare the sum object if it doesn't exist
    let sumObject = budget.sum || {};
    if (typeof sumObject !== 'object') {
      sumObject = {};
    }
    
    // Initialize quarters history object
    if (!sumObject.quarters) {
      sumObject.quarters = {};
    }
    
    // Get initial carried forward amount
    let carriedForward = parseFloat(String(sumObject.carried_forward || 0));
    
    // Get current quarter spent (only applies to the starting quarter)
    const currentQuarterSpent = parseFloat(String(budget.current_quarter_spent || 0));
    
    // Determine the quarters to process
    const quarters: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];
    const quartersToProcess: Array<'q1' | 'q2' | 'q3' | 'q4'> = [];
    
    // Build the list of quarters to process
    // Handle both same-year (Q1→Q4) and year-wrap (Q4→Q1)
    if (targetQuarter > startQuarter) {
      // Same year progression: Q1→Q2, Q2→Q3, Q3→Q4
      for (let q = startQuarter; q < targetQuarter; q++) {
        quartersToProcess.push(quarters[q - 1]);
      }
    } else if (targetQuarter < startQuarter) {
      // Year-end wrap-around: Q4→Q1, Q4→Q2, etc.
      // Process remaining quarters in current year (e.g., Q4)
      for (let q = startQuarter; q <= 4; q++) {
        quartersToProcess.push(quarters[q - 1]);
      }
      // Then process quarters in new year up to target (e.g., Q1, Q2)
      for (let q = 1; q < targetQuarter; q++) {
        quartersToProcess.push(quarters[q - 1]);
      }
    }
    
    logger.info(`[Quarter Transition] Processing sequential transitions from Q${startQuarter} to Q${targetQuarter}`);
    logger.info(`[Quarter Transition] Quarters to process: ${quartersToProcess.join(' → ')}`);
    
    // Process each quarter transition sequentially
    for (let i = 0; i < quartersToProcess.length; i++) {
      const oldQuarterKey = quartersToProcess[i];
      const newQuarterKey = i < quartersToProcess.length - 1 
        ? quartersToProcess[i + 1] 
        : targetQuarterKey;
      
      // Get the FIXED quarter allocation for the OLD quarter (the one we're leaving)
      const oldQuarterAllocation = parseFloat(String(budget[oldQuarterKey] || 0));
      
      // Calculate spending (only for the very first quarter we're leaving, subsequent ones have 0 spending)
      const quarterSpent = (i === 0) ? currentQuarterSpent : 0;
      
      // Calculate what's being carried forward FROM this quarter TO the next
      // Formula: (current quarter allocation + previous carried forward) - spending
      const totalAvailable = oldQuarterAllocation + carriedForward;
      const unspentAmount = Math.max(0, totalAvailable - quarterSpent);
      
      logger.info(`[Quarter Transition] Processing ${oldQuarterKey} → ${newQuarterKey}:`);
      logger.info(`  ${oldQuarterKey} allocation: ${oldQuarterAllocation}`);
      logger.info(`  Carried forward into ${oldQuarterKey}: ${carriedForward}`);
      logger.info(`  Total available in ${oldQuarterKey}: ${totalAvailable}`);
      logger.info(`  Spent in ${oldQuarterKey}: ${quarterSpent}`);
      logger.info(`  Unspent carrying to ${newQuarterKey}: ${unspentAmount}`);
      
      // Update carried forward for the next iteration
      carriedForward = unspentAmount;
      
      // Record this transition in the quarters history
      sumObject.quarters[newQuarterKey] = {
        transition_date: new Date().toISOString(),
        from_quarter: oldQuarterKey,
        old_quarter_allocation: oldQuarterAllocation,
        previous_carried_forward: totalAvailable - oldQuarterAllocation,
        quarter_spent: quarterSpent,
        new_carried_forward: carriedForward,
        new_quarter_allocation: parseFloat(String(budget[newQuarterKey] || 0)),
        total_available_in_new_quarter: carriedForward + parseFloat(String(budget[newQuarterKey] || 0))
      };
    }
    
    // Final carried forward amount after all sequential transitions
    const finalCarriedForward = carriedForward;
    const targetQuarterAllocation = parseFloat(String(budget[targetQuarterKey] || 0));
    const totalAvailableInTarget = finalCarriedForward + targetQuarterAllocation;
    
    logger.info(`[Quarter Transition] Final result for budget ${budget.mis}:`);
    logger.info(`  Target quarter: ${targetQuarterKey}`);
    logger.info(`  Carried forward to ${targetQuarterKey}: ${finalCarriedForward}`);
    logger.info(`  ${targetQuarterKey} allocation: ${targetQuarterAllocation}`);
    logger.info(`  Total available in ${targetQuarterKey}: ${totalAvailableInTarget}`);
    
    // Update carried forward in sum object
    sumObject.carried_forward = finalCarriedForward;
    
    // Build update object - IMPORTANT: DO NOT modify q1, q2, q3, q4 columns
    const updateData: any = {
      last_quarter_check: targetQuarterKey,
      current_quarter_spent: 0, // Reset quarter spending tracker for new quarter
      sum: sumObject,
      updated_at: new Date().toISOString()
    };
    
    // Update the budget record
    const { error: updateError } = await supabase
      .from('project_budget')
      .update(updateData)
      .eq('id', budget.id);
    
    if (updateError) {
      logger.error(`[Quarter Transition] Error updating budget ${budget.mis}: ${updateError.message}`);
      return;
    }
    
    // Create a budget history entry for the quarter change
    await createQuarterChangeHistoryEntry(
      budget.project_id, 
      startQuarterKey, 
      targetQuarterKey, 
      parseFloat(String(budget[startQuarterKey] || 0)) + parseFloat(String(sumObject.carried_forward || 0)),
      totalAvailableInTarget,
      finalCarriedForward
    );
    
    // Send notification about the quarter change
    if (wss) {
      const notificationMessage = {
        type: 'system_message',
        message: `Αλλαγή Τριμήνου: Το έργο ${budget.mis} μεταφέρθηκε από το τρίμηνο ${startQuarterKey.toUpperCase()} στο ${targetQuarterKey.toUpperCase()}. Διαθέσιμο υπόλοιπο: €${totalAvailableInTarget.toFixed(2)}`,
        timestamp: new Date().toISOString(),
        projectInfo: {
          mis: budget.mis,
          oldQuarter: startQuarterKey,
          newQuarter: targetQuarterKey,
          carriedForward: finalCarriedForward,
          newQuarterAllocation: targetQuarterAllocation,
          totalAvailable: totalAvailableInTarget
        }
      };
      
      broadcastNotification(wss, notificationMessage as any);
    }
    
    logger.info(`[Quarter Transition] Successfully updated budget ${budget.mis} to quarter ${targetQuarterKey}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Quarter Transition] Error updating budget ${budget.mis}: ${errorMessage}`);
  }
}

/**
 * Create a history entry for the quarter change
 * @param projectId Project ID
 * @param oldQuarter Previous quarter
 * @param newQuarter New quarter
 * @param oldValue Previous quarter value
 * @param newValue New quarter value
 * @param transferAmount Amount transferred from old quarter
 */
async function createQuarterChangeHistoryEntry(
  projectId: number,
  oldQuarter: string,
  newQuarter: string,
  oldValue: number,
  newValue: number,
  transferAmount: number
) {
  try {
    // Create an entry in the budget_history table
    const { error } = await supabase
      .from('budget_history')
      .insert({
        project_id: projectId,
        previous_amount: String(oldValue),
        new_amount: String(newValue),
        change_type: 'quarter_change',
        change_reason: `Quarter transition: ${oldQuarter} → ${newQuarter}, transferred ${transferAmount}`
      });
    
    if (error) {
      logger.error(`[Quarter Transition] Error creating history entry for project ${projectId}: ${error.message}`);
    } else {
      logger.info(`[Quarter Transition] Created history entry for project ${projectId} quarter change`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Quarter Transition] Error creating history: ${errorMessage}`);
  }
}

/**
 * Run a manual quarter transition check and update
 * This can be triggered from an admin API endpoint
 * @param wss WebSocket server for notifications (optional)
 */
export async function manualQuarterTransitionCheck(wss?: WebSocketServer) {
  logger.info('[Quarter Transition] Manual quarter transition check initiated');
  await processQuarterTransition(wss);
  return { success: true, message: 'Quarter transition check completed' };
}

/**
 * Schedule the year-end closure task
 * Runs on Dec 31 at 23:59:59 every year
 * @param wss WebSocket server for notifications (optional)
 */
function scheduleYearEndClosure(wss?: WebSocketServer) {
  // Run at 23:59:59 on December 31st every year
  // Cron format: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) weekday(0-6)
  cron.schedule('59 59 23 31 12 *', async () => {
    logger.info('[Year-End Closure] Running scheduled year-end closure');
    await processYearEndClosure(wss);
  });
  
  logger.info('[Scheduler] Year-end closure scheduled for 23:59:59 on December 31st');
}

/**
 * Process year-end closure for all budget records
 * Saves user_view to year_close JSONB with year as key, resets user_view to 0, and resets quarter to q1
 * @param wss WebSocket server for notifications (optional)
 */
export async function processYearEndClosure(wss?: WebSocketServer) {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    logger.info(`[Year-End Closure] Processing year-end closure for year ${currentYear}`);
    
    // Fetch all budget records
    const { data: budgets, error: queryError } = await supabase
      .from('project_budget')
      .select('id, mis, na853, user_view, year_close, last_quarter_check');
    
    if (queryError) {
      logger.error(`[Year-End Closure] Error querying budgets: ${queryError.message}`);
      return { success: false, error: queryError.message };
    }
    
    if (!budgets || budgets.length === 0) {
      logger.info('[Year-End Closure] No budgets found to process');
      return { success: true, message: 'No budgets to process' };
    }
    
    logger.info(`[Year-End Closure] Processing ${budgets.length} budget records`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each budget
    for (const budget of budgets) {
      const result = await processYearEndClosureForBudget(budget, currentYear, wss);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    logger.info(`[Year-End Closure] Completed: ${successCount} successful, ${errorCount} errors`);
    
    // Send WebSocket notification
    if (wss) {
      const notificationMessage = {
        type: 'system_message',
        message: `Κλείσιμο Έτους ${currentYear}: Επεξεργάστηκαν ${successCount} προϋπολογισμοί επιτυχώς`,
        timestamp: new Date().toISOString(),
        yearEndInfo: {
          year: currentYear,
          totalProcessed: budgets.length,
          successful: successCount,
          errors: errorCount
        }
      };
      
      broadcastNotification(wss, notificationMessage as any);
    }
    
    return { 
      success: true, 
      message: 'Year-end closure completed',
      stats: {
        year: currentYear,
        totalProcessed: budgets.length,
        successful: successCount,
        errors: errorCount
      }
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Year-End Closure] Error in year-end closure process: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Process year-end closure for a single budget record
 * @param budget The budget record to process
 * @param year The year being closed
 * @param wss WebSocket server for notifications (optional)
 */
async function processYearEndClosureForBudget(budget: any, year: number, _wss?: WebSocketServer) {
  try {
    const userView = budget.user_view || 0;
    
    // Skip if user_view is 0
    if (userView === 0) {
      logger.info(`[Year-End Closure] Budget ${budget.mis}: user_view is 0, skipping`);
      return { success: true, skipped: true };
    }
    
    logger.info(`[Year-End Closure] Processing budget ${budget.mis}: saving user_view ${userView} for year ${year}`);
    
    // Prepare year_close object
    let yearCloseObject = budget.year_close || {};
    if (typeof yearCloseObject !== 'object') {
      yearCloseObject = {};
    }
    
    // Add current year's user_view to year_close
    yearCloseObject[year.toString()] = userView;
    
    // Update the budget record: save user_view to year_close, reset user_view and current_quarter_spent to 0, reset quarter to q1
    const { error: updateError } = await supabase
      .from('project_budget')
      .update({
        year_close: yearCloseObject,
        user_view: 0,
        current_quarter_spent: 0,
        last_quarter_check: 'q1',
        updated_at: new Date().toISOString()
      })
      .eq('id', budget.id);
    
    if (updateError) {
      logger.error(`[Year-End Closure] Error updating budget ${budget.mis}: ${updateError.message}`);
      return { success: false, error: updateError.message };
    }
    
    // Create a history entry
    await createYearEndClosureHistoryEntry(budget.project_id, year, userView);
    
    logger.info(`[Year-End Closure] Successfully processed budget ${budget.mis}`);
    
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Year-End Closure] Error processing budget ${budget.mis}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Create a history entry for the year-end closure
 * @param projectId Project ID
 * @param year Year being closed
 * @param closedAmount Amount saved to year_close
 */
async function createYearEndClosureHistoryEntry(projectId: number, year: number, closedAmount: number) {
  try {
    const { error } = await supabase
      .from('budget_history')
      .insert({
        project_id: projectId,
        previous_amount: String(closedAmount),
        new_amount: '0',
        change_type: 'year_end_closure',
        change_reason: `Κλείσιμο έτους ${year}: Αρχειοθέτηση €${closedAmount.toFixed(2)} στο year_close και μηδενισμός user_view`,
        document_id: null,
        created_by: null
      });
    
    if (error) {
      logger.error(`[Year-End Closure] Error creating history entry for project ${projectId}: ${error.message}`);
    } else {
      logger.info(`[Year-End Closure] Created history entry for project ${projectId} year-end closure`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Year-End Closure] Error creating history: ${errorMessage}`);
  }
}

/**
 * Run a manual year-end closure
 * This can be triggered from an admin API endpoint
 * @param wss WebSocket server for notifications (optional)
 */
export async function manualYearEndClosure(wss?: WebSocketServer) {
  logger.info('[Year-End Closure] Manual year-end closure initiated');
  const result = await processYearEndClosure(wss);
  return result;
}
