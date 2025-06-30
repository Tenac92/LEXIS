/**
 * Comprehensive Project Data Import Script
 * 
 * This script imports project data from the comprehensive CSV file and updates
 * all related database tables with proper foreign key relationships.
 * 
 * The CSV contains:
 * - Core project data (MIS, codes, titles, descriptions)
 * - Budget information (E069, NA271, NA853)
 * - Geographic data (Region, Regional Unit, Municipality)
 * - Implementing agencies
 * - Expenditure types
 * - Decision documents (KYA, FEK, ADA)
 * - Event information
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

/**
 * Map CSV column names to consistent field names
 */
const COLUMN_MAPPING = {
  'MIS': 'mis',
  'E069': 'e069',
  'NA271': 'na271', 
  'NA853': 'na853',
  'Περιγραφή Συμβάντος': 'event_description',
  'Τίτλος έργου': 'project_title',
  'Συμβάν': 'event_name',
  'Έτος εκδήλωσης συμβάντος': 'event_year',
  'Περιφέρεια': 'region',
  'Περιφερειακή ενότητα': 'regional_unit',
  'Δήμος': 'municipality', 
  'Φορέας υλοποίησης': 'implementing_agency',
  'Είδος δαπάνης που προκαλείται': 'expenditure_types',
  'ΚΥΑ': 'kya',
  'ΦΕΚ': 'fek',
  'ΑΔΑ': 'ada',
  'Διαδικασίες': 'procedures',
  'ΑΔΑ ένταξης στη ΣΑ ΝΑ271': 'ada_na271',
  'ΑΔΑ ένταξης στη ΣΑ ΝΑ853': 'ada_na853',
  'Απόφαση κατάρτισης προϋπολογισμού': 'budget_decision',
  'Απόφαση χρηματοδότησης': 'funding_decision',
  'Ποσό κατανομής': 'allocation_amount',
  'Προϋπολογισμός έργου στο ΠΔΕ Ε069 (τελευταία κατάρτιση)': 'budget_e069',
  'Προϋπολογισμός έργου στο ΠΔΕ ΝΑ271 (τελευταία κατάρτιση)': 'budget_na271',
  'Προϋπολογισμός έργου στο ΠΔΕ ΝΑ853 (τελευταία κατάρτιση)': 'budget_na853'
};

/**
 * Clean and normalize text values
 */
function cleanText(value) {
  if (!value || typeof value !== 'string') return null;
  return value.trim().replace(/\s+/g, ' ').replace(/"/g, '') || null;
}

/**
 * Parse budget amount from Greek format
 */
function parseBudgetAmount(value) {
  if (!value || typeof value !== 'string') return null;
  
  // Remove Greek currency symbol, spaces, and dots used as thousand separators
  const cleaned = value.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse expenditure types array
 */
function parseExpenditureTypes(value) {
  if (!value) return [];
  
  const types = value.split('\n').map(t => t.trim()).filter(t => t);
  return types;
}

/**
 * Parse implementing agencies array
 */
function parseImplementingAgencies(value) {
  if (!value) return [];
  
  const agencies = value.split('\n').map(a => a.trim()).filter(a => a);
  return agencies;
}

/**
 * Find or create event type
 */
async function findOrCreateEventType(eventName) {
  if (!eventName) return null;
  
  // Check if exists
  const { data: existing, error } = await supabase
    .from('event_types')
    .select('id')
    .eq('name', eventName)
    .single();
    
  if (existing) return existing.id;
  
  // Create new
  const { data: created, error: createError } = await supabase
    .from('event_types')
    .insert({ name: eventName })
    .select('id')
    .single();
    
  if (createError) {
    console.error(`Error creating event type ${eventName}:`, createError);
    return null;
  }
  
  return created.id;
}

/**
 * Find implementing agency (monada) by unit name
 */
async function findImplementingAgency(agencyName) {
  if (!agencyName) return null;
  
  const { data, error } = await supabase
    .from('Monada')
    .select('id')
    .or(`unit.eq.${agencyName},unit_name->>name.eq.${agencyName}`)
    .single();
    
  if (error || !data) {
    console.log(`Agency not found: ${agencyName}`);
    return null;
  }
  
  return parseInt(data.id);
}

/**
 * Find kallikratis entry by geographic hierarchy
 */
async function findKallikratisEntry(region, regionalUnit, municipality) {
  if (!region) return null;
  
  let query = supabase.from('kallikratis').select('id');
  
  // Build query based on available geographic levels
  if (municipality) {
    query = query
      .eq('perifereia', region)
      .eq('perifereiaki_enotita', regionalUnit || '')
      .eq('onoma_neou_ota', municipality);
  } else if (regionalUnit) {
    query = query
      .eq('perifereia', region)
      .eq('perifereiaki_enotita', regionalUnit);
  } else {
    query = query.eq('perifereia', region);
  }
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    console.log(`Kallikratis not found: ${region} > ${regionalUnit} > ${municipality}`);
    return null;
  }
  
  return data.id;
}

/**
 * Process a single project row
 */
async function processProjectRow(row, rowIndex) {
  try {
    console.log(`\n--- Processing Row ${rowIndex + 1} ---`);
    console.log(`MIS: ${row.mis}, Title: ${row.project_title?.substring(0, 50)}...`);
    
    // 1. Insert/Update Projects table
    const projectData = {
      mis: parseInt(row.mis),
      e069: cleanText(row.e069),
      na271: cleanText(row.na271),
      na853: cleanText(row.na853),
      event_description: cleanText(row.event_description),
      project_title: cleanText(row.project_title),
      event_year: row.event_year ? [row.event_year] : [],
      budget_e069: parseBudgetAmount(row.budget_e069),
      budget_na271: parseBudgetAmount(row.budget_na271),
      budget_na853: parseBudgetAmount(row.budget_na853),
      status: 'active'
    };
    
    // Find event type
    if (row.event_name) {
      projectData.event_type_id = await findOrCreateEventType(row.event_name);
    }
    
    // Upsert project
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .upsert(projectData, { 
        onConflict: 'mis',
        ignoreDuplicates: false 
      })
      .select('id')
      .single();
      
    if (projectError) {
      console.error(`Error upserting project ${row.mis}:`, projectError);
      return;
    }
    
    console.log(`✓ Project upserted: ID ${project.id}`);
    
    // 2. Create project history entry
    const historyData = {
      project_id: project.id,
      decision_details: [{
        protocol_number: cleanText(row.kya) || '',
        fek: cleanText(row.fek) || '',
        ada: cleanText(row.ada) || '',
        implementing_agency: cleanText(row.implementing_agency) || '',
        decision_budget: cleanText(row.allocation_amount) || '',
        expenses_covered: '',
        decision_type: 'Έγκριση',
        is_included: true,
        comments: cleanText(row.procedures) || ''
      }],
      event_details: {
        event_name: cleanText(row.event_name) || '',
        event_year: cleanText(row.event_year) || ''
      },
      project_details: {
        mis: cleanText(row.mis) || '',
        sa: cleanText(row.na853) || '',
        enumeration_code: '',
        inclusion_year: cleanText(row.event_year) || '',
        project_title: cleanText(row.project_title) || '',
        project_description: cleanText(row.event_description) || '',
        summary_description: '',
        expenses_executed: '',
        project_status: 'Συνεχιζόμενο'
      },
      formulation_details: [{
        sa: 'ΝΑ853',
        enumeration_code: '',
        protocol_number: cleanText(row.kya) || '',
        ada: cleanText(row.ada_na853) || '',
        decision_year: cleanText(row.event_year) || '',
        project_budget: cleanText(row.budget_na853) || '',
        epa_version: '',
        total_public_expense: cleanText(row.budget_na853) || '',
        eligible_public_expense: cleanText(row.budget_na853) || '',
        decision_status: 'Ενεργή',
        change_type: 'Έγκριση',
        connected_decisions: '',
        comments: ''
      }]
    };
    
    const { error: historyError } = await supabase
      .from('project_history')
      .upsert(historyData, { onConflict: 'project_id' });
      
    if (historyError) {
      console.error(`Error creating history for project ${project.id}:`, historyError);
    } else {
      console.log(`✓ Project history created`);
    }
    
    // 3. Create project_index entries
    const expenditureTypes = parseExpenditureTypes(row.expenditure_types);
    const implementingAgencies = parseImplementingAgencies(row.implementing_agency);
    
    // Clear existing project_index entries
    await supabase
      .from('project_index')
      .delete()
      .eq('project_id', project.id);
    
    let indexEntriesCreated = 0;
    
    for (const agencyName of implementingAgencies) {
      const monadaId = await findImplementingAgency(agencyName);
      if (!monadaId) continue;
      
      const kallikratisId = await findKallikratisEntry(
        cleanText(row.region),
        cleanText(row.regional_unit), 
        cleanText(row.municipality)
      );
      
      if (!kallikratisId) continue;
      
      for (const expenditureType of expenditureTypes) {
        // Find expenditure type ID
        const { data: expType } = await supabase
          .from('expediture_types')
          .select('id')
          .eq('expediture_types', expenditureType.trim())
          .single();
          
        if (!expType) continue;
        
        const indexEntry = {
          project_id: project.id,
          monada_id: monadaId,
          kallikratis_id: kallikratisId,
          event_types_id: projectData.event_type_id || 1,
          expediture_type_id: expType.id,
          geographic_code: kallikratisId // Simplified for now
        };
        
        const { error: indexError } = await supabase
          .from('project_index')
          .insert(indexEntry);
          
        if (!indexError) {
          indexEntriesCreated++;
        }
      }
    }
    
    console.log(`✓ Created ${indexEntriesCreated} project_index entries`);
    
    // 4. Update budget table if needed
    if (projectData.budget_na853) {
      const budgetData = {
        project_id: project.id,
        mis: parseInt(row.mis),
        na853: cleanText(row.na853),
        ethsia_pistosi: parseBudgetAmount(row.budget_na853) || 0,
        user_view: parseBudgetAmount(row.budget_na853) || 0
      };
      
      const { error: budgetError } = await supabase
        .from('budget_na853_split')
        .upsert(budgetData, { onConflict: 'project_id' });
        
      if (!budgetError) {
        console.log(`✓ Budget data updated`);
      }
    }
    
    console.log(`✅ Row ${rowIndex + 1} processed successfully`);
    
  } catch (error) {
    console.error(`❌ Error processing row ${rowIndex + 1}:`, error);
  }
}

/**
 * Main import function
 */
async function importProjectData() {
  console.log('🚀 Starting comprehensive project data import...\n');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751262084262.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
  // Load reference data
  console.log('📋 Loading reference data...');
  const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
    supabase.from('event_types').select('*'),
    supabase.from('expediture_types').select('*'),
    supabase.from('Monada').select('*'),
    supabase.from('kallikratis').select('*')
  ]);
  
  console.log(`✓ Reference data loaded:
  - Event types: ${eventTypesRes.data?.length || 0}
  - Expenditure types: ${expenditureTypesRes.data?.length || 0}  
  - Implementing agencies: ${monadaRes.data?.length || 0}
  - Kallikratis entries: ${kallikratisRes.data?.length || 0}\n`);
  
  // Read and parse CSV
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
      // Map column names
      const mappedRow = {};
      for (const [csvCol, dbField] of Object.entries(COLUMN_MAPPING)) {
        mappedRow[dbField] = row[csvCol];
      }
      results.push(mappedRow);
    })
    .on('end', async () => {
      console.log(`📊 Parsed ${results.length} rows from CSV\n`);
      
      let processed = 0;
      let errors = 0;
      
      // Process in batches of 10
      for (let i = 0; i < results.length; i += 10) {
        const batch = results.slice(i, i + 10);
        console.log(`\n🔄 Processing batch ${Math.floor(i/10) + 1}/${Math.ceil(results.length/10)}...`);
        
        await Promise.all(
          batch.map(async (row, batchIndex) => {
            try {
              await processProjectRow(row, i + batchIndex);
              processed++;
            } catch (error) {
              console.error(`❌ Batch error for row ${i + batchIndex + 1}:`, error);
              errors++;
            }
          })
        );
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`\n🎉 Import completed!
      - Total rows: ${results.length}
      - Successfully processed: ${processed}
      - Errors: ${errors}`);
      
      resolve();
    })
    .on('error', (error) => {
      console.error('❌ CSV parsing error:', error);
      reject(error);
    });
  });
}

// Run the import
importProjectData().catch(console.error);