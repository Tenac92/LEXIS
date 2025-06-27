/**
 * Check Projects Table Structure
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProjectsStructure() {
  try {
    const { data, error } = await supabase
      .from('Projects')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error:', error.message);
    } else if (data && data.length > 0) {
      console.log('Projects table columns:');
      console.log(JSON.stringify(Object.keys(data[0]), null, 2));
      console.log('\nSample data:');
      console.log(JSON.stringify(data[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkProjectsStructure();