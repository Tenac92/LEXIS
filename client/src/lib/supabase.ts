import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('[Supabase] Initializing client...');

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-client-info': 'supabase-js' }
  }
});

// Add debug helper
export async function debugSupabaseConnection() {
  try {
    console.log('[Supabase] Testing connection...');
    const { data, error } = await supabase
      .from('generated_documents')
      .select('id, unit, status')
      .limit(1);

    if (error) {
      console.error('[Supabase] Connection error:', error);
      return false;
    }

    console.log('[Supabase] Connection successful, found records:', {
      count: data?.length || 0,
      sample: data?.[0] ? { id: data[0].id, unit: data[0].unit } : null
    });
    return true;
  } catch (err) {
    console.error('[Supabase] Connection test failed:', err);
    return false;
  }
}

// Test connection on init
debugSupabaseConnection().then(success => {
  console.log('[Supabase] Initial connection test:', success ? 'successful' : 'failed');
});