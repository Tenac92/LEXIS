/**
 * Comprehensive Database Analysis Script
 * 
 * Performs a complete analysis of the current database structure,
 * project_index population, and form data initialization issues.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function analyzeDatabaseStructure() {
  console.log('=== COMPREHENSIVE DATABASE ANALYSIS ===\n');

  try {
    // 1. Check project_index population
    console.log('1. ANALYZING PROJECT_INDEX TABLE');
    const { data: indexData, error: indexError } = await supabase
      .from('project_index')
      .select('*')
      .limit(10);

    if (indexError) {
      console.error('❌ Error fetching project_index:', indexError.message);
    } else {
      console.log(`✓ Project_index has ${indexData.length} sample entries`);
      if (indexData.length > 0) {
        console.log('Sample entry:', JSON.stringify(indexData[0], null, 2));
      }
    }

    // 2. Check specific project (5168550) index entries
    console.log('\n2. ANALYZING SPECIFIC PROJECT (MIS: 5168550)');
    const { data: projectData, error: projectError } = await supabase
      .from('Projects')
      .select('*')
      .eq('mis', 5168550)
      .single();

    if (projectError) {
      console.error('❌ Error fetching project:', projectError.message);
    } else {
      console.log('✓ Project found, ID:', projectData.id);
      
      // Check project_index entries for this project
      const { data: projectIndexEntries, error: indexEntriesError } = await supabase
        .from('project_index')
        .select(`
          *,
          event_types:event_types_id(id, name),
          expediture_types:expediture_type_id(id, expediture_types),
          Monada:monada_id(id, unit, unit_name),
          kallikratis:kallikratis_id(*)
        `)
        .eq('project_id', projectData.id);

      if (indexEntriesError) {
        console.error('❌ Error fetching project index entries:', indexEntriesError.message);
      } else {
        console.log(`✓ Found ${projectIndexEntries.length} index entries for project`);
        if (projectIndexEntries.length > 0) {
          console.log('Sample index entry:', JSON.stringify(projectIndexEntries[0], null, 2));
        }
      }
    }

    // 3. Check reference tables
    console.log('\n3. ANALYZING REFERENCE TABLES');
    
    const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
      supabase.from('event_types').select('*').limit(5),
      supabase.from('expediture_types').select('*').limit(5),
      supabase.from('Monada').select('*').limit(5),
      supabase.from('kallikratis').select('*').limit(5)
    ]);

    console.log(`✓ Event types: ${eventTypesRes.data?.length || 0} sample entries`);
    console.log(`✓ Expenditure types: ${expenditureTypesRes.data?.length || 0} sample entries`);
    console.log(`✓ Monada (units): ${monadaRes.data?.length || 0} sample entries`);
    console.log(`✓ Kallikratis: ${kallikratisRes.data?.length || 0} sample entries`);

    // 4. Test project index API endpoint
    console.log('\n4. TESTING PROJECT INDEX API ENDPOINT');
    try {
      const response = await fetch('http://localhost:3000/api/projects/5168550/index', {
        method: 'GET',
        headers: {
          'Cookie': 'sid=test' // This won't work but shows the structure
        }
      });
      console.log('API endpoint response status:', response.status);
    } catch (error) {
      console.log('❌ Cannot test API endpoint from script context');
    }

    // 5. Check form structure requirements
    console.log('\n5. ANALYZING FORM STRUCTURE REQUIREMENTS');
    console.log('Based on provided documentation, form should have:');
    console.log('- Section 1: Decisions (protocol, FEK, ADA, implementing agency, budget)');
    console.log('- Section 2: Event details (event type, year, region hierarchy)');
    console.log('- Section 3: Project details (MIS, SA, title, description, status)');
    console.log('- Section 4: Formulation details (SA, budget, EPA version)');
    console.log('- Section 5: Changes tracking');
    console.log('- Section 6: Project Lines (advanced management)');

    // 6. Check data consistency
    console.log('\n6. CHECKING DATA CONSISTENCY');
    
    if (projectData) {
      console.log('Project data structure:');
      console.log('- MIS:', projectData.mis);
      console.log('- Title:', projectData.project_title ? '✓' : '❌');
      console.log('- Description:', projectData.event_description ? '✓' : '❌');
      console.log('- KYA:', projectData.kya ? '✓' : '❌');
      console.log('- FEK:', projectData.fek ? '✓' : '❌');
      console.log('- ADA:', projectData.ada ? '✓' : '❌');
      console.log('- Budget NA853:', projectData.budget_na853 ? '✓' : '❌');
      console.log('- Event Year:', projectData.event_year ? '✓' : '❌');
    }

    console.log('\n=== ANALYSIS COMPLETE ===');

  } catch (error) {
    console.error('Error in comprehensive analysis:', error);
  }
}

analyzeDatabaseStructure().catch(console.error);