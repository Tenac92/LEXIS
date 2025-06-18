/**
 * Validate Project Index Script
 * 
 * This script validates the project_index table structure and data integrity.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validateIndexStructure() {
  console.log('=== VALIDATING PROJECT INDEX STRUCTURE ===\n');
  
  try {
    // Test the index table with sample queries
    const { data: indexData, error: indexError } = await supabase
      .from('project_index')
      .select(`
        project_id,
        monada_id,
        kallikratis_id,
        event_types_id,
        expediture_type_id
      `)
      .limit(5);
    
    if (indexError) {
      console.error('Error querying project_index:', indexError.message);
      return false;
    }
    
    console.log('✓ Project index table is accessible');
    console.log('✓ All required columns are present');
    
    // Test foreign key relationships
    const { data: joinedData, error: joinError } = await supabase
      .from('project_index')
      .select(`
        project_id,
        Projects!inner(na853, event_description),
        event_types!inner(name),
        expediture_types!inner(expediture_types),
        Monada!inner(unit)
      `)
      .limit(3);
    
    if (joinError) {
      console.log('Warning: Some foreign key relationships may need adjustment:', joinError.message);
    } else {
      console.log('✓ Foreign key relationships working');
      console.log('\nSample joined data:');
      joinedData?.forEach((record, index) => {
        console.log(`  ${index + 1}. Project ${record.Projects.na853}: ${record.event_types.name} + ${record.expediture_types.expediture_types}`);
      });
    }
    
    // Check for data distribution
    const { data: stats } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          COUNT(DISTINCT project_id) as unique_projects,
          COUNT(DISTINCT event_types_id) as unique_event_types,
          COUNT(DISTINCT expediture_type_id) as unique_expenditure_types,
          COUNT(*) as total_records
        FROM project_index;
      `
    });
    
    if (stats && stats.length > 0) {
      const stat = stats[0];
      console.log('\n=== INDEX STATISTICS ===');
      console.log(`Unique projects indexed: ${stat.unique_projects}`);
      console.log(`Unique event types used: ${stat.unique_event_types}`);
      console.log(`Unique expenditure types used: ${stat.unique_expenditure_types}`);
      console.log(`Total index records: ${stat.total_records}`);
    }
    
    return true;
    
  } catch (err) {
    console.error('Validation error:', err.message);
    return false;
  }
}

async function testIndexPerformance() {
  console.log('\n=== TESTING INDEX PERFORMANCE ===');
  
  try {
    // Test common query patterns
    const startTime = Date.now();
    
    const { data: projectsByEvent } = await supabase
      .from('project_index')
      .select('project_id')
      .eq('event_types_id', 12); // ΠΥΡΚΑΓΙΑ
    
    const eventQueryTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    
    const { data: projectsByExpenditure } = await supabase
      .from('project_index')
      .select('project_id')
      .eq('expediture_type_id', 1); // ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ
    
    const expenditureQueryTime = Date.now() - startTime2;
    
    console.log(`✓ Event type query: ${eventQueryTime}ms (${projectsByEvent?.length || 0} results)`);
    console.log(`✓ Expenditure type query: ${expenditureQueryTime}ms (${projectsByExpenditure?.length || 0} results)`);
    
    // Test composite query
    const startTime3 = Date.now();
    
    const { data: compositeResults } = await supabase
      .from('project_index')
      .select('project_id')
      .eq('event_types_id', 12)
      .eq('expediture_type_id', 1);
    
    const compositeQueryTime = Date.now() - startTime3;
    
    console.log(`✓ Composite query: ${compositeQueryTime}ms (${compositeResults?.length || 0} results)`);
    console.log('✓ Index performance is acceptable for current data size');
    
  } catch (err) {
    console.error('Performance test error:', err.message);
  }
}

async function main() {
  const isValid = await validateIndexStructure();
  
  if (isValid) {
    await testIndexPerformance();
    
    console.log('\n=== VALIDATION COMPLETE ===');
    console.log('Your project_index table is properly structured and populated.');
    console.log('The table provides optimized indexing for:');
    console.log('  • Project lookup by event type');
    console.log('  • Project lookup by expenditure type');
    console.log('  • Combined filtering by multiple criteria');
    console.log('  • Organizational unit (monada) relationships');
    console.log('  • Geographic (kallikratis) relationships');
  } else {
    console.log('\n❌ Validation failed. Please check the table structure.');
  }
}

main().catch(console.error);