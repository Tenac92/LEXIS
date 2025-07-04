/**
 * Quarterly Transition Service
 * Handles automatic quarterly transitions in the budget system
 * 
 * Logic: At quarter end (e.g., 31/05/2025 23:59), transition Q2→Q3
 * Formula: q3 = q3 + q2 - user_view
 * Update: last_quarter_check = 'q3'
 */

import { executeSQL } from '../drizzle';
import { logger } from '../utils/logger';

interface QuarterTransitionResult {
  success: boolean;
  transitionsProcessed: number;
  errors: string[];
}

/**
 * Get the current quarter based on date
 */
function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() is 0-based
  
  if (month >= 1 && month <= 3) return 'q1';
  if (month >= 4 && month <= 6) return 'q2';
  if (month >= 7 && month <= 9) return 'q3';
  return 'q4';
}

/**
 * Get the next quarter
 */
function getNextQuarter(currentQuarter: string): string {
  switch (currentQuarter) {
    case 'q1': return 'q2';
    case 'q2': return 'q3';
    case 'q3': return 'q4';
    case 'q4': return 'q1'; // Year rollover
    default: return 'q1';
  }
}

/**
 * Check if we're at a quarter transition point
 * Returns true if it's the last day of a quarter after 23:59
 */
function isQuarterTransitionTime(): boolean {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  
  // Check if it's the last day of a quarter and after 23:59
  const isLastDayOfQuarter = (
    (month === 3 && day === 31) ||  // Q1 end
    (month === 6 && day === 30) ||  // Q2 end
    (month === 9 && day === 30) ||  // Q3 end
    (month === 12 && day === 31)    // Q4 end
  );
  
  return isLastDayOfQuarter && hour >= 23;
}

/**
 * Process quarterly transition for projects that need it
 */
export async function processQuarterlyTransitions(): Promise<QuarterTransitionResult> {
  const result: QuarterTransitionResult = {
    success: true,
    transitionsProcessed: 0,
    errors: []
  };

  try {
    const currentQuarter = getCurrentQuarter();
    const previousQuarter = getPreviousQuarter(currentQuarter);
    
    logger.info('[QuarterlyTransition] Starting transition check', {
      currentQuarter,
      previousQuarter,
      timestamp: new Date().toISOString()
    });

    // Find projects that need quarterly transition
    const projectsNeedingTransition = await executeSQL(`
      SELECT mis, na853, user_view, q1, q2, q3, q4, last_quarter_check
      FROM project_budget 
      WHERE last_quarter_check != $1
    `, [currentQuarter]);

    if (!projectsNeedingTransition.rows || projectsNeedingTransition.rows.length === 0) {
      logger.info('[QuarterlyTransition] No projects need transition');
      return result;
    }

    // Process each project
    for (const project of projectsNeedingTransition.rows) {
      try {
        await processProjectTransition(project, currentQuarter, previousQuarter);
        result.transitionsProcessed++;
        
        logger.info('[QuarterlyTransition] Processed project transition', {
          mis: project.mis,
          na853: project.na853,
          from: previousQuarter,
          to: currentQuarter
        });
      } catch (error) {
        const errorMsg = `Failed to process transition for project ${project.mis}: ${error}`;
        result.errors.push(errorMsg);
        logger.error('[QuarterlyTransition] Project transition failed', {
          mis: project.mis,
          error: errorMsg
        });
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    logger.info('[QuarterlyTransition] Transition process completed', {
      processed: result.transitionsProcessed,
      errors: result.errors.length,
      success: result.success
    });

  } catch (error) {
    result.success = false;
    result.errors.push(`Quarterly transition failed: ${error}`);
    logger.error('[QuarterlyTransition] Critical error', { error });
  }

  return result;
}

/**
 * Process transition for a single project
 * Formula: nextQuarter = nextQuarter + currentQuarter - user_view
 */
async function processProjectTransition(
  project: any, 
  currentQuarter: string, 
  previousQuarter: string
): Promise<void> {
  const { mis, user_view, q1, q2, q3, q4 } = project;
  
  // Get current and next quarter values
  const currentQuarterValue = getQuarterValue(project, previousQuarter);
  const nextQuarterValue = getQuarterValue(project, currentQuarter);
  
  // Apply transition formula: nextQuarter = nextQuarter + currentQuarter - user_view
  const newNextQuarterValue = nextQuarterValue + currentQuarterValue - user_view;
  
  // Build update query based on which quarter we're transitioning to
  const quarterField = currentQuarter;
  
  await executeSQL(`
    UPDATE project_budget 
    SET ${quarterField} = $1,
        last_quarter_check = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE mis = $3
  `, [newNextQuarterValue, currentQuarter, mis]);
  
  // Update the sum JSON field to reflect the changes
  await updateProjectSumField(mis);
}

/**
 * Get quarter value from project data
 */
function getQuarterValue(project: any, quarter: string): number {
  switch (quarter) {
    case 'q1': return project.q1 || 0;
    case 'q2': return project.q2 || 0;
    case 'q3': return project.q3 || 0;
    case 'q4': return project.q4 || 0;
    default: return 0;
  }
}

/**
 * Get the previous quarter
 */
function getPreviousQuarter(currentQuarter: string): string {
  switch (currentQuarter) {
    case 'q1': return 'q4';
    case 'q2': return 'q1';
    case 'q3': return 'q2';
    case 'q4': return 'q3';
    default: return 'q1';
  }
}

/**
 * Update the sum JSON field for a project
 */
async function updateProjectSumField(mis: number): Promise<void> {
  const projectData = await executeSQL(`
    SELECT * FROM project_budget WHERE mis = $1
  `, [mis]);
  
  if (projectData.rows && projectData.rows.length > 0) {
    const project = projectData.rows[0];
    const currentQuarter = getCurrentQuarter();
    
    // Calculate available budgets
    const available_budget = Math.max(0, project.katanomes_etous - project.user_view);
    const yearly_available = Math.max(0, project.ethsia_pistosi - project.user_view);
    
    const sumData = {
      user_view: project.user_view,
      updated_at: new Date().toISOString(),
      ethsia_pistosi: project.ethsia_pistosi,
      current_quarter: currentQuarter,
      katanomes_etous: project.katanomes_etous,
      available_budget,
      yearly_available,
      quarter_available: available_budget
    };
    
    await executeSQL(`
      UPDATE project_budget 
      SET sum = $1 
      WHERE mis = $2
    `, [JSON.stringify(sumData), mis]);
  }
}

/**
 * Manual trigger for quarterly transition (for testing/admin use)
 */
export async function manualQuarterlyTransition(targetQuarter?: string): Promise<QuarterTransitionResult> {
  const quarter = targetQuarter || getCurrentQuarter();
  
  logger.info('[QuarterlyTransition] Manual transition triggered', {
    targetQuarter: quarter,
    timestamp: new Date().toISOString()
  });
  
  return processQuarterlyTransitions();
}

/**
 * Check if quarterly transition should run (called by cron job)
 */
export async function checkAndRunQuarterlyTransition(): Promise<void> {
  if (isQuarterTransitionTime()) {
    logger.info('[QuarterlyTransition] Quarter transition time detected, starting process');
    await processQuarterlyTransitions();
  }
}