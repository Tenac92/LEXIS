/**
 * Reset user password script
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function resetPassword() {
  try {
    const email = 'napostolou@civilprotection.gr';
    const newPassword = 'admin123';
    
    console.log(`Resetting password for: ${email}`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email)
      .select();
    
    if (error) {
      console.error('Error updating password:', error);
      return;
    }
    
    console.log('Password reset successful!');
    console.log(`Email: ${email}`);
    console.log(`New password: ${newPassword}`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetPassword();