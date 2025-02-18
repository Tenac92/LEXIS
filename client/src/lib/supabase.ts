import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

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
export async function debugAuthState() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('Current session:', session, 'Session error:', sessionError);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', user, 'User error:', userError);
}