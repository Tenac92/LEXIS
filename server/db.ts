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

    // Test basic connection
    const { data: tableList, error: connectionError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (connectionError) {
      console.error('[Database] Connection error:', connectionError.message);
      console.error('[Database] Error details:', {
        code: connectionError.code,
        details: connectionError.details,
        hint: connectionError.hint
      });
      return;
    }

    // Test users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error('[Database] Users table test failed:', usersError.message);
      console.error('[Database] Users error details:', {
        code: usersError.code,
        details: usersError.details,
        hint: usersError.hint
      });
    } else {
      console.log('[Database] Users table accessible, count:', users?.length);
    }

    // Test notifications table
    const { data: notifications, error: notificationsError } = await supabase
      .from('budget_notifications')
      .select('*');

    if (notificationsError) {
      console.error('[Database] Notifications table test failed:', notificationsError.message);
      console.error('[Database] Notifications error details:', {
        code: notificationsError.code,
        details: notificationsError.details,
        hint: notificationsError.hint
      });
    } else {
      console.log('[Database] Notifications table accessible, count:', notifications?.length);
    }

  } catch (err) {
    console.error('[Database] Connection test failed:', err);
  }
}

// Run the connection test
testConnection();

export const db = supabase;