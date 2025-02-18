import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Remove Neon-specific configurations and use Supabase only
export const pool = {
  query: async (text: string, params?: any[]) => {
    const { data, error } = await supabase.from(text).select('*');
    if (error) throw error;
    return { rows: data };
  }
};

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_KEY must be set.",
  );
}