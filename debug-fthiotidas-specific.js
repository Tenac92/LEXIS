/**
 * Debug ΦΘΙΩΤΙΔΑΣ Specific Issue
 * 
 * This script investigates why ΦΘΙΩΤΙΔΑΣ specifically has issues
 * with municipality dropdown population
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
  console.log('SUPABASE_KEY:', supabaseKey ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFthiotidasSpecific() {
  try {
    console.log('🔍 DEBUG ΦΘΙΩΤΙΔΑΣ SPECIFIC ISSUE');
    console.log('=====================================\n');

    // 1. Check exact spelling and characters in ΦΘΙΩΤΙΔΑΣ
    console.log('1. Checking exact spelling of ΦΘΙΩΤΙΔΑΣ...');
    const { data: fthiotidas, error: fthiotidasError } = await supabase
      .from('kallikratis')
      .select('perifereiaki_enotita')
      .ilike('perifereiaki_enotita', '%ΦΘΙΩΤ%');

    if (fthiotidasError) {
      console.error('❌ Error fetching ΦΘΙΩΤΙΔΑΣ:', fthiotidasError);
      return;
    }

    console.log('📋 All entries containing "ΦΘΙΩΤ":');
    const uniqueFthiotidas = [...new Set(fthiotidas.map(f => f.perifereiaki_enotita))];
    uniqueFthiotidas.forEach(f => {
      console.log(`   - "${f}" (length: ${f.length})`);
      // Show character codes to detect any invisible characters
      const charCodes = Array.from(f).map(char => `${char}(${char.charCodeAt(0)})`);
      console.log(`     Character codes: ${charCodes.join(' ')}`);
    });

    // 2. Test exact filtering as the form does
    console.log('\n2. Testing exact filtering as form does...');
    const testRegion = 'ΣΤΕΡΕΑΣ ΕΛΛΑΔΑΣ';
    const testUnit = 'ΦΘΙΩΤΙΔΑΣ';

    console.log(`Looking for: region="${testRegion}", unit="${testUnit}"`);

    const { data: testResults, error: testError } = await supabase
      .from('kallikratis')
      .select('perifereia, perifereiaki_enotita, onoma_neou_ota')
      .eq('perifereia', testRegion)
      .eq('perifereiaki_enotita', testUnit)
      .not('onoma_neou_ota', 'is', null);

    if (testError) {
      console.error('❌ Error in test filtering:', testError);
      return;
    }

    console.log(`📊 Found ${testResults.length} records:`);
    testResults.forEach((record, index) => {
      console.log(`   ${index + 1}. Region: "${record.perifereia}", Unit: "${record.perifereiaki_enotita}", Municipality: "${record.onoma_neou_ota}"`);
    });

    // 3. Check if there are any differences in the data structure
    console.log('\n3. Checking for unique municipalities...');
    const uniqueMunicipalities = [...new Set(testResults.map(r => r.onoma_neou_ota))];
    console.log(`📋 Unique municipalities (${uniqueMunicipalities.length}):`);
    uniqueMunicipalities.forEach((mun, index) => {
      console.log(`   ${index + 1}. "${mun}"`);
    });

    // 4. Compare with a working combination
    console.log('\n4. Comparing with a working combination (ΑΤΤΙΚΗΣ > ΒΟΡΕΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ)...');
    const { data: workingResults, error: workingError } = await supabase
      .from('kallikratis')
      .select('perifereia, perifereiaki_enotita, onoma_neou_ota')
      .eq('perifereia', 'ΑΤΤΙΚΗΣ')
      .eq('perifereiaki_enotita', 'ΒΟΡΕΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ')
      .not('onoma_neou_ota', 'is', null);

    if (workingError) {
      console.error('❌ Error in working test:', workingError);
    } else {
      const workingUnique = [...new Set(workingResults.map(r => r.onoma_neou_ota))];
      console.log(`📊 Working combination has ${workingUnique.length} unique municipalities:`);
      workingUnique.forEach((mun, index) => {
        console.log(`   ${index + 1}. "${mun}"`);
      });
    }

    // 5. Test the exact JavaScript filtering logic used in the form
    console.log('\n5. Testing JavaScript filtering logic...');
    
    // Get all kallikratis data
    const { data: allKallikratis, error: allError } = await supabase
      .from('kallikratis')
      .select('*');

    if (allError) {
      console.error('❌ Error fetching all data:', allError);
      return;
    }

    // Simulate the form filtering logic
    const filteredMunicipalities = Array.from(new Set(
      allKallikratis
        ?.filter(k => {
          const regionMatch = k.perifereia === testRegion;
          const unitMatch = k.perifereiaki_enotita === testUnit;
          const hasName = k.onoma_neou_ota && k.onoma_neou_ota.trim() !== '';
          
          console.log(`   Checking: ${k.onoma_neou_ota || 'NULL'} - Region: ${regionMatch}, Unit: ${unitMatch}, HasName: ${hasName}`);
          
          return regionMatch && unitMatch && hasName;
        })
        .map(k => k.onoma_neou_ota)
        .filter(Boolean)
    ));

    console.log(`📊 JavaScript filtering result: ${filteredMunicipalities.length} municipalities`);
    filteredMunicipalities.forEach((mun, index) => {
      console.log(`   ${index + 1}. "${mun}"`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugFthiotidasSpecific();