
import { db } from '../config/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function updatePassword() {
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 10);
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.username, 'test@test.gr'));
    
  console.log('Password updated successfully');
  process.exit(0);
}

updatePassword().catch(console.error);
