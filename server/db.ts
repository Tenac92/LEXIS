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
let connectionTimeout: NodeJS.Timeout;

try {
  connectionTimeout = setTimeout(() => {
    console.error('[Database] Connection timeout after 10 seconds');
    throw new Error('Database connection timeout');
  }, 10000);

  supabase
    .from('Projects')
    .select('mis')
    .limit(1)
    .then(({ data, error }) => {
      clearTimeout(connectionTimeout);
      if (error) {
        console.error('[Database] Connection error:', error);
        throw error;
      }
      console.log('[Database] Successfully connected to Supabase');
      if (data?.length) {
        console.log('[Database] Sample project found:', data[0].mis);
      } else {
        console.log('[Database] No projects found in initial check');
      }
    })
    .catch(error => {
      clearTimeout(connectionTimeout);
      console.error('[Database] Failed to connect to Supabase:', error);
      throw error; // Let the error propagate to be handled by the global error handler
    });
} catch (error) {
  clearTimeout(connectionTimeout);
  console.error('[Database] Critical error during connection setup:', error);
  throw error;
}