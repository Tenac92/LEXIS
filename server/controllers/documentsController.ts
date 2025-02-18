import { Router } from 'express';
import { supabase } from '../config/db';
import { documents, type Document } from '@shared/schema';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user, recipient, afm } = req.query;
    let query = supabase.from('documents').select(`
      *,
      creator:created_by(name, email)
    `);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (amountFrom) {
      query = query.gte('total_amount', amountFrom);
    }
    if (amountTo) {
      query = query.lte('total_amount', amountTo);
    }

    // Add recipient and AFM filters if provided
    if (recipient) {
      query = query.ilike('title', `%${recipient}%`);
    }
    if (afm) {
      query = query.eq('afm', afm);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        creator:created_by(name, email)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        ...req.body,
        created_by: req.user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

export default router;