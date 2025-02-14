import { Router } from 'express';
import { db } from '../db';
import { recipients } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { unit, status = 'pending', project_id } = req.query;
    let query = db.select().from(recipients);

    if (status) {
      query = query.where(eq(recipients.status, status as string));
    }

    if (unit) {
      query = query.where(eq(recipients.unit, unit as string));
    }

    if (project_id) {
      query = query.where(eq(recipients.project_id, project_id as string));
    }

    const data = await query;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch recipients' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [recipient] = await db
      .insert(recipients)
      .values({
        ...req.body,
        created_by: req.user.id,
        created_at: new Date(),
      })
      .returning();

    res.status(201).json(recipient);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create recipient' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const [recipient] = await db
      .update(recipients)
      .set({
        ...req.body,
        updated_at: new Date(),
      })
      .where(eq(recipients.id, parseInt(req.params.id)))
      .returning();

    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    res.json(recipient);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to update recipient' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [recipient] = await db
      .delete(recipients)
      .where(eq(recipients.id, parseInt(req.params.id)))
      .returning();

    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to delete recipient' });
  }
});

export default router;
