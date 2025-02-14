import { Router } from 'express';
import { db } from '../db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const docs = await db.select().from(documents);
    res.json(docs);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(req.params.id)));

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(doc);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [doc] = await db
      .insert(documents)
      .values({
        ...req.body,
        created_by: req.user.id,
        created_at: new Date(),
      })
      .returning();

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const [doc] = await db
      .update(documents)
      .set({
        ...req.body,
        updated_at: new Date(),
      })
      .where(eq(documents.id, parseInt(req.params.id)))
      .returning();

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(doc);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

export default router;
