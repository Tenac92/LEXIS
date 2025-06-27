/**
 * Targeted Agency Update
 * 
 * This script performs targeted updates for implementing agencies based on
 * the CSV data, focusing on the most critical ΕΚΤΟΣ ΕΔΡΑΣ* cases.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function targetedAgencyUpdate() {
  console.log('=== TARGETED IMPLEMENTING AGENCY UPDATE ===\n');
  
  try {
    // Step 1: Read CSV and extract ΕΚΤΟΣ ΕΔΡΑΣ* cases
    console.log('📊 Reading CSV and extracting ΕΚΤΟΣ ΕΔΡΑΣ* cases...');
    const ektosEdrasCases = await extractEktosEdrasCases();
    console.log(`   Found ${ektosEdrasCases.length} ΕΚΤΟΣ ΕΔΡΑΣ* cases`);
    
    // Step 2: Get unit mappings
    console.log('\n🔍 Getting unit mappings...');
    const unitMappings = await getUnitMappings();
    console.log(`   Loaded ${unitMappings.size} unit mappings`);
    
    // Step 3: Update project_index records
    console.log('\n📝 Updating project_index records...');
    const indexResults = await updateProjectIndexWithAgencies(ektosEdrasCases, unitMappings);
    
    // Step 4: Update project_history records  
    console.log('\n📚 Updating project_history records...');
    const historyResults = await updateProjectHistoryWithAgencies(ektosEdrasCases);
    
    // Step 5: Generate summary
    generateUpdateSummary(indexResults, historyResults, ektosEdrasCases);
    
  } catch (error) {
    console.error('❌ Error in targeted agency update:', error.message);
    throw error;
  }
}

/**
 * Extract ΕΚΤΟΣ ΕΔΡΑΣ* cases from CSV
 */
async function extractEktosEdrasCases() {
  const csvContent = readFileSync('attached_assets/Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751013788156.csv', 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  const ektosEdrasCases = [];
  
  records.forEach(record => {
    const expenditureTypes = record['Είδος δαπάνης που προκαλείται'] || '';
    
    if (expenditureTypes.includes('ΕΚΤΟΣ ΕΔΡΑΣ*')) {
      const agencies = (record['Φορέας υλοποίησης'] || '').split('\n').map(a => a.trim()).filter(a => a);
      
      // Find the agency marked with *
      const markedAgency = agencies.find(agency => agency.includes('*'));
      const resolvedAgency = markedAgency ? markedAgency.replace('*', '').trim() : agencies[0];
      
      ektosEdrasCases.push({
        mis: record.MIS,
        na853: record.NA853,
        originalAgencies: agencies,
        resolvedAgency: resolvedAgency,
        projectTitle: record['Τίτλος έργου'],
        eventType: record['Συμβάν']
      });
    }
  });
  
  return ektosEdrasCases;
}

/**
 * Get unit mappings from database
 */
async function getUnitMappings() {
  const { data: units, error } = await supabase
    .from('Monada')
    .select('*');
  
  if (error) {
    throw new Error(`Failed to fetch units: ${error.message}`);
  }
  
  const mappings = new Map();
  
  // Manual mapping based on known patterns
  const knownMappings = {
    'ΔΑΕΦΚ-ΚΕ': 1,
    'ΔΑΕΦΚ-ΒΕ': 2, 
    'ΔΑΕΦΚ-ΔΕ': 3,
    'ΔΑΕΦΚ-ΑΚ': 4,
    'ΓΔΑΕΦΚ': 5,
    'ΤΑΣ ΚΟΖΑΝΗΣ': 6,
    'ΤΑΣ ΑΧΑΪΑΣ': 7,
    'ΤΑΣ ΜΕΣΣΗΝΙΑΣ': 8,
    'ΤΑΣ ΚΕΦΑΛΟΝΙΑΣ': 9,
    'ΤΑΠ ΗΛΕΙΑΣ': 10,
    'ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ': 11
  };
  
  // Create mappings with exact and partial matches
  Object.entries(knownMappings).forEach(([agencyName, unitId]) => {
    mappings.set(agencyName, unitId);
    
    // Add variations
    if (agencyName.includes('ΔΑΕΦΚ')) {
      mappings.set(agencyName.replace('-', ''), unitId);
      mappings.set(agencyName.replace('ΔΑΕΦΚ', 'ΔΑΕΦΚ '), unitId);
    }
    
    if (agencyName.includes('ΤΑ')) {
      const shortName = agencyName.split(' ')[0];
      mappings.set(shortName, unitId);
    }
  });
  
  console.log('   Unit mappings created:');
  mappings.forEach((unitId, agencyName) => {
    console.log(`     ${agencyName} → Unit ID ${unitId}`);
  });
  
  return mappings;
}

/**
 * Update project_index records
 */
async function updateProjectIndexWithAgencies(ektosEdrasCases, unitMappings) {
  const results = {
    processed: 0,
    updated: 0,
    notFound: 0,
    errors: []
  };
  
  for (const case_ of ektosEdrasCases) {
    try {
      results.processed++;
      
      // Find project
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', case_.mis)
        .single();
      
      if (projectError || !project) {
        results.notFound++;
        console.log(`     ⚠️ Project not found for MIS ${case_.mis}`);
        continue;
      }
      
      // Find unit ID
      let unitId = null;
      for (const [agencyName, id] of unitMappings) {
        if (case_.resolvedAgency.includes(agencyName) || agencyName.includes(case_.resolvedAgency)) {
          unitId = id;
          break;
        }
      }
      
      if (!unitId) {
        // Try exact match
        unitId = unitMappings.get(case_.resolvedAgency);
      }
      
      if (!unitId) {
        console.log(`     ⚠️ Unit ID not found for agency: ${case_.resolvedAgency}`);
        continue;
      }
      
      // Update project_index records for this project
      const { data: updateResult, error: updateError } = await supabase
        .from('project_index')
        .update({
          unit_id: unitId,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', project.id)
        .select();
      
      if (updateError) {
        results.errors.push(`MIS ${case_.mis}: ${updateError.message}`);
      } else if (updateResult && updateResult.length > 0) {
        results.updated++;
        console.log(`     ✅ Updated MIS ${case_.mis} → ${case_.resolvedAgency} (Unit ID ${unitId})`);
      }
      
    } catch (error) {
      results.errors.push(`MIS ${case_.mis}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Update project_history records
 */
async function updateProjectHistoryWithAgencies(ektosEdrasCases) {
  const results = {
    processed: 0,
    updated: 0,
    notFound: 0,
    errors: []
  };
  
  for (const case_ of ektosEdrasCases) {
    try {
      results.processed++;
      
      // Find project
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', case_.mis)
        .single();
      
      if (projectError || !project) {
        results.notFound++;
        continue;
      }
      
      // Update project_history implementing_agency_location
      const { data: updateResult, error: updateError } = await supabase
        .from('project_history')
        .update({
          implementing_agency_location: case_.resolvedAgency,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', project.id)
        .select();
      
      if (updateError) {
        results.errors.push(`History MIS ${case_.mis}: ${updateError.message}`);
      } else if (updateResult && updateResult.length > 0) {
        results.updated++;
        console.log(`     ✅ Updated history MIS ${case_.mis} → ${case_.resolvedAgency}`);
      }
      
    } catch (error) {
      results.errors.push(`History MIS ${case_.mis}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Generate update summary
 */
function generateUpdateSummary(indexResults, historyResults, ektosEdrasCases) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TARGETED AGENCY UPDATE SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\n📊 PROJECT INDEX UPDATES:');
  console.log(`   Cases processed: ${indexResults.processed}`);
  console.log(`   Records updated: ${indexResults.updated}`);
  console.log(`   Projects not found: ${indexResults.notFound}`);
  console.log(`   Errors: ${indexResults.errors.length}`);
  
  console.log('\n📚 PROJECT HISTORY UPDATES:');
  console.log(`   Cases processed: ${historyResults.processed}`);
  console.log(`   Records updated: ${historyResults.updated}`);
  console.log(`   Projects not found: ${historyResults.notFound}`);
  console.log(`   Errors: ${historyResults.errors.length}`);
  
  console.log('\n🎯 ΕΚΤΟΣ ΕΔΡΑΣ* RESOLUTIONS:');
  const agencyCount = new Map();
  ektosEdrasCases.forEach(case_ => {
    const count = agencyCount.get(case_.resolvedAgency) || 0;
    agencyCount.set(case_.resolvedAgency, count + 1);
  });
  
  const sortedAgencies = [...agencyCount.entries()].sort((a, b) => b[1] - a[1]);
  sortedAgencies.forEach(([agency, count]) => {
    console.log(`   ${agency}: ${count} projects`);
  });
  
  if (indexResults.errors.length > 0) {
    console.log('\n❌ PROJECT INDEX ERRORS:');
    indexResults.errors.slice(0, 5).forEach(error => {
      console.log(`   ${error}`);
    });
    if (indexResults.errors.length > 5) {
      console.log(`   ... and ${indexResults.errors.length - 5} more errors`);
    }
  }
  
  if (historyResults.errors.length > 0) {
    console.log('\n❌ PROJECT HISTORY ERRORS:');
    historyResults.errors.slice(0, 5).forEach(error => {
      console.log(`   ${error}`);
    });
    if (historyResults.errors.length > 5) {
      console.log(`   ... and ${historyResults.errors.length - 5} more errors`);
    }
  }
  
  console.log('\n✅ TARGETED AGENCY UPDATE COMPLETED');
  console.log('='.repeat(60));
}

// Execute the targeted update
targetedAgencyUpdate().catch(console.error);