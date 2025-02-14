import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.created_at);

    res.json(allUsers);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const [user] = await db
      .update(users)
      .set({
        ...req.body,
        updated_at: new Date(),
      })
      .where(eq(users.id, parseInt(req.params.id)))
      .returning();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

export default router;
