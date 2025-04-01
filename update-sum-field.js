/**
 * This script updates the sum field in a budget_na853_split record
 * to simulate admin uploads for testing budget change analysis
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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

async function updateSumField(mis) {
  try {
    console.log(`Updating sum field for MIS: ${mis}`);
    
    // First, get current budget data
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();
    
    if (budgetError) {
      console.error('Error fetching budget data:', budgetError);
      return false;
    }
    
    if (!budgetData) {
      console.error(`No budget data found for MIS: ${mis}`);
      return false;
    }
    
    console.log('Current budget data:', {
      mis: budgetData.mis,
      na853: budgetData.na853,
      user_view: budgetData.user_view,
      katanomes_etous: budgetData.katanomes_etous,
      ethsia_pistosi: budgetData.ethsia_pistosi
    });
    
    // Get current quarter
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentQuarterNumber = Math.ceil(currentMonth / 3);
    
    // Get current quarter value
    let currentQuarterValue = 0;
    switch(currentQuarterNumber) {
      case 1: currentQuarterValue = budgetData.q1 || 0; break;
      case 2: currentQuarterValue = budgetData.q2 || 0; break;
      case 3: currentQuarterValue = budgetData.q3 || 0; break;
      case 4: currentQuarterValue = budgetData.q4 || 0; break;
      default: currentQuarterValue = 0;
    }
    
    // Calculate budget indicators
    const userView = budgetData.user_view || 0;
    const katanomesEtous = budgetData.katanomes_etous || 0;
    const ethsiaPistosi = budgetData.ethsia_pistosi || 0;
    
    const availableBudget = Math.max(0, katanomesEtous - userView);
    const quarterAvailable = Math.max(0, currentQuarterValue - userView);
    const yearlyAvailable = Math.max(0, ethsiaPistosi - userView);
    
    // Create sum field with current values (to simulate pre-update state)
    const sumData = {
      available_budget: availableBudget * 0.9, // Simulate a 10% difference for testing
      quarter_available: quarterAvailable * 0.9,
      yearly_available: yearlyAvailable * 0.9,
      katanomes_etous: katanomesEtous * 0.9, // Simulate a different katanomes_etous value
      ethsia_pistosi: ethsiaPistosi,
      user_view: userView,
      current_quarter: currentQuarterNumber,
      updated_at: new Date().toISOString()
    };
    
    // Update the record with the new sum field
    const { error: updateError } = await supabase
      .from('budget_na853_split')
      .update({
        sum: sumData
      })
      .eq('mis', mis);
    
    if (updateError) {
      console.error('Error updating sum field:', updateError);
      return false;
    }
    
    console.log(`Successfully updated sum field for MIS: ${mis}`);
    console.log('Sum field data:', sumData);
    return true;
  } catch (error) {
    console.error('Error updating sum field:', error);
    return false;
  }
}

// Test with a real MIS
const testMis = '5203929';

async function runUpdate() {
  try {
    const success = await updateSumField(testMis);
    console.log(`Update ${success ? 'successful' : 'failed'}`);
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    process.exit(0);
  }
}

runUpdate();