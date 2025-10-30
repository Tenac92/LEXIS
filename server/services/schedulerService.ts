/**
 * Scheduler Service
 * 
 * Manages scheduled tasks like automated quarter transitions
 * Uses node-cron for scheduling background jobs
 */

import cron from 'node-cron';
import { supabase } from '../config/db';
// Import logger from the correct path
// First try the utils directory, fall back to direct console if not found
let logger: any;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger;
} catch (e) {
  // Fallback logger if the module is not available
  logger = {
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
  };
}
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
    const { data: budgetsToUpdate, error: queryError } = await supabase
      .from('project_budget')
      .select('id, mis, na853, last_quarter_check, q1, q2, q3, q4, user_view, sum');
    
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
 * @param budget The budget record to update
 * @param newQuarterKey The new quarter key (q1, q2, q3, q4)
 * @param wss WebSocket server for notifications (optional)
 */
async function updateBudgetQuarter(budget: any, newQuarterKey: 'q1' | 'q2' | 'q3' | 'q4', wss?: WebSocketServer) {
  try {
    // Get the old quarter key and values
    const oldQuarterKey = budget.last_quarter_check || 'q1';
    
    // Skip if already on the current quarter
    if (oldQuarterKey === newQuarterKey) {
      return;
    }
    
    logger.info(`[Quarter Transition] Updating budget ${budget.mis} from ${oldQuarterKey} to ${newQuarterKey}`);
    
    // Get quarter values
    let oldQuarterValue = 0;
    let newQuarterValue = 0;
    
    switch(oldQuarterKey) {
      case 'q1': oldQuarterValue = budget.q1 || 0; break;
      case 'q2': oldQuarterValue = budget.q2 || 0; break;
      case 'q3': oldQuarterValue = budget.q3 || 0; break;
      case 'q4': oldQuarterValue = budget.q4 || 0; break;
    }
    
    switch(newQuarterKey) {
      case 'q1': newQuarterValue = budget.q1 || 0; break;
      case 'q2': newQuarterValue = budget.q2 || 0; break;
      case 'q3': newQuarterValue = budget.q3 || 0; break;
      case 'q4': newQuarterValue = budget.q4 || 0; break;
    }
    
    // Apply quarter transition formula: nextQuarter = nextQuarter + currentQuarter - user_view
    const userView = budget.user_view || 0;
    const transferAmount = Math.max(0, oldQuarterValue - userView);
    const updatedNewQuarterValue = newQuarterValue + transferAmount;
    const quarterAvailable = Math.max(0, updatedNewQuarterValue - userView);
    
    logger.info(`[Quarter Transition] Budget ${budget.mis}: transferring ${transferAmount} from ${oldQuarterKey} to ${newQuarterKey}`);
    
    // Prepare the sum object if it doesn't exist
    let sumObject = budget.sum || {};
    if (typeof sumObject !== 'object') {
      sumObject = {};
    }
    
    // Create the quarter change history in the sum object
    if (!sumObject.quarters) {
      sumObject.quarters = {};
    }
    
    // Record the quarter change
    sumObject.quarters[newQuarterKey] = {
      previous: oldQuarterValue,
      new: updatedNewQuarterValue,
      transferred: transferAmount,
      changed_at: new Date().toISOString()
    };
    
    // Build dynamic update object with the new quarter value
    const updateData: any = {
      last_quarter_check: newQuarterKey,
      quarter_available: quarterAvailable,
      sum: sumObject,
      updated_at: new Date().toISOString()
    };
    
    // Set the new quarter value
    updateData[newQuarterKey] = updatedNewQuarterValue;
    
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
    await createQuarterChangeHistoryEntry(budget.mis, oldQuarterKey, newQuarterKey, oldQuarterValue, newQuarterValue);
    
    // Send notification about the quarter change
    if (wss) {
      // Just send a generic message notification
      // This will avoid the typing issues with BudgetNotification
      const notificationMessage = {
        type: 'system_message',
        message: `Αλλαγή Τριμήνου: Το έργο ${budget.mis} μεταφέρθηκε από το τρίμηνο ${oldQuarterKey.toUpperCase()} στο ${newQuarterKey.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        projectInfo: {
          mis: budget.mis,
          oldQuarter: oldQuarterKey,
          newQuarter: newQuarterKey,
          oldValue: oldQuarterValue,
          newValue: newQuarterValue
        }
      };
      
      // Send the notification
      broadcastNotification(wss, notificationMessage as any);
    }
    
    logger.info(`[Quarter Transition] Successfully updated budget ${budget.mis} to quarter ${newQuarterKey}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Quarter Transition] Error updating budget ${budget.mis}: ${errorMessage}`);
  }
}

/**
 * Create a history entry for the quarter change
 * @param mis Project MIS
 * @param oldQuarter Previous quarter
 * @param newQuarter New quarter
 * @param oldValue Previous quarter value
 * @param newValue New quarter value
 */
async function createQuarterChangeHistoryEntry(
  mis: string | number,
  oldQuarter: string,
  newQuarter: string,
  oldValue: number,
  newValue: number
) {
  try {
    // Create an entry in the budget_history table
    const { error } = await supabase
      .from('budget_history')
      .insert({
        mis: mis,
        change_type: 'quarter_change',
        amount: newValue,
        timestamp: new Date().toISOString(),
        metadata: {
          old_quarter: oldQuarter,
          new_quarter: newQuarter,
          old_value: oldValue,
          new_value: newValue,
          quarters: {
            [newQuarter]: {
              previous: oldValue,
              new: newValue
            }
          },
          operation_type: 'quarter_change',
          active_quarter: newQuarter
        }
      });
    
    if (error) {
      logger.error(`[Quarter Transition] Error creating history entry for ${mis}: ${error.message}`);
    } else {
      logger.info(`[Quarter Transition] Created history entry for ${mis} quarter change`);
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