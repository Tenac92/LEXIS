import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_KEY must be set in environment variables",
  );
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Export for schema type usage
export const db = supabase;