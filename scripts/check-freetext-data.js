import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFreetextData() {
  console.log('Checking freetext data in beneficiary_payments...\n');
  
  // Get all unique freetext values with counts
  const { data, error } = await supabase
    .from('beneficiary_payments')
    .select('freetext')
    .not('freetext', 'is', null);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Group and count
  const counts = {};
  const epsPattern = /^\d{7}$/;
  let totalRecords = 0;
  let validEpsCount = 0;
  let nonEpsCount = 0;
  
  data.forEach(row => {
    const value = row.freetext?.trim() || '';
    if (value) {
      counts[value] = (counts[value] || 0) + 1;
      totalRecords++;
      
      if (epsPattern.test(value)) {
        validEpsCount++;
      } else {
        nonEpsCount++;
      }
    }
  });
  
  console.log(`Total non-null freetext records: ${totalRecords}`);
  console.log(`Valid 7-digit EPS values: ${validEpsCount}`);
  console.log(`Non-EPS values (notes/text): ${nonEpsCount}\n`);
  
  if (nonEpsCount > 0) {
    console.log('Sample non-EPS freetext values:');
    const nonEpsValues = Object.entries(counts)
      .filter(([value]) => !epsPattern.test(value))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    nonEpsValues.forEach(([value, count]) => {
      console.log(`  "${value}" (${count} records)`);
    });
  }
  
  console.log('\nTop 10 most common freetext values:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([value, count]) => {
      const isEps = epsPattern.test(value) ? '[EPS]' : '[TEXT]';
      console.log(`  ${isEps} "${value}" (${count} records)`);
    });
}

checkFreetextData().catch(console.error);
