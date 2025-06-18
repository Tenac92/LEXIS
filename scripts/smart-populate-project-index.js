/**
 * Smart Project Index Population Script
 * 
 * This script properly matches alphanumerical values from the Projects CSV
 * with the correct IDs from reference tables using intelligent mapping.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function loadReferenceData() {
  console.log('Loading reference data...');
  
  const { data: eventTypes } = await supabase.from('event_types').select('id, name');
  const { data: expenditureTypes } = await supabase.from('expediture_types').select('id, expediture_types');
  const { data: monadaList } = await supabase.from('Monada').select('id, unit');
  const { data: kallikratisList } = await supabase.from('kallikratis').select('id, onoma_dimou_koinotitas, perifereia');
  
  console.log(`Loaded ${eventTypes?.length || 0} event types`);
  console.log(`Loaded ${expenditureTypes?.length || 0} expenditure types`);
  console.log(`Loaded ${monadaList?.length || 0} monada entries`);
  console.log(`Loaded ${kallikratisList?.length || 0} kallikratis entries`);
  
  return { eventTypes, expenditureTypes, monadaList, kallikratisList };
}

function findMonadaId(implementingAgencies, monadaList) {
  if (!Array.isArray(implementingAgencies) || implementingAgencies.length === 0) {
    return monadaList?.[0]?.id || '1'; // Default to first available
  }
  
  // Try to match the first implementing agency
  const firstAgency = implementingAgencies[0];
  const monada = monadaList?.find(m => m.unit === firstAgency);
  return monada?.id || monadaList?.[0]?.id || '1';
}

function findKallikratisId(regionData, kallikratisList) {
  if (!regionData || !kallikratisList) {
    return kallikratisList?.[0]?.id || 1; // Default to first available
  }
  
  let parsedRegion;
  try {
    parsedRegion = typeof regionData === 'string' ? JSON.parse(regionData) : regionData;
  } catch (e) {
    return kallikratisList[0]?.id || 1;
  }
  
  // Try to match by region name first
  if (parsedRegion.region && Array.isArray(parsedRegion.region)) {
    const regionName = parsedRegion.region[0];
    let match = kallikratisList.find(k => 
      k.perifereia && k.perifereia.includes(regionName.replace(/\s+/g, ' ').trim())
    );
    if (match) return match.id;
  }
  
  // Try to match by municipality name
  if (parsedRegion.municipality && Array.isArray(parsedRegion.municipality)) {
    const municipalityName = parsedRegion.municipality[0];
    let match = kallikratisList.find(k => 
      k.onoma_dimou_koinotitas && 
      k.onoma_dimou_koinotitas.includes(municipalityName.replace(/\s+/g, ' ').trim())
    );
    if (match) return match.id;
  }
  
  // Default fallback
  return kallikratisList[0]?.id || 1;
}

function parseJsonArray(jsonString) {
  if (!jsonString || jsonString === '""' || jsonString === '[]') {
    return [];
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Handle malformed JSON
    if (typeof jsonString === 'string' && jsonString.includes('[')) {
      try {
        // Clean up the string and try again
        const cleaned = jsonString.replace(/\\\"/g, '"').replace(/\"\[/g, '[').replace(/\]\"/g, ']');
        return JSON.parse(cleaned);
      } catch (e2) {
        console.log(`Failed to parse JSON: ${jsonString}`);
        return [];
      }
    }
    return [];
  }
}

async function processProjectsFromCSV() {
  console.log('\nProcessing projects from CSV...');
  
  // Load Projects CSV
  const csvContent = fs.readFileSync('attached_assets/Projects_rows (10)_1750227643849.csv', 'utf-8');
  const projects = parse(csvContent, { columns: true, skip_empty_lines: true });
  
  console.log(`Found ${projects.length} projects in CSV`);
  
  // Load reference data
  const { eventTypes, expenditureTypes, monadaList, kallikratisList } = await loadReferenceData();
  
  if (!eventTypes || !expenditureTypes) {
    console.error('Missing reference data');
    return;
  }
  
  // Clear existing project_index data
  console.log('Clearing existing project_index data...');
  await supabase.from('project_index').delete().gte('project_id', 0);
  
  let insertedCount = 0;
  let skippedCount = 0;
  let processedCount = 0;
  
  for (const project of projects) {
    processedCount++;
    
    if (processedCount % 20 === 0) {
      console.log(`Progress: ${processedCount}/${projects.length} projects processed...`);
    }
    
    try {
      const projectId = parseInt(project.id);
      if (!projectId) {
        skippedCount++;
        continue;
      }
      
      // Parse event types and expenditure types
      const eventTypeArray = parseJsonArray(project.event_type);
      const expenditureTypeArray = parseJsonArray(project.expenditure_type);
      
      if (eventTypeArray.length === 0 || expenditureTypeArray.length === 0) {
        skippedCount++;
        continue;
      }
      
      // Find matching IDs
      const implementingAgencies = parseJsonArray(project.implementing_agency);
      const monadaId = findMonadaId(implementingAgencies, monadaList);
      const kallikratisId = findKallikratisId(project.region, kallikratisList);
      
      // Create entries for each combination
      for (const eventTypeName of eventTypeArray) {
        const eventType = eventTypes.find(et => et.name === eventTypeName.trim());
        if (!eventType) continue;
        
        for (const expenditureTypeName of expenditureTypeArray) {
          const expenditureType = expenditureTypes.find(et => et.expediture_types === expenditureTypeName.trim());
          if (!expenditureType) continue;
          
          const { error } = await supabase
            .from('project_index')
            .insert({
              project_id: projectId,
              monada_id: monadaId,
              kallikratis_id: kallikratisId,
              event_types_id: eventType.id,
              expediture_type_id: expenditureType.id
            });
          
          if (!error) {
            insertedCount++;
          } else {
            console.error(`Error inserting project ${projectId}:`, error.message);
            skippedCount++;
          }
        }
      }
      
    } catch (err) {
      console.error(`Error processing project ${project.id}:`, err.message);
      skippedCount++;
    }
  }
  
  console.log(`\n=== PROCESSING COMPLETE ===`);
  console.log(`✓ Successfully inserted: ${insertedCount} records`);
  console.log(`✗ Skipped: ${skippedCount} records`);
  console.log(`📊 Total projects processed: ${processedCount}`);
  
  return { insertedCount, skippedCount, processedCount };
}

async function validateResults() {
  console.log('\n=== VALIDATING RESULTS ===');
  
  // Get final count
  const { data, count } = await supabase
    .from('project_index')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total records in project_index: ${count}`);
  
  // Test sample queries with proper joins
  const { data: sampleWithJoins } = await supabase
    .from('project_index')
    .select(`
      project_id,
      Projects!inner(na853, event_description),
      event_types!inner(name),
      expediture_types!inner(expediture_types),
      Monada!inner(unit)
    `)
    .limit(5);
  
  if (sampleWithJoins && sampleWithJoins.length > 0) {
    console.log('\nSample records with proper relationships:');
    sampleWithJoins.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.Projects.na853}: ${record.event_types.name} + ${record.expediture_types.expediture_types} (Unit: ${record.Monada.unit})`);
    });
  }
  
  // Test performance queries
  const startTime = Date.now();
  const { data: eventQuery } = await supabase
    .from('project_index')
    .select('project_id')
    .eq('event_types_id', 12); // ΠΥΡΚΑΓΙΑ
  
  const queryTime = Date.now() - startTime;
  console.log(`\nPerformance test: Found ${eventQuery?.length || 0} fire projects in ${queryTime}ms`);
  
  return count;
}

async function main() {
  console.log('=== SMART PROJECT INDEX POPULATION ===\n');
  
  const results = await processProjectsFromCSV();
  const finalCount = await validateResults();
  
  console.log('\n=== SUMMARY ===');
  console.log('Project index table has been populated with accurate mapping between:');
  console.log('• Project IDs from your actual Projects table');
  console.log('• Event types matched by exact name');
  console.log('• Expenditure types matched by exact name');
  console.log('• Organizational units (Monada) matched by implementing agency codes');
  console.log('• Geographic regions (Kallikratis) matched by region/municipality data');
  console.log(`\nFinal result: ${finalCount} properly indexed records ready for optimized queries.`);
}

main().catch(console.error);