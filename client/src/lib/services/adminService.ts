/**
 * Admin Service
 * 
 * Provides functionality for administrative tasks such as 
 * quarter transitions and system diagnostics.
 */

import { apiRequest } from '../queryClient';
import { toast } from '@/hooks/use-toast';

interface QuarterTransitionResult {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
}

interface QuarterTransitionStatus {
  success: boolean;
  current_quarter: string;
  current_date: string;
  next_scheduled_check: string;
  error?: string;
}

interface YearEndClosureResult {
  success: boolean;
  message: string;
  stats?: {
    year: number;
    totalProcessed: number;
    successful: number;
    errors: number;
  };
  error?: string;
}

interface YearEndClosureStatus {
  success: boolean;
  current_year: number;
  current_date: string;
  next_scheduled_closure: string;
  days_until_closure: number;
  error?: string;
}

/**
 * Initiate a quarter transition check
 * This will identify budgets that need quarter updates and process them
 */
export async function checkQuarterTransition(): Promise<QuarterTransitionResult> {
  try {
    const result = await apiRequest('/api/admin/quarter-transition/check', {
      method: 'POST',
    }) as QuarterTransitionResult;
    
    if (result.success) {
      toast({
        title: 'Quarter Transition Check',
        description: 'The quarter transition check was initiated successfully.',
        variant: 'default',
      });
    } else {
      toast({
        title: 'Quarter Transition Check Failed',
        description: result.message || 'An error occurred during the quarter transition check.',
        variant: 'destructive',
      });
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in quarter transition check:', error);
    
    toast({
      title: 'Quarter Transition Check Failed',
      description: error.message || 'An unexpected error occurred.',
      variant: 'destructive',
    });
    
    return {
      success: false,
      message: 'Failed to initiate quarter transition check',
      error: error.message
    };
  }
}

/**
 * Force a quarter transition to process
 * This will update all budgets regardless of their current state
 */
export async function forceQuarterTransition(quarter?: number): Promise<QuarterTransitionResult> {
  try {
    const payload = quarter ? { quarter } : {};
    
    const result = await apiRequest('/api/admin/quarter-transition/force', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      }
    }) as QuarterTransitionResult;
    
    if (result.success) {
      toast({
        title: 'Quarter Transition Processed',
        description: 'The quarter transition was processed successfully.',
        variant: 'default',
      });
    } else {
      toast({
        title: 'Quarter Transition Failed',
        description: result.message || 'An error occurred during the quarter transition.',
        variant: 'destructive',
      });
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in forced quarter transition:', error);
    
    toast({
      title: 'Quarter Transition Failed',
      description: error.message || 'An unexpected error occurred.',
      variant: 'destructive',
    });
    
    return {
      success: false,
      message: 'Failed to process quarter transition',
      error: error.message
    };
  }
}

/**
 * Get the current quarter transition status
 * This includes information about the current quarter and next scheduled check
 */
export async function getQuarterTransitionStatus(): Promise<QuarterTransitionStatus> {
  try {
    const result = await apiRequest('/api/admin/quarter-transition/status', {
      method: 'GET',
    }) as QuarterTransitionStatus;
    
    return result;
  } catch (error: any) {
    console.error('Error getting quarter transition status:', error);
    
    return {
      success: false,
      current_quarter: 'unknown',
      current_date: new Date().toISOString(),
      next_scheduled_check: 'unknown',
      error: error.message
    };
  }
}

/**
 * Run a manual year-end closure
 * Saves user_view to year_close, resets user_view to 0, and resets quarter to q1
 */
export async function runYearEndClosure(): Promise<YearEndClosureResult> {
  try {
    const result = await apiRequest('/api/admin/year-end-closure/run', {
      method: 'POST',
    }) as YearEndClosureResult;
    
    if (result.success) {
      const stats = result.stats || { successful: 0, totalProcessed: 0, year: new Date().getFullYear(), errors: 0 };
      toast({
        title: 'Κλείσιμο Έτους Ολοκληρώθηκε',
        description: `Επεξεργάστηκαν ${stats.successful} προϋπολογισμοί επιτυχώς από ${stats.totalProcessed} συνολικά.`,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Κλείσιμο Έτους Απέτυχε',
        description: result.message || 'Παρουσιάστηκε σφάλμα κατά το κλείσιμο του έτους.',
        variant: 'destructive',
      });
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in year-end closure:', error);
    
    toast({
      title: 'Κλείσιμο Έτους Απέτυχε',
      description: error.message || 'Παρουσιάστηκε απροσδόκητο σφάλμα.',
      variant: 'destructive',
    });
    
    return {
      success: false,
      message: 'Αποτυχία εκτέλεσης κλεισίματος έτους',
      error: error.message
    };
  }
}

/**
 * Get the current year-end closure status
 * This includes information about the current year and next scheduled closure
 */
export async function getYearEndClosureStatus(): Promise<YearEndClosureStatus> {
  try {
    const result = await apiRequest('/api/admin/year-end-closure/status', {
      method: 'GET',
    }) as YearEndClosureStatus;
    
    return result;
  } catch (error: any) {
    console.error('Error getting year-end closure status:', error);
    
    return {
      success: false,
      current_year: new Date().getFullYear(),
      current_date: new Date().toISOString(),
      next_scheduled_closure: 'unknown',
      days_until_closure: -1,
      error: error.message
    };
  }
}