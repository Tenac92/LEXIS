import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_KEY must be set in environment variables",
  );
}

// Log non-sensitive connection info
console.log('[Database] Initializing Supabase client with URL:', process.env.SUPABASE_URL);

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Test the connection and verify tables on startup
async function testConnection() {
  try {
    console.log('[Database] Testing connection...');

    // Test users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true });

    if (usersError) {
      console.error('[Database] Users table test failed:', usersError.message);
    } else {
      console.log('[Database] Users table accessible, count:', users);
    }

    // Test notifications table
    const { data: notifications, error: notificationsError } = await supabase
      .from('budget_notifications')
      .select('count(*)', { count: 'exact', head: true });

    if (notificationsError) {
      console.error('[Database] Notifications table test failed:', notificationsError.message);
    } else {
      console.log('[Database] Notifications table accessible, count:', notifications);
    }

  } catch (err) {
    console.error('[Database] Connection test failed:', err);
  }
}

// Run the connection test
testConnection();

export const db = supabase;