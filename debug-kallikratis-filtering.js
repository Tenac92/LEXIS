#!/usr/bin/env node

/**
 * Debug Kallikratis Filtering Issue
 * 
 * This script investigates why municipalities are not showing up properly
 * when selecting ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ > ΦΘΙΩΤΙΔΑΣ
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 DEBUG KALLIKRATIS FILTERING');
console.log('==============================\n');

async function debugKallikratisFiltering() {
  try {
    // 1. Check if the region exists
    console.log('1. Checking if region ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ exists...');
    const { data: regions, error: regionsError } = await supabase
      .from('kallikratis')
      .select('perifereia')
      .eq('perifereia', 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ')
      .limit(1);
    
    if (regionsError) {
      console.log('❌ Error fetching regions:', regionsError.message);
      return;
    }
    
    if (regions && regions.length > 0) {
      console.log('✅ Region found:', regions[0].perifereia);
    } else {
      console.log('❌ Region ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ not found in database');
      
      // Let's see what regions actually exist
      const { data: allRegions } = await supabase
        .from('kallikratis')
        .select('perifereia');
      
      console.log('📋 Available regions:');
      allRegions?.forEach(r => console.log(`   - ${r.perifereia}`));
      return;
    }
    
    // 2. Check regional units for this region
    console.log('\n2. Checking regional units for ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ...');
    const { data: regionalUnits, error: unitsError } = await supabase
      .from('kallikratis')
      .select('perifereiaki_enotita')
      .eq('perifereia', 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ');
    
    if (unitsError) {
      console.log('❌ Error fetching regional units:', unitsError.message);
      return;
    }
    
    console.log('📋 Regional units found:');
    regionalUnits?.forEach(u => console.log(`   - ${u.perifereiaki_enotita}`));
    
    const hasPhthiotida = regionalUnits?.some(u => u.perifereiaki_enotita === 'ΦΘΙΩΤΙΔΑΣ');
    if (!hasPhthiotida) {
      console.log('❌ ΦΘΙΩΤΙΔΑΣ not found in regional units');
      return;
    } else {
      console.log('✅ ΦΘΙΩΤΙΔΑΣ found in regional units');
    }
    
    // 3. Check municipalities for ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ > ΦΘΙΩΤΙΔΑΣ
    console.log('\n3. Checking municipalities for ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ > ΦΘΙΩΤΙΔΑΣ...');
    const { data: municipalities, error: munError } = await supabase
      .from('kallikratis')
      .select('DISTINCT onoma_neou_ota')
      .eq('perifereia', 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ')
      .eq('perifereiaki_enotita', 'ΦΘΙΩΤΙΔΑΣ')
      .not('onoma_neou_ota', 'is', null)
      .order('onoma_neou_ota');
    
    if (munError) {
      console.log('❌ Error fetching municipalities:', munError.message);
      return;
    }
    
    console.log(`📊 Found ${municipalities?.length || 0} municipalities:`);
    municipalities?.forEach(m => console.log(`   - ${m.onoma_neou_ota}`));
    
    if (!municipalities || municipalities.length === 0) {
      console.log('\n🚨 PROBLEM IDENTIFIED: No municipalities found!');
      
      // Let's check raw data to see what might be wrong
      console.log('\n4. Investigating raw data...');
      const { data: rawData, error: rawError } = await supabase
        .from('kallikratis')
        .select('*')
        .eq('perifereia', 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ')
        .eq('perifereiaki_enotita', 'ΦΘΙΩΤΙΔΑΣ')
        .limit(5);
      
      if (rawError) {
        console.log('❌ Error fetching raw data:', rawError.message);
      } else {
        console.log('📋 Sample raw data:');
        rawData?.forEach(row => {
          console.log(`   ID: ${row.id}, Municipality: ${row.onoma_neou_ota}, Community: ${row.onoma_dimotikis_enotitas}`);
        });
      }
    }
    
    // 4. Test the exact filtering logic from the form
    console.log('\n5. Testing form filtering logic...');
    const { data: formFilterData, error: formError } = await supabase
      .from('kallikratis')
      .select('*');
    
    if (formError) {
      console.log('❌ Error fetching all kallikratis data:', formError.message);
      return;
    }
    
    // Apply the same filter as in the form
    const filteredData = formFilterData?.filter(k => 
      k.perifereia === 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ' &&
      k.perifereiaki_enotita === 'ΦΘΙΩΤΙΔΑΣ'
    );
    
    const uniqueMunicipalities = Array.from(new Set(
      filteredData?.map(k => k.onoma_neou_ota).filter(Boolean)
    ));
    
    console.log(`📊 Form logic would show ${uniqueMunicipalities.length} municipalities:`);
    uniqueMunicipalities.forEach(m => console.log(`   - ${m}`));
    
    // 5. Check for potential data quality issues
    console.log('\n6. Checking for data quality issues...');
    const { data: allPhthiotida, error: allError } = await supabase
      .from('kallikratis')
      .select('perifereia, perifereiaki_enotita, onoma_neou_ota')
      .ilike('perifereiaki_enotita', '%ΦΘΙΩΤ%')
      .limit(10);
    
    if (allError) {
      console.log('❌ Error in data quality check:', allError.message);
    } else {
      console.log('📋 Records containing "ΦΘΙΩΤ":');
      allPhthiotida?.forEach(row => {
        console.log(`   Region: ${row.perifereia}, Unit: ${row.perifereiaki_enotita}, Municipality: ${row.onoma_neou_ota}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error.message);
  }
}

debugKallikratisFiltering();