/**
 * Project Lookup Test
 * This script tests querying the Projects table with different NA853 codes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://rlzrtiufwxlljrtmpwsr.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_KEY is not defined in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProjectLookup() {
  console.log('===== PROJECT LOOKUP TEST =====');
  console.log('Testing Projects table queries with NA853 codes...\n');

  const testCases = [
    { name: 'Standard NA853 code', code: '2024ΝΑ85300001' },
    { name: 'Alternative format', code: '2024NA85300001' }, // Without Greek character
    { name: 'Numeric only', code: '5174692' },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest case: ${testCase.name}`);
    console.log(`NA853 code: ${testCase.code}`);
    
    try {
      // First get the column names for the Projects table
      console.log('Checking Projects table structure...');
      const { data: projectColumns, error: columnsError } = await supabase
        .from('Projects')
        .select()
        .limit(1);
        
      if (columnsError) {
        console.error('Error fetching Projects table structure:', columnsError);
      } else {
        console.log('Projects table columns:', Object.keys(projectColumns[0] || {}));
      }
        
      // Try to find the project by NA853 code
      console.log(`Querying Projects table with NA853 = ${testCase.code}`);
      const { data: projectData, error: projectError } = await supabase
        .from('Projects')
        .select('*')
        .eq('na853', testCase.code)
        .single();
      
      if (projectError) {
        if (projectError.code === 'PGRST116') {
          console.log(`No project found with NA853 = ${testCase.code}`);
        } else {
          console.error(`Database error:`, projectError);
        }
      } else if (projectData) {
        console.log(`Found project:`, projectData);
        
        // Try to find budget data for this project
        console.log(`Querying budget_na853_split table with MIS = ${projectData.mis}`);
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('mis', projectData.mis)
          .single();
        
        if (budgetError) {
          if (budgetError.code === 'PGRST116') {
            console.log(`No budget data found for MIS = ${projectData.mis}`);
          } else {
            console.error(`Database error querying budget:`, budgetError);
          }
        } else if (budgetData) {
          console.log(`Found budget data:`, {
            mis: budgetData.mis,
            na853: budgetData.na853,
            user_view: budgetData.user_view,
            katanomes_etous: budgetData.katanomes_etous,
            ethsia_pistosi: budgetData.ethsia_pistosi
          });
        }
      }
      
      // Now try direct lookup in budget_na853_split
      console.log(`\nDirect lookup in budget_na853_split with NA853 = ${testCase.code}`);
      const { data: directBudgetData, error: directBudgetError } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('na853', testCase.code)
        .single();
      
      if (directBudgetError) {
        if (directBudgetError.code === 'PGRST116') {
          console.log(`No direct budget data found with NA853 = ${testCase.code}`);
        } else {
          console.error(`Database error in direct budget lookup:`, directBudgetError);
        }
      } else if (directBudgetData) {
        console.log(`Found direct budget data:`, {
          mis: directBudgetData.mis,
          na853: directBudgetData.na853,
          user_view: directBudgetData.user_view,
          katanomes_etous: directBudgetData.katanomes_etous,
          ethsia_pistosi: directBudgetData.ethsia_pistosi
        });
      }
      
      // If numeric, try direct MIS lookup
      if (/^\d+$/.test(testCase.code)) {
        console.log(`\nAttempting numeric MIS lookup with MIS = ${testCase.code}`);
        const numericMis = parseInt(testCase.code);
        
        const { data: misBudgetData, error: misBudgetError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('mis', numericMis)
          .single();
        
        if (misBudgetError) {
          if (misBudgetError.code === 'PGRST116') {
            console.log(`No budget data found with MIS = ${numericMis}`);
          } else {
            console.error(`Database error in numeric MIS lookup:`, misBudgetError);
          }
        } else if (misBudgetData) {
          console.log(`Found budget data via numeric MIS:`, {
            mis: misBudgetData.mis,
            na853: misBudgetData.na853,
            user_view: misBudgetData.user_view,
            katanomes_etous: misBudgetData.katanomes_etous,
            ethsia_pistosi: misBudgetData.ethsia_pistosi
          });
        }
      }
      
    } catch (error) {
      console.error(`Error processing test case ${testCase.name}:`, error);
    }
  }
}

testProjectLookup().catch(console.error);