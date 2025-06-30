/**
 * Enhance Project Relationships Script
 * 
 * This script enhances the imported projects with proper relationships:
 * - Event types mapping
 * - Geographic data (kallikratis)
 * - Implementing agencies (monada)
 * - Expenditure types
 * - Project index entries
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Cache for reference data
let eventTypesCache = [];
let expenditureTypesCache = [];
let monadaCache = [];
let kallikratisCache = [];

/**
 * Load reference data into cache
 */
async function loadReferenceData() {
  console.log('📋 Loading reference data...');
  
  const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
    supabase.from('event_types').select('*'),
    supabase.from('expediture_types').select('*'),
    supabase.from('Monada').select('*'),
    supabase.from('kallikratis').select('*')
  ]);
  
  eventTypesCache = eventTypesRes.data || [];
  expenditureTypesCache = expenditureTypesRes.data || [];
  monadaCache = monadaRes.data || [];
  kallikratisCache = kallikratisRes.data || [];
  
  console.log(`✓ Loaded reference data:
  - Event types: ${eventTypesCache.length}
  - Expenditure types: ${expenditureTypesCache.length}
  - Implementing agencies: ${monadaCache.length}
  - Kallikratis entries: ${kallikratisCache.length}`);
}

/**
 * Find or create event type
 */
async function findOrCreateEventType(eventName) {
  if (!eventName) return null;
  
  // Check cache first
  let eventType = eventTypesCache.find(et => et.name === eventName);
  if (eventType) return eventType.id;
  
  // Create new event type
  console.log(`Creating new event type: ${eventName}`);
  const { data: created, error } = await supabase
    .from('event_types')
    .insert({ name: eventName })
    .select('*')
    .single();
    
  if (error) {
    console.error(`Error creating event type ${eventName}:`, error);
    return null;
  }
  
  // Add to cache
  eventTypesCache.push(created);
  return created.id;
}

/**
 * Find implementing agency by various name patterns
 */
function findImplementingAgency(agencyName) {
  if (!agencyName) return null;
  
  // Direct unit match
  let agency = monadaCache.find(m => m.unit === agencyName);
  if (agency) return parseInt(agency.id);
  
  // Unit name match
  agency = monadaCache.find(m => {
    const unitName = typeof m.unit_name === 'object' ? m.unit_name.name : m.unit_name;
    return unitName === agencyName;
  });
  if (agency) return parseInt(agency.id);
  
  // Partial match for complex names
  agency = monadaCache.find(m => {
    const unitName = typeof m.unit_name === 'object' ? m.unit_name.name : m.unit_name;
    return unitName && unitName.includes(agencyName.substring(0, 10));
  });
  if (agency) return parseInt(agency.id);
  
  return null;
}

/**
 * Find kallikratis entry by geographic hierarchy
 */
function findKallikratisEntry(region, regionalUnit, municipality) {
  if (!region) return null;
  
  // Try exact match first
  let kallikratis = kallikratisCache.find(k => 
    k.perifereia === region && 
    k.perifereiaki_enotita === regionalUnit &&
    k.onoma_neou_ota === municipality
  );
  
  if (kallikratis) return kallikratis.id;
  
  // Try region + regional unit match
  kallikratis = kallikratisCache.find(k => 
    k.perifereia === region && 
    k.perifereiaki_enotita === regionalUnit
  );
  
  if (kallikratis) return kallikratis.id;
  
  // Try region only match
  kallikratis = kallikratisCache.find(k => k.perifereia === region);
  
  if (kallikratis) return kallikratis.id;
  
  return null;
}

/**
 * Parse expenditure types from CSV format
 */
function parseExpenditureTypes(value) {
  if (!value) return [];
  
  return value.split('\n')
    .map(t => t.trim())
    .filter(t => t && t !== '')
    .map(t => t.replace(/\*$/, '')); // Remove asterisk suffix
}

/**
 * Parse implementing agencies from CSV format
 */
function parseImplementingAgencies(value) {
  if (!value) return [];
  
  return value.split('\n')
    .map(a => a.trim())
    .filter(a => a && a !== '');
}

/**
 * Process project relationships from CSV data
 */
async function processProjectRelationships() {
  console.log('🔄 Processing project relationships...\n');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751262084262.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found');
    return;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    const results = [];
    
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      escape: '"'
    })
    .on('data', (row) => {
      results.push(row);
    })
    .on('end', async () => {
      console.log(`📊 Processing ${results.length} project relationships...\n`);
      
      let processed = 0;
      let errors = 0;
      let indexEntriesCreated = 0;
      
      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        
        try {
          console.log(`Processing project ${i + 1}/${results.length}: MIS ${row['MIS']}`);
          
          // Find project in database
          const { data: project, error: projectError } = await supabase
            .from('Projects')
            .select('id, mis')
            .eq('mis', parseInt(row['MIS']))
            .single();
            
          if (projectError || !project) {
            console.log(`⚠️  Project ${row['MIS']} not found in database`);
            continue;
          }
          
          // 1. Update event type
          const eventTypeId = await findOrCreateEventType(row['Συμβάν']);
          if (eventTypeId) {
            await supabase
              .from('Projects')
              .update({ event_type_id: eventTypeId })
              .eq('id', project.id);
          }
          
          // 2. Create project_index entries
          const expenditureTypes = parseExpenditureTypes(row['Είδος δαπάνης που προκαλείται']);
          const implementingAgencies = parseImplementingAgencies(row['Φορέας υλοποίησης']);
          
          // Clear existing project_index entries for this project
          await supabase
            .from('project_index')
            .delete()
            .eq('project_id', project.id);
          
          for (const agencyName of implementingAgencies) {
            const monadaId = findImplementingAgency(agencyName);
            if (!monadaId) {
              console.log(`⚠️  Agency not found: ${agencyName}`);
              continue;
            }
            
            const kallikratisId = findKallikratisEntry(
              row['Περιφέρεια'],
              row['Περιφερειακή ενότητα'],
              row['Δήμος']
            );
            
            if (!kallikratisId) {
              console.log(`⚠️  Kallikratis not found: ${row['Περιφέρεια']} > ${row['Περιφερειακή ενότητα']} > ${row['Δήμος']}`);
              continue;
            }
            
            for (const expenditureTypeName of expenditureTypes) {
              // Find expenditure type ID
              const expenditureType = expenditureTypesCache.find(et => 
                et.expediture_types === expenditureTypeName
              );
              
              if (!expenditureType) {
                console.log(`⚠️  Expenditure type not found: ${expenditureTypeName}`);
                continue;
              }
              
              const indexEntry = {
                project_id: project.id,
                monada_id: monadaId,
                kallikratis_id: kallikratisId,
                event_types_id: eventTypeId || 1,
                expediture_type_id: expenditureType.id,
                geographic_code: kallikratisId
              };
              
              const { error: indexError } = await supabase
                .from('project_index')
                .insert(indexEntry);
                
              if (!indexError) {
                indexEntriesCreated++;
              } else {
                console.log(`⚠️  Index entry creation failed:`, indexError.message);
              }
            }
          }
          
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`✓ Processed ${processed}/${results.length} projects`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing project ${row['MIS']}:`, error);
          errors++;
        }
        
        // Small delay to avoid overwhelming the database
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`\n🎉 Project relationships processing completed!
      - Total projects processed: ${processed}
      - Errors: ${errors}
      - Project index entries created: ${indexEntriesCreated}`);
      
      resolve();
    })
    .on('error', (error) => {
      console.error('❌ CSV parsing error:', error);
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function enhanceProjectRelationships() {
  console.log('🚀 Starting project relationships enhancement...\n');
  
  try {
    await loadReferenceData();
    await processProjectRelationships();
    
    console.log('\n✅ Project relationships enhancement completed successfully');
    
  } catch (error) {
    console.error('❌ Enhancement failed:', error);
  }
}

// Run the enhancement
enhanceProjectRelationships();