import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug environment variables (without exposing values)
console.log('[Supabase] Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlType: typeof supabaseUrl,
  keyType: typeof supabaseKey
});

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'supabase.auth.token',
  }
});

// Debug auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[Supabase] Auth state changed:', event);
  if (session) {
    console.log('[Supabase] User authenticated:', session.user.id);
  } else {
    console.log('[Supabase] No active session');
  }
});

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('[Supabase] Initial auth state:', session ? 'Authenticated' : 'Not authenticated');
});