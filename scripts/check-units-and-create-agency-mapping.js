/**
 * Check Units and Create Agency Mapping
 * 
 * This script checks the Monada table and creates proper mapping
 * for implementing agencies from the CSV data.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUnitsAndCreateMapping() {
  console.log('=== CHECKING UNITS AND CREATING AGENCY MAPPING ===\n');
  
  try {
    // Step 1: Get all units
    console.log('📊 Step 1: Fetching all units from Monada table...');
    const { data: units, error: unitsError } = await supabase
      .from('Monada')
      .select('*')
      .order('unit_name');
    
    if (unitsError) {
      throw new Error(`Failed to fetch units: ${unitsError.message}`);
    }
    
    console.log(`   Found ${units.length} units:`);
    units.forEach(unit => {
      console.log(`     ID: ${unit.id}, Name: "${unit.unit_name}"`);
    });
    
    // Step 2: Create agency mapping based on CSV patterns
    console.log('\n🔍 Step 2: Creating agency mapping...');
    
    const agencyMapping = new Map();
    
    // Common CSV agency patterns to database unit mappings
    const commonMappings = [
      // ΔΑΕΦΚ variations
      { csvPattern: /ΔΑΕΦΚ-ΚΕ/, unitName: 'ΔΑΕΦΚ-ΚΕ' },
      { csvPattern: /ΔΑΕΦΚ-ΒΕ/, unitName: 'ΔΑΕΦΚ-ΒΕ' },
      { csvPattern: /ΔΑΕΦΚ-ΔΕ/, unitName: 'ΔΑΕΦΚ-ΔΕ' },
      { csvPattern: /ΔΑΕΦΚ-ΑΚ/, unitName: 'ΔΑΕΦΚ-ΑΚ' },
      { csvPattern: /ΓΔΑΕΦΚ/, unitName: 'ΓΔΑΕΦΚ' },
      
      // ΤΑΣ variations
      { csvPattern: /ΤΑΣ ΚΟΖΑΝΗΣ/, unitName: 'ΤΑΣ ΚΟΖΑΝΗΣ' },
      { csvPattern: /ΤΑΣ ΑΧΑΪΑΣ/, unitName: 'ΤΑΣ ΑΧΑΪΑΣ' },
      { csvPattern: /ΤΑΣ ΜΕΣΣΗΝΙΑΣ/, unitName: 'ΤΑΣ ΜΕΣΣΗΝΙΑΣ' },
      { csvPattern: /ΤΑΣ ΚΕΦΑΛΟΝΙΑΣ/, unitName: 'ΤΑΣ ΚΕΦΑΛΟΝΙΑΣ' },
      { csvPattern: /ΤΑΣ ΛΕΥΚΑΔΑΣ/, unitName: 'ΤΑΣ ΛΕΥΚΑΔΑΣ' },
      
      // ΤΑΠ variations
      { csvPattern: /ΤΑΠ ΗΛΕΙΑΣ/, unitName: 'ΤΑΠ ΗΛΕΙΑΣ' },
      
      // ΤΑΕΦΚ variations
      { csvPattern: /ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ/, unitName: 'ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ' },
      { csvPattern: /ΤΑΕΦΚ ΧΑΛΚΙΔΙΚΗΣ/, unitName: 'ΤΑΕΦΚ ΧΑΛΚΙΔΙΚΗΣ' },
      { csvPattern: /ΤΑΕΦΚ-ΔΑ/, unitName: 'ΤΑΕΦΚ-ΔΑ' },
      { csvPattern: /ΤΑΕΦΚ-ΑΑ/, unitName: 'ΤΑΕΦΚ-ΑΑ' }
    ];
    
    // Map each pattern to actual unit IDs
    commonMappings.forEach(mapping => {
      const matchingUnit = units.find(unit => 
        unit.unit_name && unit.unit_name.includes(mapping.unitName)
      );
      
      if (matchingUnit) {
        agencyMapping.set(mapping.unitName, {
          id: matchingUnit.id,
          fullName: matchingUnit.unit_name,
          pattern: mapping.csvPattern
        });
        console.log(`     ✓ ${mapping.unitName} → ID: ${matchingUnit.id} (${matchingUnit.unit_name})`);
      } else {
        console.log(`     ❌ ${mapping.unitName} → Not found in database`);
      }
    });
    
    // Step 3: Check project_index table current state
    console.log('\n📊 Step 3: Checking current project_index state...');
    
    const { data: sampleIndex, error: indexError } = await supabase
      .from('project_index')
      .select('project_id, unit_id, event_type_id, expediture_type_id')
      .limit(10);
    
    if (indexError) {
      throw new Error(`Failed to fetch project_index: ${indexError.message}`);
    }
    
    console.log(`   Sample project_index entries: ${sampleIndex.length}`);
    sampleIndex.forEach(entry => {
      console.log(`     Project: ${entry.project_id}, Unit: ${entry.unit_id}, Event: ${entry.event_type_id}, Expense: ${entry.expediture_type_id}`);
    });
    
    // Step 4: Quick update for specific known projects
    console.log('\n🔧 Step 4: Performing quick updates for known mappings...');
    
    // Sample specific updates for demonstration
    const quickUpdates = [
      { mis: '5174691', agencyName: 'ΔΑΕΦΚ-ΚΕ' },
      { mis: '5203790', agencyName: 'ΔΑΕΦΚ-ΚΕ' },
      { mis: '5203792', agencyName: 'ΓΔΑΕΦΚ' }
    ];
    
    let updateCount = 0;
    
    for (const update of quickUpdates) {
      // Find project
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id')
        .eq('mis', update.mis)
        .single();
      
      if (projectError || !project) {
        console.log(`     ⚠️ Project not found for MIS ${update.mis}`);
        continue;
      }
      
      // Find unit ID
      const agencyInfo = agencyMapping.get(update.agencyName);
      if (!agencyInfo) {
        console.log(`     ⚠️ Agency mapping not found for ${update.agencyName}`);
        continue;
      }
      
      // Update project_index
      const { data: updateResult, error: updateError } = await supabase
        .from('project_index')
        .update({ unit_id: agencyInfo.id })
        .eq('project_id', project.id)
        .select();
      
      if (updateError) {
        console.log(`     ❌ Failed to update MIS ${update.mis}: ${updateError.message}`);
      } else {
        updateCount++;
        console.log(`     ✅ Updated MIS ${update.mis} → Unit ID ${agencyInfo.id} (${agencyInfo.fullName})`);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updateCount} project records`);
    
    // Step 5: Generate mapping summary
    console.log('\n📋 AGENCY MAPPING SUMMARY:');
    console.log('Available unit mappings:');
    agencyMapping.forEach((info, agency) => {
      console.log(`   ${agency} → Unit ID ${info.id} (${info.fullName})`);
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('   1. Use the agency mapping above for CSV processing');
    console.log('   2. Handle ΕΚΤΟΣ ΕΔΡΑΣ* cases by finding the agency marked with *');
    console.log('   3. Most common agencies: ΔΑΕΦΚ-ΚΕ, ΔΑΕΦΚ-ΒΕ, ΔΑΕΦΚ-ΔΕ');
    console.log('   4. For bulk updates, process in smaller batches to avoid timeouts');
    
  } catch (error) {
    console.error('❌ Error checking units:', error.message);
    throw error;
  }
}

// Execute the check
checkUnitsAndCreateMapping().catch(console.error);