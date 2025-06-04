/**
 * Test Beneficiary Creation Script
 * Tests if beneficiaries are being saved properly during document creation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBeneficiaryCreation() {
  console.log('Testing beneficiary system...');
  
  try {
    // Test 1: Check if beneficiaries table exists and has data
    console.log('\n1. Checking beneficiaries table...');
    const { data: beneficiaries, error: benefError } = await supabase
      .from('beneficiaries')
      .select('*')
      .limit(5);
      
    if (benefError) {
      console.error('Error accessing beneficiaries table:', benefError);
      return false;
    }
    
    console.log(`✓ Found ${beneficiaries?.length || 0} beneficiaries in database`);
    if (beneficiaries && beneficiaries.length > 0) {
      console.log('Sample beneficiary:', beneficiaries[0]);
    }
    
    // Test 2: Check if beneficiary_payments table exists and has data
    console.log('\n2. Checking beneficiary_payments table...');
    const { data: payments, error: paymentError } = await supabase
      .from('beneficiary_payments')
      .select('*')
      .limit(5);
      
    if (paymentError) {
      console.error('Error accessing beneficiary_payments table:', paymentError);
      return false;
    }
    
    console.log(`✓ Found ${payments?.length || 0} payment records in database`);
    if (payments && payments.length > 0) {
      console.log('Sample payment:', payments[0]);
    }
    
    // Test 3: Create a test beneficiary to verify the save functionality
    console.log('\n3. Testing beneficiary creation...');
    const testBeneficiary = {
      afm: '999888777',
      surname: 'ΤΕΣΤ',
      name: 'ΔΟΚΙΜΗ',
      fathername: 'ΠΑΤΡΟΣ',
      region: 'ΑΤΤΙΚΗ',
      date: new Date().toISOString().split('T')[0]
    };
    
    const { data: newBeneficiary, error: createError } = await supabase
      .from('beneficiaries')
      .insert(testBeneficiary)
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating test beneficiary:', createError);
      return false;
    }
    
    console.log('✓ Successfully created test beneficiary:', newBeneficiary);
    
    // Clean up the test beneficiary
    const { error: deleteError } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', newBeneficiary.id);
      
    if (deleteError) {
      console.warn('Warning: Could not clean up test beneficiary:', deleteError);
    } else {
      console.log('✓ Test beneficiary cleaned up');
    }
    
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

// Run the test
testBeneficiaryCreation()
  .then(success => {
    if (success) {
      console.log('\n✅ All beneficiary tests passed!');
    } else {
      console.log('\n❌ Some tests failed');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });