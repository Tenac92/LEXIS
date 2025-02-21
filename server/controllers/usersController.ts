import { Router } from 'express';
import { supabase } from '../db';
import { authenticateSession } from '../auth';
import { Request, Response } from 'express';
import type { User } from '@shared/schema';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = Router();

// Get all units
router.get('/units', authenticateSession, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Units] Fetching units from unit_det table');
    const { data: units, error } = await supabase
      .from('unit_det')
      .select('unit_name');

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    // Extract unique unit names
    const uniqueUnits = new Set<string>();
    units?.forEach(unit => {
      if (unit.unit_name && typeof unit.unit_name === 'string') {
        uniqueUnits.add(unit.unit_name);
      }
    });

    const unitsList = Array.from(uniqueUnits).sort();
    res.json(unitsList);
  } catch (error) {
    console.error('[Units] Units fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch units', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get all users
router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('[Users] Fetching users list');
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        units,
        telephone,
        department
      `)
      .order('id');

    if (error) {
      console.error('[Users] Supabase query error:', error);
      throw error;
    }

    console.log('[Users] Successfully fetched users:', users?.length);
    res.json(users);
  } catch (error) {
    console.error('[Users] Users fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch users', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create user
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!req.body.email || !req.body.name || !req.body.password || !req.body.role) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          email: !req.body.email ? 'Email is required' : null,
          name: !req.body.name ? 'Name is required' : null,
          password: !req.body.password ? 'Password is required' : null,
          role: !req.body.role ? 'Role is required' : null
        }
      });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', req.body.email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: req.body.email,
        name: req.body.name,
        role: req.body.role,
        password: req.body.password,
        units: Array.isArray(req.body.units) ? req.body.units : [],
        telephone: req.body.telephone || null,
        department: req.body.department || null
      }])
      .select()
      .single();

    if (error) {
      console.error('[Users] User creation error:', error);
      throw error;
    }

    res.status(201).json(newUser);
  } catch (error) {
    console.error('[Users] User creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create user', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete user
router.delete('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('[Users] User deletion error:', error);
    res.status(500).json({ 
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;