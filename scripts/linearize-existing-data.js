/**
 * Linearize Existing Project History Data
 * 
 * This script reorganizes the existing JSONB data in project_history
 * to be more linear and easier to work with, within the current table structure
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function linearizeProjectHistory() {
  console.log('Linearizing existing project_history data...\n');
  
  try {
    // Get all existing data
    const { data: existingEntries, error: fetchError } = await supabase
      .from('project_history')
      .select('*');
      
    if (fetchError) {
      console.error('Error fetching data:', fetchError);
      return false;
    }
    
    console.log(`Found ${existingEntries.length} entries to linearize`);
    
    // Backup original data
    const fs = await import('fs');
    const backupFile = `project_history_pre_linearization_${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(existingEntries, null, 2));
    console.log(`✅ Created backup: ${backupFile}`);
    
    // Transform each entry to be more linear
    const linearizedEntries = existingEntries.map(entry => {
      const formulation = entry.formulation || {};
      const decisions = entry.decisions || {};
      const projectDetails = formulation.project_details || {};
      const eventDetails = formulation.event_details || {};
      
      // Create simplified, linear-like structure
      return {
        id: entry.id,
        project_id: entry.project_id,
        created_at: entry.created_at,
        
        // Flatten the main fields into top-level properties
        implementing_agency_location: entry.implementing_agency_location,
        event_year: entry.event_year,
        enumeration_code: entry.enumeration_code || formulation.na853_code,
        inclusion_year: entry.inclusion_year,
        summary_description: entry.summary_description || formulation.event_description,
        expenses_executed: entry.expenses_executed || parseFloat(formulation.budget_na853),
        project_status: entry.project_status || projectDetails.project_status,
        
        // Simplified decisions structure (flattened)
        decisions: {
          protocol_number: decisions.kya?.[0] || null,
          fek: decisions.fek?.[0] || null,
          ada: decisions.ada?.[0] || null,
          budget_decision: decisions.budget_decision?.[0] || null,
          funding_decision: decisions.funding_decision?.[0] || null
        },
        
        // Simplified formulation with linear structure
        formulation: {
          // Core project info
          project_title: formulation.project_title || projectDetails.project_title,
          project_description: projectDetails.project_description,
          event_description: formulation.event_description,
          
          // Financial data
          budget_na853: parseFloat(formulation.budget_na853) || null,
          budget_na271: parseFloat(formulation.budget_na271) || null,
          budget_e069: parseFloat(formulation.budget_e069) || null,
          
          // Codes
          na853_code: formulation.na853_code,
          mis_code: formulation.mis_code,
          
          // Event info
          event_year: eventDetails.event_year || entry.event_year?.toString(),
          event_name: eventDetails.event_name,
          
          // Status
          status: projectDetails.project_status || entry.project_status,
          inclusion_year: projectDetails.inclusion_year || entry.inclusion_year
        },
        
        // Keep other necessary fields but simplified
        expenditure_types: entry.expenditure_types,
        event_name: entry.event_name,
        previous_entries: entry.previous_entries,
        changes: entry.changes
      };
    });
    
    console.log('✅ Linearized data structure created');
    
    // Update each entry with linearized structure
    let updatedCount = 0;
    
    for (const linearEntry of linearizedEntries) {
      const { id, ...updateData } = linearEntry;
      
      const { error: updateError } = await supabase
        .from('project_history')
        .update(updateData)
        .eq('id', id);
        
      if (updateError) {
        console.error(`Error updating entry ${id}:`, updateError);
        continue;
      }
      
      updatedCount++;
      if (updatedCount % 50 === 0) {
        console.log(`✅ Updated ${updatedCount}/${linearizedEntries.length} entries`);
      }
    }
    
    console.log(`\n✅ Successfully linearized ${updatedCount} entries`);
    
    // Verify the linearization
    const { data: verifyData, error: verifyError } = await supabase
      .from('project_history')
      .select('*')
      .limit(1);
      
    if (!verifyError && verifyData.length > 0) {
      console.log('\n📋 Sample linearized entry:');
      console.log('==========================');
      
      const sample = verifyData[0];
      console.log(`Project ID: ${sample.project_id}`);
      console.log(`Title: ${sample.formulation?.project_title?.substring(0, 50)}...`);
      console.log(`Budget NA853: ${sample.formulation?.budget_na853}`);
      console.log(`Protocol: ${sample.decisions?.protocol_number}`);
      console.log(`Status: ${sample.project_status}`);
      console.log(`Year: ${sample.event_year}`);
      
      console.log('\n✨ Linear structure benefits:');
      console.log('• Flattened decision fields for direct access');
      console.log('• Simplified formulation structure');
      console.log('• Core fields moved to top level');
      console.log('• Better data organization');
      console.log('• Easier querying and analysis');
    }
    
    return true;
    
  } catch (error) {
    console.error('Error linearizing data:', error);
    return false;
  }
}

async function main() {
  console.log('=== Project History Data Linearization ===');
  
  const success = await linearizeProjectHistory();
  
  if (success) {
    console.log('\n🎉 Project history data linearization completed!');
    console.log('\nThe data structure is now more linear and easier to work with.');
    console.log('This prepares the foundation for full linear table migration.');
  } else {
    console.log('\n❌ Linearization failed. Please check the logs above.');
  }
}

main();