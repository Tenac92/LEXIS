/**
 * Test script for the BudgetService analyzeChangesBetweenUpdates method
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeChangesBetweenUpdates(mis) {
  try {
    console.log(`Analyzing changes between budget updates for MIS: ${mis}`);
    
    // Retrieve the budget record
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();
    
    if (budgetError) {
      console.error('Error fetching budget data:', budgetError);
      return {
        status: 'error',
        mis,
        message: `Failed to fetch budget data: ${budgetError.message}`
      };
    }
    
    if (!budgetData) {
      console.error(`No budget data found for MIS: ${mis}`);
      return {
        status: 'error',
        mis,
        message: `No budget data found for MIS: ${mis}`
      };
    }
    
    console.log('Found budget data:', { 
      mis: budgetData.mis,
      na853: budgetData.na853,
      user_view: budgetData.user_view,
      katanomes_etous: budgetData.katanomes_etous,
      ethsia_pistosi: budgetData.ethsia_pistosi,
      sum: budgetData.sum
    });
    
    // Check if the budget record has a "sum" field with previous budget indicators
    if (!budgetData.sum || typeof budgetData.sum !== 'object') {
      console.warn(`No previous budget indicator data (sum field) found for MIS: ${mis}`);
      return {
        status: 'error',
        mis,
        isReallocation: false,
        changeType: 'no_change',
        beforeUpdate: null,
        afterUpdate: {
          available_budget: Math.max(0, budgetData.katanomes_etous - budgetData.user_view),
          quarter_available: 0, // Would need to calculate based on current quarter
          yearly_available: Math.max(0, budgetData.ethsia_pistosi - budgetData.user_view),
          katanomes_etous: budgetData.katanomes_etous,
          ethsia_pistosi: budgetData.ethsia_pistosi,
          user_view: budgetData.user_view,
          current_quarter: 0 // Would need to determine the current quarter
        },
        changes: {
          available_budget_diff: 0,
          quarter_available_diff: 0,
          yearly_available_diff: 0,
          katanomes_etous_diff: 0,
          ethsia_pistosi_diff: 0,
        },
        message: 'No previous budget indicator data available for comparison'
      };
    }
    
    // Get current values
    const currentAvailableBudget = Math.max(0, budgetData.katanomes_etous - budgetData.user_view);
    
    // Get current quarter (same as stored in sum)
    const currentQuarter = budgetData.sum.current_quarter || 0;
    let currentQuarterValue = 0;
    
    // Get current quarter value based on quarter number
    switch(currentQuarter) {
      case 1: currentQuarterValue = budgetData.q1 || 0; break;
      case 2: currentQuarterValue = budgetData.q2 || 0; break;
      case 3: currentQuarterValue = budgetData.q3 || 0; break;
      case 4: currentQuarterValue = budgetData.q4 || 0; break;
      default: currentQuarterValue = 0;
    }
    
    const currentQuarterAvailable = Math.max(0, currentQuarterValue - budgetData.user_view);
    const currentYearlyAvailable = Math.max(0, budgetData.ethsia_pistosi - budgetData.user_view);
    
    // Calculate differences
    const availableBudgetDiff = currentAvailableBudget - budgetData.sum.available_budget;
    const quarterAvailableDiff = currentQuarterAvailable - budgetData.sum.quarter_available;
    const yearlyAvailableDiff = currentYearlyAvailable - budgetData.sum.yearly_available;
    const katanomesEtousDiff = budgetData.katanomes_etous - budgetData.sum.katanomes_etous;
    const ethsiaPistosiDiff = budgetData.ethsia_pistosi - budgetData.sum.ethsia_pistosi;
    
    // Determine change type
    let changeType = 'no_change';
    if (Math.abs(katanomesEtousDiff) > 0.01) {
      changeType = katanomesEtousDiff > 0 ? 'funding_increase' : 'funding_decrease';
    }
    
    // Check if this is a reallocation
    const isReallocation = 
      Math.abs(katanomesEtousDiff) > 0.01 && 
      Math.abs(ethsiaPistosiDiff) < 0.01;
    
    if (isReallocation) {
      changeType = 'reallocation';
    }
    
    // Construct the analysis result
    const analysis = {
      status: 'success',
      mis: budgetData.mis,
      isReallocation,
      changeType,
      beforeUpdate: {
        available_budget: budgetData.sum.available_budget,
        quarter_available: budgetData.sum.quarter_available,
        yearly_available: budgetData.sum.yearly_available,
        katanomes_etous: budgetData.sum.katanomes_etous,
        ethsia_pistosi: budgetData.sum.ethsia_pistosi,
        user_view: budgetData.sum.user_view,
        current_quarter: budgetData.sum.current_quarter
      },
      afterUpdate: {
        available_budget: currentAvailableBudget,
        quarter_available: currentQuarterAvailable,
        yearly_available: currentYearlyAvailable,
        katanomes_etous: budgetData.katanomes_etous,
        ethsia_pistosi: budgetData.ethsia_pistosi,
        user_view: budgetData.user_view,
        current_quarter: currentQuarter
      },
      changes: {
        available_budget_diff: availableBudgetDiff,
        quarter_available_diff: quarterAvailableDiff,
        yearly_available_diff: yearlyAvailableDiff,
        katanomes_etous_diff: katanomesEtousDiff,
        ethsia_pistosi_diff: ethsiaPistosiDiff
      }
    };
    
    console.log('Analysis result:', JSON.stringify(analysis, null, 2));
    return analysis;
  } catch (error) {
    console.error('Error analyzing budget changes:', error);
    return {
      status: 'error',
      mis,
      message: `Error analyzing budget changes: ${error.message}`
    };
  }
}

// Find a real MIS in the database
async function findValidMis() {
  try {
    console.log('Searching for valid MIS in the database...');
    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('mis')
      .limit(5);
    
    if (error) {
      console.error('Error fetching MIS records:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('No budget records found in the database');
      return null;
    }
    
    console.log('Found MIS records:', data.map(record => record.mis));
    return data[0].mis;
  } catch (error) {
    console.error('Error finding valid MIS:', error);
    return null;
  }
}

async function runTest() {
  try {
    // Use our specifically prepared MIS
    const testMis = '5203929';
    console.log(`Using test MIS: ${testMis} for testing`);
    const result = await analyzeChangesBetweenUpdates(testMis);
    console.log('Test completed with result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

runTest();