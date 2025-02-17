import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

// Get Supabase URL and Key from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials:', {
    url: !!supabaseUrl,
    key: !!supabaseKey
  });
  throw new Error('Missing Supabase credentials. Please check your environment variables.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// Add auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase auth event:', event);
  if (session) {
    console.log('User authenticated:', session.user.id);
  }
});