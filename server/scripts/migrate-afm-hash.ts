import { supabase } from '../config/db';
import { encryptAFM, decryptAFM, hashAFM } from '../utils/crypto';

async function migrateAFMHashes() {
  console.log('Starting AFM hash migration...\n');

  try {
    // Migrate Employees
    console.log('Fetching employees...');
    const { data: employees, error: empError } = await supabase
      .from('Employees')
      .select('id, afm');

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    console.log(`Found ${employees?.length || 0} employees`);

    let employeesUpdated = 0;
    let employeesSkipped = 0;

    for (const employee of employees || []) {
      if (!employee.afm) {
        console.log(`Skipping employee ${employee.id} - no AFM`);
        employeesSkipped++;
        continue;
      }

      try {
        // Try to decrypt first (in case it's already encrypted)
        let plainAfm = decryptAFM(employee.afm);
        
        // If decryption returns null, assume it's plaintext
        if (!plainAfm) {
          plainAfm = employee.afm;
          console.log(`Employee ${employee.id}: Using plaintext AFM`);
        } else {
          console.log(`Employee ${employee.id}: Decrypted AFM successfully`);
        }

        if (!plainAfm) {
          console.log(`Skipping employee ${employee.id} - invalid AFM`);
          employeesSkipped++;
          continue;
        }

        // Generate hash
        const afmHash = hashAFM(plainAfm);

        // Re-encrypt if it was plaintext
        const encryptedAfm = plainAfm === employee.afm ? encryptAFM(plainAfm) : employee.afm;

        // Update record with hash and encrypted AFM
        const { error: updateError } = await supabase
          .from('Employees')
          .update({
            afm: encryptedAfm,
            afm_hash: afmHash
          })
          .eq('id', employee.id);

        if (updateError) {
          console.error(`Error updating employee ${employee.id}:`, updateError);
          continue;
        }

        employeesUpdated++;
        console.log(`✓ Updated employee ${employee.id} with AFM hash`);
      } catch (err) {
        console.error(`Error processing employee ${employee.id}:`, err);
        employeesSkipped++;
      }
    }

    console.log(`\nEmployees: ${employeesUpdated} updated, ${employeesSkipped} skipped\n`);

    // Migrate Beneficiaries
    console.log('Fetching beneficiaries...');
    const { data: beneficiaries, error: benError } = await supabase
      .from('beneficiaries')
      .select('id, afm');

    if (benError) {
      console.error('Error fetching beneficiaries:', benError);
      throw benError;
    }

    console.log(`Found ${beneficiaries?.length || 0} beneficiaries`);

    let beneficiariesUpdated = 0;
    let beneficiariesSkipped = 0;

    for (const beneficiary of beneficiaries || []) {
      if (!beneficiary.afm) {
        console.log(`Skipping beneficiary ${beneficiary.id} - no AFM`);
        beneficiariesSkipped++;
        continue;
      }

      try {
        // Try to decrypt first (in case it's already encrypted)
        let plainAfm = decryptAFM(beneficiary.afm);
        
        // If decryption returns null, assume it's plaintext
        if (!plainAfm) {
          plainAfm = beneficiary.afm;
          console.log(`Beneficiary ${beneficiary.id}: Using plaintext AFM`);
        } else {
          console.log(`Beneficiary ${beneficiary.id}: Decrypted AFM successfully`);
        }

        if (!plainAfm) {
          console.log(`Skipping beneficiary ${beneficiary.id} - invalid AFM`);
          beneficiariesSkipped++;
          continue;
        }

        // Generate hash
        const afmHash = hashAFM(plainAfm);

        // Re-encrypt if it was plaintext
        const encryptedAfm = plainAfm === beneficiary.afm ? encryptAFM(plainAfm) : beneficiary.afm;

        // Update record with hash and encrypted AFM
        const { error: updateError } = await supabase
          .from('beneficiaries')
          .update({
            afm: encryptedAfm,
            afm_hash: afmHash
          })
          .eq('id', beneficiary.id);

        if (updateError) {
          console.error(`Error updating beneficiary ${beneficiary.id}:`, updateError);
          continue;
        }

        beneficiariesUpdated++;
        console.log(`✓ Updated beneficiary ${beneficiary.id} with AFM hash`);
      } catch (err) {
        console.error(`Error processing beneficiary ${beneficiary.id}:`, err);
        beneficiariesSkipped++;
      }
    }

    console.log(`\nBeneficiaries: ${beneficiariesUpdated} updated, ${beneficiariesSkipped} skipped\n`);

    console.log('Migration completed successfully!');
    console.log(`Total: ${employeesUpdated + beneficiariesUpdated} records updated`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateAFMHashes()
  .then(() => {
    console.log('\nDone! You can now apply the uniqueness constraint.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
