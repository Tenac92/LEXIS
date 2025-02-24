import { Router } from 'express';
import { supabase } from '../db';
import { authenticateSession } from '../auth';
import { Request, Response } from 'express';
import type { User } from '@shared/schema';
import bcrypt from 'bcrypt';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const router = Router();

// Get parts for selected units
router.get('/units/parts', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { units } = req.query;
    
    if (!units) {
      return res.status(400).json({ message: 'Units parameter is required' });
    }

    const unitsList = Array.isArray(units) ? units : [units];

    const { data, error } = await supabase
      .from('unit_det')
      .select('parts')
      .in('unit_name', unitsList);

    if (error) {
      console.error('[Units] Error fetching parts:', error);
      throw error;
    }

    // Combine all parts from selected units
    const allParts = data?.reduce((acc: string[], unit) => {
      if (unit.parts && Array.isArray(unit.parts)) {
        return [...acc, ...unit.parts];
      }
      return acc;
    }, []);

    // Remove duplicates
    const uniqueParts = [...new Set(allParts)];

    res.json(uniqueParts.sort());
  } catch (error) {
    console.error('[Units] Error fetching unit parts:', error);
    res.status(500).json({ 
      message: 'Failed to fetch unit parts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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

// Get parts for a specific unit
router.get('/units/:unitName/parts', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { unitName } = req.params;

    console.log('[Units] Fetching parts for unit:', unitName);
    const { data: unitData, error } = await supabase
      .from('unit_det')
      .select('parts')
      .eq('unit_name', unitName)
      .single();

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    const parts = unitData?.parts || [];
    console.log('[Units] Found parts:', parts);
    res.json(parts);
  } catch (error) {
    console.error('[Units] Parts fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch parts', 
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
      .select('id, email, name, role, units, telephone, department')
      .order('id');

    if (error) {
      console.error('[Users] Supabase query error:', error);
      throw error;
    }

    console.log('[Users] Successfully fetched users:', users?.length || 0);
    res.json(users || []);
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

    if (!req.body.email || !req.body.name || !req.body.password || !req.body.role || !req.body.unit || !req.body.department) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          email: !req.body.email ? 'Email is required' : null,
          name: !req.body.name ? 'Name is required' : null,
          password: !req.body.password ? 'Password is required' : null,
          role: !req.body.role ? 'Role is required' : null,
          unit: !req.body.unit ? 'Unit is required' : null,
          department: !req.body.department ? 'Department is required' : null
        }
      });
    }

    // Verify that the unit exists and get its parts
    const { data: unitData, error: unitError } = await supabase
      .from('unit_det')
      .select('parts')
      .eq('unit_name', req.body.unit)
      .single();

    if (unitError || !unitData) {
      console.error('[Users] Invalid unit:', req.body.unit, unitError);
      return res.status(400).json({ 
        message: 'Invalid unit selected',
        error: unitError?.message 
      });
    }

    // Verify that the department is one of the parts
    if (!Array.isArray(unitData.parts) || !unitData.parts.includes(req.body.department)) {
      console.error('[Users] Invalid department:', req.body.department, 'Available parts:', unitData.parts);
      return res.status(400).json({ 
        message: 'Selected department is not valid for this unit',
        validDepartments: unitData.parts 
      });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', req.body.email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    const newUserData = {
      email: req.body.email,
      name: req.body.name,
      role: req.body.role,
      password: hashedPassword,
      unit: req.body.unit,
      department: req.body.department,
      telephone: req.body.telephone || null
    };

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([newUserData])
      .select('id, email, name, role, unit, department, telephone')
      .single();

    if (error) {
      console.error('[Users] User creation error:', error);
      throw error;
    }

    if (!newUser) {
      throw new Error('Failed to create user - no data returned');
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

    if (error) {
      throw error;
    }

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