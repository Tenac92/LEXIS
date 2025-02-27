import { supabase } from '../config/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function updatePassword() {
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('username', 'test@test.gr');

  if (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }

  console.log('Password updated successfully');
  process.exit(0);
}

updatePassword().catch(console.error);