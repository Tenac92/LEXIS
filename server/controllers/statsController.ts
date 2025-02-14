import { Router } from 'express';
import { db } from '../db';
import { documents } from '@shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/dashboard', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_documents,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_documents,
        COALESCE(SUM(total_amount::numeric), 0) as total_amount
      FROM ${documents}
      WHERE created_by = ${req.user!.id}
    `);

    res.json(result.rows[0] || {
      total_documents: 0,
      pending_documents: 0,
      completed_documents: 0,
      total_amount: 0
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);

    const data = await db.select({
      created_at: documents.created_at,
      status: documents.status,
      total_amount: documents.total_amount
    })
    .from(documents)
    .where(sql`created_at >= ${startDate.toISOString()}`);

    const monthlyStats: Record<string, { total: number; completed: number; amount: number }> = {};
    
    data.forEach(doc => {
      const month = doc.created_at!.toISOString().substring(0, 7);
      if (!monthlyStats[month]) {
        monthlyStats[month] = {
          total: 0,
          completed: 0,
          amount: 0
        };
      }
      monthlyStats[month].total++;
      if (doc.status === 'completed') monthlyStats[month].completed++;
      monthlyStats[month].amount += Number(doc.total_amount) || 0;
    });

    res.json(monthlyStats);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch monthly statistics' });
  }
});

export default router;
