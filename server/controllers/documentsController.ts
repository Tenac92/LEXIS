
import { Router } from 'express';
import { supabase } from '../config/db';
import { documents } from '@shared/schema';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*');
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', parseInt(req.params.id))
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

router.post('/', async (req, res) => {
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

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(req.params.id))
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
