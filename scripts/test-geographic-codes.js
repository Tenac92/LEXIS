/**
 * Test Geographic Codes Script
 * 
 * This script tests the correct kodikos field mapping for each administrative level:
 * - Region (Περιφέρεια): kodikos_perifereias
 * - Regional Unit (Περιφερειακή Ενότητα): kodikos_perifereiakis_enotitas
 * - Municipality (Δήμος): kodikos_neou_ota
 * - Municipal Community (Δημοτική Ενότητα): kodikos_dimotikis_enotitas
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = 'https://iurhkqvicauzhlxdqtwh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testGeographicCodes() {
  try {
    console.log('Testing geographic code logic...\n');
    
    // Get sample kallikratis data for testing
    const { data: kallikratisData, error: kallikratisError } = await supabase
      .from('kallikratis')
      .select('*')
      .limit(5);
    
    if (kallikratisError) {
      throw kallikratisError;
    }
    
    console.log('Sample kallikratis entries:');
    kallikratisData.forEach((entry, index) => {
      console.log(`\n${index + 1}. Entry ID: ${entry.id}`);
      console.log(`   Region: ${entry.perifereia}`);
      console.log(`   Regional Unit: ${entry.perifereiaki_enotita}`);
      console.log(`   Municipality: ${entry.onoma_neou_ota || 'N/A'}`);
      console.log(`   Municipal Community: ${entry.onoma_dimotikis_enotitas || 'N/A'}`);
      console.log(`   kodikos_perifereias: ${entry.kodikos_perifereias}`);
      console.log(`   kodikos_perifereiakis_enotitas: ${entry.kodikos_perifereiakis_enotitas}`);
      console.log(`   kodikos_neou_ota: ${entry.kodikos_neou_ota || 'N/A'}`);
      console.log(`   kodikos_dimotikis_enotitas: ${entry.kodikos_dimotikis_enotitas || 'N/A'}`);
      
      // Simulate the logic for geographic code selection
      let selectedCode;
      let level;
      
      if (entry.onoma_neou_ota && entry.onoma_dimotikis_enotitas) {
        selectedCode = entry.kodikos_dimotikis_enotitas;
        level = "Municipal Community";
      } else if (entry.onoma_neou_ota) {
        selectedCode = entry.kodikos_neou_ota;
        level = "Municipality";
      } else if (entry.perifereiaki_enotita) {
        selectedCode = entry.kodikos_perifereiakis_enotitas;
        level = "Regional Unit";
      } else {
        selectedCode = entry.kodikos_perifereias;
        level = "Region";
      }
      
      console.log(`   → Selected Level: ${level}`);
      console.log(`   → Selected Code: ${selectedCode}`);
    });
    
    console.log('\n✓ Geographic code logic test completed successfully');
    
  } catch (error) {
    console.error('Error testing geographic codes:', error);
    process.exit(1);
  }
}

async function main() {
  await testGeographicCodes();
  process.exit(0);
}

main();