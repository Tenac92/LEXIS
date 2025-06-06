/**
 * Database setup utility for budget notifications
 * Creates the notifications table if it doesn't exist and populates with test data
 */

import { supabase } from '../config/db';
import { log } from '../vite';

export async function ensureNotificationsTableExists(): Promise<boolean> {
  try {
    log('[NotificationsTable] Checking if budget_notifications table exists...', 'info');

    // Try to create the table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS budget_notifications (
        id SERIAL PRIMARY KEY,
        project_id INTEGER,
        mis INTEGER,
        type TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        current_budget DECIMAL(12,2),
        ethsia_pistosi DECIMAL(12,2),
        reason TEXT,
        status TEXT DEFAULT 'pending',
        user_id INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      );
    `;

    // Execute the SQL using a direct query
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });

    if (createError) {
      log(`[NotificationsTable] Error creating table: ${createError.message}`, 'error');
      return false;
    }

    log('[NotificationsTable] Budget notifications table ensured to exist', 'info');
    return true;

  } catch (error) {
    log(`[NotificationsTable] Error ensuring table exists: ${error}`, 'error');
    return false;
  }
}

export async function createTestNotificationsDirect(): Promise<boolean> {
  try {
    log('[NotificationsTable] Creating test notifications directly...', 'info');

    // Sample reallocation notification
    const { error: error1 } = await supabase
      .from('budget_notifications')
      .insert({
        project_id: 1,
        mis: 5174692,
        type: 'reallocation',
        amount: 1500.00,
        current_budget: 4489.00,
        ethsia_pistosi: 5000.00,
        reason: 'Απαιτείται ανακατανομή: Το ποσό 1,500€ υπερβαίνει το 20% της ετήσιας κατανομής (1,000€)',
        status: 'pending',
        user_id: 49
      });

    // Sample funding notification
    const { error: error2 } = await supabase
      .from('budget_notifications')
      .insert({
        project_id: 2,
        mis: 5174693,
        type: 'funding',
        amount: 12000.00,
        current_budget: 8000.00,
        ethsia_pistosi: 10000.00,
        reason: 'Απαιτείται χρηματοδότηση: Το ποσό 12,000€ υπερβαίνει την ετήσια πίστωση 10,000€',
        status: 'pending',
        user_id: 49
      });

    // Sample quarter exceeded notification
    const { error: error3 } = await supabase
      .from('budget_notifications')
      .insert({
        project_id: 3,
        mis: 5174694,
        type: 'quarter_exceeded',
        amount: 3000.00,
        current_budget: 2500.00,
        ethsia_pistosi: 8000.00,
        reason: 'Το ποσό 3,000€ υπερβαίνει το διαθέσιμο ποσό τριμήνου 2,500€',
        status: 'pending',
        user_id: 49
      });

    if (error1 || error2 || error3) {
      const errors = [error1, error2, error3].filter(Boolean);
      log(`[NotificationsTable] Errors creating test notifications: ${errors.map(e => e?.message).join(', ')}`, 'error');
      return false;
    }

    log('[NotificationsTable] Test notifications created successfully', 'info');
    return true;

  } catch (error) {
    log(`[NotificationsTable] Error creating test notifications: ${error}`, 'error');
    return false;
  }
}