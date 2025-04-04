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

/**
 * Initiate a quarter transition check
 * This will identify budgets that need quarter updates and process them
 */
export async function checkQuarterTransition(): Promise<QuarterTransitionResult> {
  try {
    const result = await apiRequest('/api/admin/quarter-transition/check', {
      method: 'POST',
    });
    
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
  } catch (error) {
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
    });
    
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
  } catch (error) {
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
    });
    
    return result;
  } catch (error) {
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