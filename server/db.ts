import { supabase } from './config/db';
import type { Database } from '@shared/schema';

// Log non-sensitive connection info
console.log('[Database] Initializing Supabase client');

// Export the database instance
export { supabase };