/**
 * Beneficiaries Migration Script
 * 
 * This script migrates from the JSONB oikonomika structure to normalized tables:
 * - beneficiaries: Basic beneficiary information
 * - beneficiary_payments: Individual payment records
 */

import { supabase } from '../server/config/db.js';

async function migrateBeneficiaries() {
  console.log('Starting beneficiaries migration to normalized structure...');
  
  try {
    // 1. Create new beneficiaries table (clean structure)
    console.log('Creating new beneficiaries table...');
    const createBeneficiariesTable = `
      CREATE TABLE IF NOT EXISTS beneficiaries (
        id SERIAL PRIMARY KEY,
        afm TEXT NOT NULL UNIQUE,
        surname TEXT NOT NULL,
        name TEXT NOT NULL,
        fathername TEXT,
        region TEXT,
        adeia INTEGER,
        cengsur1 TEXT,
        cengname1 TEXT,
        cengsur2 TEXT,
        cengname2 TEXT,
        onlinefoldernumber TEXT,
        freetext TEXT,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await supabase.rpc('exec_sql', { sql: createBeneficiariesTable });
    console.log('✓ Created beneficiaries table');
    
    // 2. Create beneficiary_payments table
    console.log('Creating beneficiary_payments table...');
    const createPaymentsTable = `
      CREATE TABLE IF NOT EXISTS beneficiary_payments (
        id SERIAL PRIMARY KEY,
        beneficiary_id INTEGER NOT NULL,
        unit_code TEXT NOT NULL,
        na853_code TEXT NOT NULL,
        expenditure_type TEXT NOT NULL,
        installment TEXT NOT NULL,
        amount DECIMAL(12,2),
        status TEXT DEFAULT 'pending',
        protocol_number TEXT,
        payment_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_beneficiary_payments_beneficiary 
          FOREIGN KEY (beneficiary_id) 
          REFERENCES beneficiaries(id) 
          ON DELETE CASCADE,
          
        UNIQUE(beneficiary_id, unit_code, na853_code, expenditure_type, installment)
      );
    `;
    
    await supabase.rpc('exec_sql', { sql: createPaymentsTable });
    console.log('✓ Created beneficiary_payments table');
    
    // 3. Create indexes for performance
    console.log('Creating indexes...');
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_beneficiary_payments_lookup 
        ON beneficiary_payments(beneficiary_id, unit_code, na853_code);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_afm 
        ON beneficiaries(afm);
    `;
    
    await supabase.rpc('exec_sql', { sql: createIndexes });
    console.log('✓ Created indexes');
    
    // 4. Migrate data from legacy Beneficiary table
    console.log('Migrating data from legacy table...');
    
    const { data: legacyBeneficiaries, error: fetchError } = await supabase
      .from('Beneficiary')
      .select('*');
      
    if (fetchError) {
      console.error('Error fetching legacy beneficiaries:', fetchError);
      return;
    }
    
    console.log(`Found ${legacyBeneficiaries.length} legacy beneficiaries to migrate`);
    
    for (const legacy of legacyBeneficiaries) {
      try {
        // Insert basic beneficiary data
        const { data: newBeneficiary, error: insertError } = await supabase
          .from('beneficiaries')
          .insert({
            afm: legacy.afm?.toString() || '',
            surname: legacy.surname || '',
            name: legacy.name || '',
            fathername: legacy.fathername,
            region: legacy.region,
            adeia: legacy.adeia,
            cengsur1: legacy.cengsur1,
            cengname1: legacy.cengname1,
            cengsur2: legacy.cengsur2,
            cengname2: legacy.cengname2,
            onlinefoldernumber: legacy.onlinefoldernumber,
            freetext: legacy.freetext,
            date: legacy.date
          })
          .select()
          .single();
          
        if (insertError) {
          console.warn(`Failed to insert beneficiary ${legacy.afm}:`, insertError.message);
          continue;
        }
        
        // Parse and migrate oikonomika JSONB data
        if (legacy.oikonomika) {
          let oikonomika;
          try {
            oikonomika = typeof legacy.oikonomika === 'string' 
              ? JSON.parse(legacy.oikonomika) 
              : legacy.oikonomika;
          } catch (e) {
            console.warn(`Failed to parse oikonomika for beneficiary ${legacy.afm}`);
            continue;
          }
          
          // Extract payment entries from nested structure
          for (const [unitCode, unitData] of Object.entries(oikonomika)) {
            if (typeof unitData === 'object' && unitData !== null) {
              for (const [na853Code, projectData] of Object.entries(unitData)) {
                if (typeof projectData === 'object' && projectData !== null) {
                  for (const [expenditureType, expenditureData] of Object.entries(projectData)) {
                    if (typeof expenditureData === 'object' && expenditureData !== null) {
                      for (const [installment, paymentData] of Object.entries(expenditureData)) {
                        if (typeof paymentData === 'object' && paymentData !== null) {
                          const paymentEntry = {
                            beneficiary_id: newBeneficiary.id,
                            unit_code: unitCode,
                            na853_code: na853Code,
                            expenditure_type: expenditureType,
                            installment: installment,
                            amount: paymentData.amount ? parseFloat(paymentData.amount.toString().replace(',', '.')) : null,
                            status: paymentData.status || 'pending',
                            protocol_number: paymentData.protocol,
                            payment_date: paymentData.date ? new Date(paymentData.date) : null
                          };
                          
                          const { error: paymentError } = await supabase
                            .from('beneficiary_payments')
                            .insert(paymentEntry);
                            
                          if (paymentError) {
                            console.warn(`Failed to insert payment for beneficiary ${legacy.afm}:`, paymentError.message);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        console.log(`✓ Migrated beneficiary ${legacy.afm}`);
        
      } catch (error) {
        console.error(`Error migrating beneficiary ${legacy.afm}:`, error);
      }
    }
    
    console.log('Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update application code to use new tables');
    console.log('2. Test the new structure thoroughly');
    console.log('3. Once verified, you can drop the legacy Beneficiary table');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateBeneficiaries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateBeneficiaries };