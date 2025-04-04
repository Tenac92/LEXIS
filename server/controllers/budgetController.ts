/**
 * Budget Controller
 * Handles budget-related routes and logic
 */
import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';

// Create a router for budget routes
export const router = Router();

/**
 * Format budget data consistently across all response paths
 */
export function formatBudgetData(budgetData: any) {
  return {
    user_view: budgetData.user_view?.toString() || '0',
    total_budget: budgetData.katanomes_etous?.toString() || '0',
    annual_budget: budgetData.ethsia_pistosi?.toString() || '0',
    katanomes_etous: budgetData.katanomes_etous?.toString() || '0',
    ethsia_pistosi: budgetData.ethsia_pistosi?.toString() || '0',
    current_budget: budgetData.user_view?.toString() || '0',
    q1: budgetData.q1?.toString() || '0',
    q2: budgetData.q2?.toString() || '0',
    q3: budgetData.q3?.toString() || '0',
    q4: budgetData.q4?.toString() || '0',
    total_spent: '0',
    available_budget: ((budgetData.katanomes_etous || 0) - (budgetData.user_view || 0)).toString(),
    quarter_available: '0',
    yearly_available: ((budgetData.ethsia_pistosi || 0) - (budgetData.user_view || 0)).toString()
  };
}

/**
 * Get budget data by MIS or NA853 code
 * Supports both numeric MIS values and alphanumeric NA853 project codes
 */
export async function getBudgetByMis(req: Request, res: Response) {
  // Make sure we always send a JSON response, never HTML
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { mis } = req.params;
    
    if (!mis) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS parameter is required',
        data: {
          user_view: '0',
          total_budget: '0',
          annual_budget: '0',
          katanomes_etous: '0',
          ethsia_pistosi: '0',
          current_budget: '0',
          q1: '0', q2: '0', q3: '0', q4: '0',
          total_spent: '0',
          available_budget: '0',
          quarter_available: '0',
          yearly_available: '0'
        }
      });
    }
    
    // Record the incoming request to help with debugging
    console.log('[Budget] Public access to budget data for MIS:', mis);
    console.log('[Budget] Request headers:', JSON.stringify({
      contentType: req.headers['content-type'],
      accept: req.headers.accept,
      userAgent: req.headers['user-agent']
    }));
    
    // Handle potential URI-encoded values from client by decoding
    const decodedMis = decodeURIComponent(mis);
    console.log('[Budget] Decoded MIS if needed:', decodedMis);
    
    let budgetFound = false;
    
    // ===== APPROACH 1: For alphanumeric codes, check Projects table to get numeric MIS =====
    if (!/^\d+$/.test(decodedMis)) {
      console.log(`[Budget] Handling alphanumeric code: ${decodedMis}`);
      
      try {
        // Look for project with this NA853 code
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('mis, na853')
          .eq('na853', decodedMis)
          .single();
        
        if (projectError) {
          if (projectError.code !== 'PGRST116') { // Not a "no rows" error
            console.error(`[Budget] Database error looking up project:`, projectError);
          } else {
            console.log(`[Budget] No project found with NA853 code: ${decodedMis}`);
          }
        } else if (projectData?.mis) {
          console.log(`[Budget] Found project with NA853=${decodedMis}, MIS=${projectData.mis}`);
          
          // Get budget with the numeric MIS
          const { data: budgetData, error: budgetError } = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', projectData.mis)
            .single();
          
          if (budgetError) {
            if (budgetError.code !== 'PGRST116') { // Not a "no rows" error
              console.error(`[Budget] Database error getting budget:`, budgetError);
            } else {
              console.log(`[Budget] No budget found for MIS: ${projectData.mis}`);
            }
          } else if (budgetData) {
            console.log(`[Budget] Found budget for MIS=${projectData.mis}`);
            budgetFound = true;
            return res.status(200).json({
              status: 'success',
              data: formatBudgetData(budgetData)
            });
          }
        }
      } catch (err) {
        console.error(`[Budget] Error in project lookup:`, err);
        // Don't return here, let it fall through to try the numeric approach
      }
    }
    
    // ===== APPROACH 2: For numeric MIS, try direct lookup =====
    if (!budgetFound && /^\d+$/.test(decodedMis)) {
      console.log(`[Budget] Handling numeric MIS: ${decodedMis}`);
      
      try {
        const numericMis = parseInt(decodedMis);
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('mis', numericMis)
          .single();
        
        if (budgetError) {
          if (budgetError.code !== 'PGRST116') { // Not a "no rows" error
            console.error(`[Budget] Database error in direct budget lookup:`, budgetError);
          } else {
            console.log(`[Budget] No budget found with numeric MIS: ${numericMis}`);
          }
        } else if (budgetData) {
          console.log(`[Budget] Found budget for numeric MIS=${numericMis}`);
          budgetFound = true;
          return res.status(200).json({
            status: 'success',
            data: formatBudgetData(budgetData)
          });
        }
      } catch (err) {
        console.error(`[Budget] Error in numeric lookup:`, err);
        // Continue to the fallback response
      }
    }
    
    // ===== APPROACH 3: Final fallback - try looking up by code in budget table directly =====
    if (!budgetFound) {
      console.log(`[Budget] Trying direct lookup in budget table by code: ${decodedMis}`);
      
      try {
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('na853_code', decodedMis)
          .single();
        
        if (budgetError) {
          if (budgetError.code !== 'PGRST116') { // Not a "no rows" error
            console.error(`[Budget] Database error in code lookup:`, budgetError);
          } else {
            console.log(`[Budget] No budget found with code: ${decodedMis}`);
          }
        } else if (budgetData) {
          console.log(`[Budget] Found budget for code=${decodedMis}`);
          budgetFound = true;
          return res.status(200).json({
            status: 'success',
            data: formatBudgetData(budgetData)
          });
        }
      } catch (err) {
        console.error(`[Budget] Error in code lookup:`, err);
      }
    }
    
    // If we get here, we couldn't find the budget data
    console.log(`[Budget] No budget data found for ${decodedMis} after all attempts`);
    return res.status(404).json({
      status: 'error',
      message: 'Budget data not found',
      data: {
        user_view: '0',
        total_budget: '0',
        annual_budget: '0',
        katanomes_etous: '0',
        ethsia_pistosi: '0',
        current_budget: '0',
        q1: '0', q2: '0', q3: '0', q4: '0',
        total_spent: '0',
        available_budget: '0',
        quarter_available: '0',
        yearly_available: '0'
      }
    });
    
  } catch (error) {
    console.error('[Budget] Error processing budget request:', error);
    // Make sure we always send a JSON response, never HTML
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process budget request',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        user_view: '0',
        total_budget: '0',
        annual_budget: '0',
        katanomes_etous: '0',
        ethsia_pistosi: '0',
        current_budget: '0',
        q1: '0', q2: '0', q3: '0', q4: '0',
        total_spent: '0',
        available_budget: '0',
        quarter_available: '0',
        yearly_available: '0'
      }
    });
  }
}