import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';
import * as dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
}

console.log('[Supabase] Initializing client...');

// Create Supabase client with proper typing
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Simple connection test
supabase.from('generated_documents')
  .select('id, unit, status')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('[Supabase] Initial connection test failed:', error.message);
    } else {
      console.log('[Supabase] Initial connection test successful:', {
        count: data?.length || 0,
        sample: data?.[0] ? { id: data[0].id, unit: data[0].unit } : null
      });
    }
  })
  .catch(err => {
    console.error('[Supabase] Connection test error:', err);
  });

export default supabase;