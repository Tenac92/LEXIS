import { Router } from 'express';
import { supabase } from '../config/db';
import type { Database } from '@shared/schema';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;
    let query = supabase.from('generated_documents').select('*');

    // Filter by user's role
    if (req.user?.role !== 'admin') {
      query = query.eq('generated_by', req.user?.id);
    }

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

    // User/Recipient filter with proper text search
    if (user) {
      const searchTerm = (user as string).toLowerCase().trim();
      if (searchTerm) {
        query = query.or(`recipients.cs.[{"lastname":"${searchTerm}"}],recipients.cs.[{"afm":"${searchTerm}"}]`);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .insert({
        ...req.body,
        generated_by: req.user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_by: req.user?.id,
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
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

export default router;