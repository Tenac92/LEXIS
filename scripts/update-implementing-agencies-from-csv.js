/**
 * Update Implementing Agencies from CSV Data
 * 
 * This script reads the provided CSV file and updates project_index and project_history
 * tables with the correct implementing agency information, handling special cases
 * where "ΕΚΤΟΣ ΕΔΡΑΣ*" indicates the agency should be the one marked with *.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateImplementingAgenciesFromCSV() {
  console.log('=== UPDATING IMPLEMENTING AGENCIES FROM CSV DATA ===\n');
  
  try {
    // Step 1: Read and parse CSV data
    console.log('📊 Step 1: Reading CSV data...');
    const csvData = await readCSVData();
    console.log(`   Loaded ${csvData.length} project entries from CSV`);
    
    // Step 2: Analyze implementing agency patterns
    console.log('\n🔍 Step 2: Analyzing implementing agency patterns...');
    const agencyAnalysis = analyzeImplementingAgencies(csvData);
    
    // Step 3: Update project_index records
    console.log('\n📝 Step 3: Updating project_index records...');
    const indexUpdates = await updateProjectIndexRecords(csvData, agencyAnalysis);
    
    // Step 4: Update project_history records
    console.log('\n📚 Step 4: Updating project_history records...');
    const historyUpdates = await updateProjectHistoryRecords(csvData, agencyAnalysis);
    
    // Step 5: Generate summary report
    console.log('\n📋 Step 5: Generating update summary...');
    generateUpdateSummary(indexUpdates, historyUpdates, agencyAnalysis);
    
  } catch (error) {
    console.error('❌ Error updating implementing agencies:', error.message);
    throw error;
  }
}

/**
 * Read and parse CSV data
 */
async function readCSVData() {
  const csvContent = readFileSync('attached_assets/Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751013788156.csv', 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  // Clean and process the data
  return records.map(record => ({
    mis: record.MIS,
    na853: record.NA853,
    eventType: record['Συμβάν'],
    eventYear: record['Έτος εκδήλωσης συμβάντος'],
    region: record['Περιφέρεια'],
    regionalUnit: record['Περιφερειακή ενότητα'],
    municipality: record['Δήμος'],
    implementingAgency: record['Φορέας υλοποίησης'],
    expenditureTypes: record['Είδος δαπάνης που προκαλείται'],
    projectTitle: record['Τίτλος έργου'],
    eventDescription: record['Περιγραφή Συμβάντος']
  })).filter(record => record.mis && record.implementingAgency);
}

/**
 * Analyze implementing agency patterns
 */
function analyzeImplementingAgencies(csvData) {
  console.log('   🔍 Analyzing implementing agency patterns...');
  
  const agencyPatterns = {
    regularAgencies: new Set(),
    ektosEdrasEntries: [],
    agencyMapping: new Map(),
    expenditureTypePatterns: new Map()
  };
  
  csvData.forEach(record => {
    const agencies = record.implementingAgency.split('\n').map(a => a.trim()).filter(a => a);
    const expenditureTypes = record.expenditureTypes.split('\n').map(e => e.trim()).filter(e => e);
    
    // Check for ΕΚΤΟΣ ΕΔΡΑΣ* pattern
    const hasEktosEdras = expenditureTypes.some(exp => exp.includes('ΕΚΤΟΣ ΕΔΡΑΣ*'));
    
    if (hasEktosEdras) {
      // Find the agency marked with *
      const markedAgency = agencies.find(agency => agency.includes('*'));
      const cleanAgency = markedAgency ? markedAgency.replace('*', '').trim() : agencies[0];
      
      agencyPatterns.ektosEdrasEntries.push({
        mis: record.mis,
        originalAgency: record.implementingAgency,
        resolvedAgency: cleanAgency,
        agencies: agencies,
        expenditureTypes: expenditureTypes
      });
      
      console.log(`     ΕΚΤΟΣ ΕΔΡΑΣ* found in MIS ${record.mis}: ${cleanAgency}`);
      
    } else {
      // Regular agencies
      agencies.forEach(agency => {
        const cleanAgency = agency.replace('*', '').trim();
        agencyPatterns.regularAgencies.add(cleanAgency);
        agencyPatterns.agencyMapping.set(record.mis, cleanAgency);
      });
    }
    
    // Track expenditure type patterns
    expenditureTypes.forEach(exp => {
      if (!agencyPatterns.expenditureTypePatterns.has(exp)) {
        agencyPatterns.expenditureTypePatterns.set(exp, new Set());
      }
      agencies.forEach(agency => {
        agencyPatterns.expenditureTypePatterns.get(exp).add(agency.replace('*', '').trim());
      });
    });
  });
  
  console.log(`     Regular agencies found: ${agencyPatterns.regularAgencies.size}`);
  console.log(`     ΕΚΤΟΣ ΕΔΡΑΣ* entries found: ${agencyPatterns.ektosEdrasEntries.length}`);
  
  return agencyPatterns;
}

/**
 * Update project_index records
 */
async function updateProjectIndexRecords(csvData, agencyAnalysis) {
  console.log('   📊 Fetching existing project_index records...');
  
  const { data: existingIndex, error: fetchError } = await supabase
    .from('project_index')
    .select('*');
  
  if (fetchError) {
    throw new Error(`Failed to fetch project_index: ${fetchError.message}`);
  }
  
  console.log(`   Found ${existingIndex.length} existing project_index records`);
  
  let updatedCount = 0;
  let newCount = 0;
  const updateResults = [];
  
  // Group CSV data by MIS for easier lookup
  const csvByMIS = new Map();
  csvData.forEach(record => {
    if (!csvByMIS.has(record.mis)) {
      csvByMIS.set(record.mis, []);
    }
    csvByMIS.get(record.mis).push(record);
  });
  
  // Get unit mappings
  const { data: units, error: unitsError } = await supabase
    .from('Monada')
    .select('id, unit_name');
  
  if (unitsError) {
    throw new Error(`Failed to fetch units: ${unitsError.message}`);
  }
  
  const unitNameToId = new Map();
  units.forEach(unit => {
    // Handle various agency name formats
    const cleanName = unit.unit_name ? unit.unit_name.toString().trim() : '';
    if (cleanName) {
      unitNameToId.set(cleanName, unit.id);
      
      // Add alternative mappings for common variations
      if (cleanName.includes('ΔΑΕΦΚ')) {
        unitNameToId.set(cleanName.replace('ΔΑΕΦΚ', 'ΔΑΕΦΚ-'), unit.id);
      }
    }
  });
  
  console.log(`   Loaded ${units.length} unit mappings`);
  
  // Process each project
  for (const [mis, csvRecords] of csvByMIS) {
    try {
      // Find corresponding project
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', mis)
        .single();
      
      if (projectError || !project) {
        console.log(`     ⚠️ Project not found for MIS ${mis}`);
        continue;
      }
      
      // Process each CSV record for this project
      for (const csvRecord of csvRecords) {
        const agencies = csvRecord.implementingAgency.split('\n').map(a => a.trim()).filter(a => a);
        const expenditureTypes = csvRecord.expenditureTypes.split('\n').map(e => e.trim()).filter(e => e);
        
        // Determine the correct implementing agency
        let implementingAgency;
        const hasEktosEdras = expenditureTypes.some(exp => exp.includes('ΕΚΤΟΣ ΕΔΡΑΣ*'));
        
        if (hasEktosEdras) {
          // Use the agency marked with * or the first one
          const markedAgency = agencies.find(agency => agency.includes('*'));
          implementingAgency = markedAgency ? markedAgency.replace('*', '').trim() : agencies[0];
        } else {
          // Use the first agency
          implementingAgency = agencies[0];
        }
        
        // Find unit ID
        let unitId = null;
        for (const [unitName, id] of unitNameToId) {
          if (implementingAgency.includes(unitName) || unitName.includes(implementingAgency)) {
            unitId = id;
            break;
          }
        }
        
        if (!unitId) {
          console.log(`     ⚠️ Unit ID not found for agency: ${implementingAgency}`);
          // Try with exact match
          unitId = unitNameToId.get(implementingAgency);
        }
        
        // Check if we need to update existing records
        const existingRecords = existingIndex.filter(idx => idx.project_id === project.id);
        
        if (existingRecords.length > 0) {
          // Update existing records
          for (const existingRecord of existingRecords) {
            if (unitId && existingRecord.unit_id !== unitId) {
              const { error: updateError } = await supabase
                .from('project_index')
                .update({
                  unit_id: unitId,
                  implementing_agency: implementingAgency,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingRecord.id);
              
              if (updateError) {
                console.log(`     ❌ Failed to update project_index ${existingRecord.id}: ${updateError.message}`);
              } else {
                updatedCount++;
                updateResults.push({
                  action: 'updated',
                  mis: mis,
                  recordId: existingRecord.id,
                  oldAgency: existingRecord.implementing_agency || 'null',
                  newAgency: implementingAgency,
                  unitId: unitId
                });
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`     ❌ Error processing MIS ${mis}: ${error.message}`);
    }
  }
  
  console.log(`   ✅ Updated ${updatedCount} project_index records`);
  console.log(`   ✅ Created ${newCount} new project_index records`);
  
  return {
    updated: updatedCount,
    created: newCount,
    details: updateResults
  };
}

/**
 * Update project_history records
 */
async function updateProjectHistoryRecords(csvData, agencyAnalysis) {
  console.log('   📚 Fetching existing project_history records...');
  
  const { data: existingHistory, error: fetchError } = await supabase
    .from('project_history')
    .select('*');
  
  if (fetchError) {
    throw new Error(`Failed to fetch project_history: ${fetchError.message}`);
  }
  
  console.log(`   Found ${existingHistory.length} existing project_history records`);
  
  let updatedCount = 0;
  const updateResults = [];
  
  // Group CSV data by MIS
  const csvByMIS = new Map();
  csvData.forEach(record => {
    if (!csvByMIS.has(record.mis)) {
      csvByMIS.set(record.mis, []);
    }
    csvByMIS.get(record.mis).push(record);
  });
  
  // Process each project
  for (const [mis, csvRecords] of csvByMIS) {
    try {
      // Find corresponding project
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', mis)
        .single();
      
      if (projectError || !project) {
        continue;
      }
      
      // Find corresponding history record
      const historyRecord = existingHistory.find(h => h.project_id === project.id);
      
      if (!historyRecord) {
        continue;
      }
      
      // Process CSV records for this project
      for (const csvRecord of csvRecords) {
        const agencies = csvRecord.implementingAgency.split('\n').map(a => a.trim()).filter(a => a);
        const expenditureTypes = csvRecord.expenditureTypes.split('\n').map(e => e.trim()).filter(e => e);
        
        // Determine the correct implementing agency
        let implementingAgency;
        const hasEktosEdras = expenditureTypes.some(exp => exp.includes('ΕΚΤΟΣ ΕΔΡΑΣ*'));
        
        if (hasEktosEdras) {
          const markedAgency = agencies.find(agency => agency.includes('*'));
          implementingAgency = markedAgency ? markedAgency.replace('*', '').trim() : agencies[0];
        } else {
          implementingAgency = agencies[0];
        }
        
        // Update the history record's implementing_agency_location field
        if (historyRecord.implementing_agency_location !== implementingAgency) {
          const { error: updateError } = await supabase
            .from('project_history')
            .update({
              implementing_agency_location: implementingAgency,
              updated_at: new Date().toISOString()
            })
            .eq('id', historyRecord.id);
          
          if (updateError) {
            console.log(`     ❌ Failed to update project_history ${historyRecord.id}: ${updateError.message}`);
          } else {
            updatedCount++;
            updateResults.push({
              action: 'updated',
              mis: mis,
              historyId: historyRecord.id,
              oldAgency: historyRecord.implementing_agency_location || 'null',
              newAgency: implementingAgency
            });
          }
        }
      }
      
    } catch (error) {
      console.log(`     ❌ Error processing history for MIS ${mis}: ${error.message}`);
    }
  }
  
  console.log(`   ✅ Updated ${updatedCount} project_history records`);
  
  return {
    updated: updatedCount,
    details: updateResults
  };
}

/**
 * Generate update summary
 */
function generateUpdateSummary(indexUpdates, historyUpdates, agencyAnalysis) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 UPDATE SUMMARY REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📊 PROJECT INDEX UPDATES:');
  console.log(`   Records updated: ${indexUpdates.updated}`);
  console.log(`   Records created: ${indexUpdates.created}`);
  
  console.log('\n📚 PROJECT HISTORY UPDATES:');
  console.log(`   Records updated: ${historyUpdates.updated}`);
  
  console.log('\n🔍 IMPLEMENTING AGENCY ANALYSIS:');
  console.log(`   Regular agencies found: ${agencyAnalysis.regularAgencies.size}`);
  console.log(`   ΕΚΤΟΣ ΕΔΡΑΣ* entries processed: ${agencyAnalysis.ektosEdrasEntries.length}`);
  
  console.log('\n📝 ΕΚΤΟΣ ΕΔΡΑΣ* RESOLUTIONS:');
  agencyAnalysis.ektosEdrasEntries.forEach(entry => {
    console.log(`   MIS ${entry.mis}: ${entry.resolvedAgency}`);
  });
  
  console.log('\n🎯 MOST COMMON AGENCIES:');
  const agencyCount = new Map();
  agencyAnalysis.regularAgencies.forEach(agency => {
    agencyCount.set(agency, (agencyCount.get(agency) || 0) + 1);
  });
  
  const sortedAgencies = [...agencyCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedAgencies.forEach(([agency, count]) => {
    console.log(`   ${agency}: ${count} projects`);
  });
  
  console.log('\n✅ IMPLEMENTING AGENCY UPDATE COMPLETED');
  console.log('='.repeat(60));
}

// Execute the update
updateImplementingAgenciesFromCSV().catch(console.error);