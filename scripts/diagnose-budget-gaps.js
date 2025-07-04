/**
 * Diagnose Budget Gaps Script
 * 
 * This script identifies which projects have missing budget data to understand
 * why budget lookups are failing despite having proper project_id relationships.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function diagnoseBudgetGaps() {
  try {
    console.log('[Diagnosis] Starting budget data gap analysis...');

    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('id, mis, na853')
      .order('id')
      .limit(1000);

    if (projectsError) {
      throw new Error(`Error fetching projects: ${projectsError.message}`);
    }

    // Get all budget records
    const { data: budgetRecords, error: budgetError } = await supabase
      .from('project_budget')
      .select('id, project_id, mis, na853')
      .order('id')
      .limit(1000);

    if (budgetError) {
      throw new Error(`Error fetching budget records: ${budgetError.message}`);
    }

    console.log(`[Diagnosis] Found ${projects.length} projects and ${budgetRecords.length} budget records`);

    // Create lookup maps
    const budgetByProjectId = new Map();
    const budgetByMis = new Map();
    const budgetByNa853 = new Map();

    budgetRecords.forEach(budget => {
      if (budget.project_id) {
        budgetByProjectId.set(budget.project_id, budget);
      }
      if (budget.mis) {
        budgetByMis.set(String(budget.mis), budget);
      }
      if (budget.na853) {
        budgetByNa853.set(budget.na853, budget);
      }
    });

    // Analyze gaps
    const missingBudgetProjects = [];
    const hasOptimizedLookup = [];
    const hasLegacyLookup = [];

    projects.forEach(project => {
      let hasBudget = false;
      let lookupMethod = '';

      // Check if budget exists via optimized project_id lookup
      if (budgetByProjectId.has(project.id)) {
        hasBudget = true;
        lookupMethod = 'project_id (OPTIMIZED)';
        hasOptimizedLookup.push(project);
      }
      // Check if budget exists via MIS lookup
      else if (project.mis && budgetByMis.has(String(project.mis))) {
        hasBudget = true;
        lookupMethod = 'MIS (legacy)';
        hasLegacyLookup.push(project);
      }
      // Check if budget exists via NA853 lookup
      else if (project.na853 && budgetByNa853.has(project.na853)) {
        hasBudget = true;
        lookupMethod = 'NA853 (legacy)';
        hasLegacyLookup.push(project);
      }

      if (!hasBudget) {
        missingBudgetProjects.push(project);
      } else {
        console.log(`[Diagnosis] Project ${project.id} (MIS: ${project.mis}) → Budget found via ${lookupMethod}`);
      }
    });

    // Report findings
    console.log('\n[Diagnosis] === BUDGET DATA ANALYSIS ===');
    console.log(`✓ Projects with optimized lookup (project_id): ${hasOptimizedLookup.length}`);
    console.log(`→ Projects with legacy lookup (MIS/NA853): ${hasLegacyLookup.length}`);
    console.log(`⚠ Projects missing budget data: ${missingBudgetProjects.length}`);

    if (missingBudgetProjects.length > 0) {
      console.log('\n[Diagnosis] === MISSING BUDGET DATA ===');
      missingBudgetProjects.slice(0, 10).forEach(project => {
        console.log(`⚠ Project ID ${project.id}, MIS: ${project.mis}, NA853: ${project.na853}`);
      });
      
      if (missingBudgetProjects.length > 10) {
        console.log(`... and ${missingBudgetProjects.length - 10} more projects missing budget data`);
      }
    }

    // Check project_id optimization coverage
    const budgetsWithProjectId = budgetRecords.filter(b => b.project_id).length;
    const optimizationCoverage = (budgetsWithProjectId / budgetRecords.length * 100).toFixed(1);

    console.log(`\n[Diagnosis] === OPTIMIZATION STATUS ===`);
    console.log(`✓ Budget records with project_id: ${budgetsWithProjectId}/${budgetRecords.length} (${optimizationCoverage}%)`);
    console.log(`✓ Integer index optimization: ${optimizationCoverage === '100.0' ? 'FULLY ENABLED' : 'PARTIAL'}`);

    // Sample some working budget lookups to verify the optimization
    if (hasOptimizedLookup.length > 0) {
      console.log(`\n[Diagnosis] === TESTING OPTIMIZED LOOKUPS ===`);
      
      for (let i = 0; i < Math.min(3, hasOptimizedLookup.length); i++) {
        const project = hasOptimizedLookup[i];
        const startTime = Date.now();
        
        const { data: testBudget, error: testError } = await supabase
          .from('project_budget')
          .select('id, proip, ethsia_pistosi')
          .eq('project_id', project.id)
          .single();
        
        const lookupTime = Date.now() - startTime;
        
        if (!testError && testBudget) {
          console.log(`✓ Project ${project.id} → Budget found in ${lookupTime}ms (optimized integer lookup)`);
        } else {
          console.log(`⚠ Project ${project.id} → Lookup failed: ${testError?.message}`);
        }
      }
    }

    return {
      totalProjects: projects.length,
      totalBudgets: budgetRecords.length,
      missingBudgets: missingBudgetProjects.length,
      optimizedLookups: hasOptimizedLookup.length,
      optimizationCoverage: parseFloat(optimizationCoverage)
    };

  } catch (error) {
    console.error('[Diagnosis] Critical error:', error);
    throw error;
  }
}

// Run the diagnosis
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseBudgetGaps()
    .then((results) => {
      console.log('\n[Diagnosis] === SUMMARY ===');
      console.log(`Total projects: ${results.totalProjects}`);
      console.log(`Budget coverage: ${((results.totalBudgets / results.totalProjects) * 100).toFixed(1)}%`);
      console.log(`Missing budgets: ${results.missingBudgets}`);
      console.log(`Optimization coverage: ${results.optimizationCoverage}%`);
      
      if (results.optimizationCoverage === 100 && results.missingBudgets === 0) {
        console.log('🎉 Perfect! All projects have budget data with optimized lookups!');
      } else if (results.optimizationCoverage === 100) {
        console.log('✓ Optimization is perfect, but some projects need budget data created.');
      } else {
        console.log('→ Optimization is working, but can be improved further.');
      }
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Diagnosis] Analysis failed:', error);
      process.exit(1);
    });
}

export { diagnoseBudgetGaps };