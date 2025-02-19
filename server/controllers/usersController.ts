import { Router } from 'express';
import { supabase } from '../db';
import { authenticateSession } from '../auth';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    name: string | null;
    unit: string | null;
  };
}

const router = Router();

// Get all units
router.get('/units', authenticateSession, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Units] Fetching units from unit_det table');
    const { data: units, error } = await supabase
      .from('unit_det')
      .select('implementing_agency');

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    console.log('[Units] Raw units data:', units);

    // Extract unique unit names from implementing_agency field
    const uniqueUnits = new Set<string>();
    units?.forEach(unit => {
      if (!unit.implementing_agency) return;

      try {
        const agency = unit.implementing_agency;
        if (typeof agency === 'string') {
          uniqueUnits.add(agency);
        } else if (Array.isArray(agency)) {
          agency.forEach(a => typeof a === 'string' && uniqueUnits.add(a));
        } else if (typeof agency === 'object' && agency !== null) {
          Object.values(agency).forEach(value => {
            if (typeof value === 'string') uniqueUnits.add(value);
          });
        }
      } catch (err) {
        console.error('[Units] Error processing unit:', unit, err);
      }
    });

    const unitsList = Array.from(uniqueUnits).sort();
    console.log('[Units] Processed units list:', unitsList);
    res.json(unitsList);
  } catch (error) {
    console.error('[Units] Units fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch units', error: error.message });
  }
});

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
        unit,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Users] Users fetch error:', error);
      throw error;
    }

    console.log('[Users] Successfully fetched users:', users?.length);
    res.json(users);
  } catch (error) {
    console.error('[Users] Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
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
        unit: req.body.unit,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newUser);
  } catch (error) {
    console.error('[Users] User creation error:', error);
    res.status(500).json({ message: error.message || 'Failed to create user' });
  }
});

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
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;