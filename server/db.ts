import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Verify database connection using a simpler query
console.log('[Database] Initializing Supabase connection...');
supabase
  .from('Projects')
  .select('mis')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('[Database] Connection error:', error);
      throw error;
    }
    console.log('[Database] Successfully connected to Supabase');
  })
  .catch(error => {
    console.error('[Database] Failed to connect to Supabase:', error);
    throw error; // Let the error propagate to be handled by the global error handler
  });