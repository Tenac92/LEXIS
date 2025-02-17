
import { Router } from 'express';
import { supabase } from '../config/db';
import type { Database } from '@shared/schema';

const router = Router();

router.get('/dashboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('status, total_amount')
      .eq('created_by', req.user!.id);

    if (error) throw error;

    const stats = {
      total_documents: data.length,
      pending_documents: data.filter(doc => doc.status === 'pending').length,
      completed_documents: data.filter(doc => doc.status === 'completed').length,
      total_amount: data.reduce((sum, doc) => sum + (Number(doc.total_amount) || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);

    const { data, error } = await supabase
      .from('documents')
      .select('created_at, status, total_amount')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const monthlyStats: Record<string, { total: number; completed: number; amount: number }> = {};
    
    data.forEach(doc => {
      const month = doc.created_at.substring(0, 7);
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
