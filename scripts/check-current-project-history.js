/**
 * Check Current Project History Table Structure
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkCurrentStructure() {
  console.log('Checking current project_history table structure...\n');
  
  try {
    // Get current data
    const { data: currentData, error: dataError } = await supabase
      .from('project_history')
      .select('*')
      .limit(3);
      
    if (dataError) {
      console.error('Error fetching project_history data:', dataError);
      return;
    }
    
    console.log(`Found ${currentData?.length || 0} entries in project_history table`);
    
    if (currentData && currentData.length > 0) {
      console.log('\nCurrent structure sample:');
      const sample = currentData[0];
      console.log('Available columns:', Object.keys(sample));
      console.log('\nSample entry:');
      console.log(JSON.stringify(sample, null, 2));
      
      // Check if it's already linear or still JSONB
      if (sample.project_title) {
        console.log('\n✅ Table appears to have linear structure already');
      } else if (sample.data) {
        console.log('\n❌ Table still uses JSONB structure (data column)');
      } else {
        console.log('\n❓ Table structure is unclear');
      }
    } else {
      console.log('\nNo data found in project_history table');
    }
    
  } catch (error) {
    console.error('Error checking table structure:', error);
  }
}

checkCurrentStructure();