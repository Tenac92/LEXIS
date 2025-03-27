import { Router, Request, Response } from 'express';
import { supabase } from '../config/db';
import type { User } from '@shared/schema.unified';

interface AuthRequest extends Request {
  user?: User;
}

export const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { unit, status = 'pending', project_id } = req.query;
    let query = supabase.from('recipients').select('*');

    if (status) {
      query = query.eq('status', status as string);
    }

    if (unit) {
      query = query.eq('unit', unit as string);
    }

    if (project_id) {
      query = query.eq('project_id', project_id as string);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch recipients' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('recipients')
      .insert({
        ...req.body,
        created_by: req.user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create recipient' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('recipients')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to update recipient' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('recipients')
      .delete()
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to delete recipient' });
  }
});