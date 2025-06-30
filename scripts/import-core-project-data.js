/**
 * Core Project Data Import Script
 * 
 * This script focuses on importing the essential project data from CSV
 * into the Projects table, avoiding complex relationships for now.
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
 * Process a single project row - simplified version
 */
async function processProjectRow(row, rowIndex) {
  try {
    console.log(`Processing row ${rowIndex + 1}: MIS ${row['MIS']}`);
    
    // Extract core project data
    const projectData = {
      mis: parseInt(row['MIS']),
      e069: cleanText(row['E069']),
      na271: cleanText(row['NA271']),
      na853: cleanText(row['NA853']),
      event_description: cleanText(row['Περιγραφή Συμβάντος']),
      project_title: cleanText(row['Τίτλος έργου']),
      event_year: row['Έτος εκδήλωσης συμβάντος'] ? [row['Έτος εκδήλωσης συμβάντος']] : [],
      budget_e069: parseBudgetAmount(row['Προϋπολογισμός έργου στο ΠΔΕ Ε069 (τελευταία κατάρτιση)']),
      budget_na271: parseBudgetAmount(row['Προϋπολογισμός έργου στο ΠΔΕ ΝΑ271 (τελευταία κατάρτιση)']),
      budget_na853: parseBudgetAmount(row['Προϋπολογισμός έργου στο ΠΔΕ ΝΑ853 (τελευταία κατάρτιση)']),
      status: 'active',
      event_type_id: null, // We'll set this later when we have proper event types
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Upsert project (update if exists, insert if new)
    const { data: project, error: projectError } = await supabase
      .from('Projects')
      .upsert(projectData, { 
        onConflict: 'mis',
        ignoreDuplicates: false 
      })
      .select('id, mis')
      .single();
      
    if (projectError) {
      console.error(`❌ Error upserting project ${row['MIS']}:`, projectError);
      return;
    }
    
    console.log(`✅ Project ${project.mis} upserted successfully (ID: ${project.id})`);
    
    // Update budget table if we have budget data
    if (projectData.budget_na853 && projectData.budget_na853 > 0) {
      const budgetData = {
        project_id: project.id,
        mis: parseInt(row['MIS']),
        na853: cleanText(row['NA853']),
        ethsia_pistosi: projectData.budget_na853,
        user_view: projectData.budget_na853,
        katanomes_etous: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        proip: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error: budgetError } = await supabase
        .from('budget_na853_split')
        .upsert(budgetData, { onConflict: 'project_id' });
        
      if (budgetError) {
        console.log(`⚠️  Budget update failed for project ${project.id}:`, budgetError.message);
      } else {
        console.log(`✅ Budget data updated for project ${project.mis}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing row ${rowIndex + 1}:`, error);
  }
}

/**
 * Main import function
 */
async function importCoreProjectData() {
  console.log('🚀 Starting core project data import...\n');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751262084262.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
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
      results.push(row);
    })
    .on('end', async () => {
      console.log(`📊 Parsed ${results.length} rows from CSV\n`);
      
      let processed = 0;
      let errors = 0;
      
      // Process in smaller batches to avoid overwhelming the database
      for (let i = 0; i < results.length; i += 5) {
        const batch = results.slice(i, i + 5);
        console.log(`\n🔄 Processing batch ${Math.floor(i/5) + 1}/${Math.ceil(results.length/5)}...`);
        
        // Process batch sequentially to avoid conflicts
        for (let j = 0; j < batch.length; j++) {
          try {
            await processProjectRow(batch[j], i + j);
            processed++;
          } catch (error) {
            console.error(`❌ Error in batch processing:`, error);
            errors++;
          }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n🎉 Core project data import completed!
      - Total rows: ${results.length}
      - Successfully processed: ${processed}
      - Errors: ${errors}`);
      
      // Get final count from database
      const { data: projectCount } = await supabase
        .from('Projects')
        .select('id', { count: 'exact' });
        
      console.log(`📊 Total projects in database: ${projectCount?.length || 'unknown'}`);
      
      resolve();
    })
    .on('error', (error) => {
      console.error('❌ CSV parsing error:', error);
      reject(error);
    });
  });
}

// Run the import
importCoreProjectData().catch(console.error);