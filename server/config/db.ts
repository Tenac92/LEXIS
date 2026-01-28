/**
 * Database Configuration
 * Sets up the Supabase client
 */
import { createClient } from '@supabase/supabase-js';

// Resolve Supabase credentials from env or DATABASE_URL to avoid startup crashes
function resolveSupabaseCreds() {
  let url = process.env.SUPABASE_URL || '';
  let key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if ((!url || !key) && process.env.DATABASE_URL) {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      const urlPattern = /postgresql:\/\/postgres:(.+)@db\.(.+)\.supabase\.co/;
      const matches = databaseUrl.match(urlPattern);
      if (matches && matches.length >= 3) {
        key = matches[1];
        const projectRef = matches[2];
        url = `https://${projectRef}.supabase.co`;
      }
    } catch {
      // Ignore and fall back to placeholder
    }
  }

  // As a last resort, use placeholders to prevent import-time crash; runtime checks will handle failures
  if (!url) url = 'https://placeholder.supabase.co';
  if (!key) key = 'invalid-key';

  return { url, key };
}

const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseCreds();

// Create Supabase client with configuration options
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Track last time we created a new client
let lastClientCreation = new Date();

// Track connection status
const connectionStatus = {
  isConnected: true,
  lastCheck: new Date(),
  failureCount: 0,
  totalFailures: 0,
  lastSuccessfulCheck: new Date()
};

// Mark connection as failed (used by error handler)
export function markFailedConnection() {
  connectionStatus.isConnected = false;
  connectionStatus.failureCount += 1;
  connectionStatus.totalFailures += 1;
  connectionStatus.lastCheck = new Date();
  console.warn(`[DB] Connection marked as failed. Failure count: ${connectionStatus.failureCount}`);
}

// Mark connection as successful
export function markSuccessfulConnection() {
  connectionStatus.isConnected = true;
  connectionStatus.failureCount = 0;
  connectionStatus.lastCheck = new Date();
  connectionStatus.lastSuccessfulCheck = new Date();
  console.log('[DB] Connection marked as successful');
}

// Test connection with retry mechanism
export async function testConnection(retries = 3, interval = 5000): Promise<boolean> {
  try {
    console.log(`[DB] Testing database connection (${retries} retries left)...`);
    
    const isConnected = await checkConnection();
    connectionStatus.lastCheck = new Date();
    
    if (isConnected) {
      markSuccessfulConnection();
      console.log('[DB] Connection test successful');
      return true;
    }
    
    // If we have retries left, try again after interval
    if (retries > 0) {
      console.log(`[DB] Connection test failed. Retrying in ${interval}ms...`);
      await new Promise(resolve => setTimeout(resolve, interval));
      return testConnection(retries - 1, interval);
    }
    
    // No retries left, mark as failed
    markFailedConnection();
    return false;
  } catch (error) {
    console.error('[DB] Connection test error:', error);
    
    // If we have retries left, try again after interval
    if (retries > 0) {
      console.log(`[DB] Connection test error. Retrying in ${interval}ms...`);
      await new Promise(resolve => setTimeout(resolve, interval));
      return testConnection(retries - 1, interval);
    }
    
    // No retries left, mark as failed
    markFailedConnection();
    return false;
  }
}

// Export a function to check the database connection
export async function checkConnection() {
  try {
    // Try a simpler query that doesn't rely on specific columns
    // First attempt with a more basic query that should work regardless of schema
    const { data, error } = await supabase.from('Projects').select('*').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      
      // If we got a column error, try a different approach
      if (error.code === '42703') {
        try {
          // Second attempt - try getting the primary key of a different table
          const { data: userData, error: userError } = await supabase.from('users').select('id').limit(1);
          
          if (userError) {
            console.error('Secondary connection check failed:', userError);
            return false;
          }
          
          return true;
        } catch (secondaryError) {
          console.error('Secondary connection check exception:', secondaryError);
          return false;
        }
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
}

/**
 * Reset connection pool if needed
 * This function creates a new Supabase client if there have been connection issues
 * or if it's been a while since the last reset
 */
export function resetConnectionPoolIfNeeded(): boolean {
  const now = new Date();
  const timeSinceCreation = now.getTime() - lastClientCreation.getTime();
  const hoursSinceCreation = timeSinceCreation / (1000 * 60 * 60);
  
  // Reset if we have consecutive failures or it's been a long time since we created a client
  if (connectionStatus.failureCount >= 3 || hoursSinceCreation > 12) {
    try {
      // Create a new Supabase client to reset connections
      // We're just reassigning the module-level variable, not modifying imports
      console.log(`[DB] Resetting Supabase connection pool. Reason: ${
        connectionStatus.failureCount >= 3 ? 'Multiple failures' : 'Regular maintenance'
      }`);
      
      // We don't actually have a direct way to reset the pool in Supabase JS client
      // But we can create a new client instance with the same parameters
      const newClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false
        }
      });
      
      // This is a hack, but it works - replace the client
      Object.keys(newClient).forEach(key => {
        // @ts-ignore
        if (newClient[key] && typeof newClient[key] === 'object') {
          // @ts-ignore
          supabase[key] = newClient[key];
        }
      });
      
      // Update metadata
      lastClientCreation = now;
      connectionStatus.failureCount = 0;
      
      console.log('[DB] Supabase connection pool reset successful');
      return true;
    } catch (error) {
      console.error('[DB] Failed to reset Supabase connection pool:', error);
      return false;
    }
  }
  
  return false;
}