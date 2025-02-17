
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
