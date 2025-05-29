/**
 * Fix JSON Data Script
 * 
 * This script fixes double-encoded JSON strings in the database
 * by converting escaped JSON strings to proper JSON arrays.
 * 
 * Example:
 * FROM: "[\"ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ\", \"ΔΚΑ ΕΠΙΣΚΕΥΗ\"]"
 * TO: ["ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ", "ΔΚΑ ΕΠΙΣΚΕΥΗ"]
 */

import { supabase } from '../server/config/db.js';

/**
 * Fix expenditure_type fields in Projects table
 */
async function fixProjectsExpenditureTypes() {
  console.log('Fixing expenditure_type fields in Projects table...');
  
  try {
    // Fetch all projects with expenditure_type data
    const { data: projects, error: fetchError } = await supabase
      .from('Projects')
      .select('id, expenditure_type')
      .not('expenditure_type', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching projects:', fetchError);
      return;
    }
    
    console.log(`Found ${projects.length} projects to process`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      try {
        let expenditureType = project.expenditure_type;
        
        // Check if it's a string that looks like escaped JSON
        if (typeof expenditureType === 'string' && expenditureType.startsWith('[')) {
          try {
            // Try to parse the escaped JSON string
            const parsed = JSON.parse(expenditureType);
            
            if (Array.isArray(parsed)) {
              // Update the project with the proper array
              const { error: updateError } = await supabase
                .from('Projects')
                .update({ expenditure_type: parsed })
                .eq('id', project.id);
              
              if (updateError) {
                console.error(`Error updating project ${project.id}:`, updateError);
                errorCount++;
              } else {
                console.log(`Fixed project ${project.id}: ${expenditureType} -> [${parsed.join(', ')}]`);
                fixedCount++;
              }
            }
          } catch (parseError) {
            console.warn(`Could not parse expenditure_type for project ${project.id}:`, expenditureType);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Projects table: Fixed ${fixedCount} records, ${errorCount} errors`);
  } catch (error) {
    console.error('Error fixing Projects expenditure_type:', error);
  }
}

/**
 * Fix any other JSON fields that might have the same issue
 */
async function fixOtherJsonFields() {
  console.log('Checking for other JSON fields that need fixing...');
  
  // Add other tables/fields here if needed
  // For now, we'll focus on the expenditure_type field
}

/**
 * Validate the fixes by checking a few records
 */
async function validateFixes() {
  console.log('Validating fixes...');
  
  try {
    const { data: sampleProjects, error } = await supabase
      .from('Projects')
      .select('id, expenditure_type')
      .not('expenditure_type', 'is', null)
      .limit(5);
    
    if (error) {
      console.error('Error validating fixes:', error);
      return;
    }
    
    console.log('Sample of fixed records:');
    sampleProjects.forEach(project => {
      console.log(`Project ${project.id}: ${typeof project.expenditure_type} - ${JSON.stringify(project.expenditure_type)}`);
    });
  } catch (error) {
    console.error('Error during validation:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting JSON data fix script...');
  
  try {
    await fixProjectsExpenditureTypes();
    await fixOtherJsonFields();
    await validateFixes();
    
    console.log('JSON data fix script completed successfully!');
  } catch (error) {
    console.error('Error in main script:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, fixProjectsExpenditureTypes, validateFixes };