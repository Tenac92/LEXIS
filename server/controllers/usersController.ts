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

    const { email, name, password, role, units, department, telephone } = req.body;

    // Validate required fields
    const requiredFields = { email, name, password, role, units, department };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: missingFields.reduce((acc, field) => ({
          ...acc,
          [field]: `${field} is required`
        }), {})
      });
    }

    // Verify units exist
    console.log('[Users] Verifying units:', units);
    const { data: unitData, error: unitError } = await supabase
      .from('unit_det')
      .select('unit_name, parts')
      .in('unit_name', units);

    if (unitError || !unitData || unitData.length !== units.length) {
      console.error('[Users] Invalid units:', units, unitError);
      return res.status(400).json({
        message: 'One or more invalid units selected',
        error: unitError?.message
      });
    }

    // Verify department exists in units' parts
    const allParts = Array.from(new Set(
      unitData.flatMap(unit => unit.parts || [])
    ));

    if (!allParts.includes(department)) {
      console.error('[Users] Invalid department:', department, 'Available parts:', allParts);
      return res.status(400).json({
        message: 'Selected department is not valid for the selected units',
        validDepartments: allParts
      });
    }

    // Check if email exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    console.log('[Users] Creating new user:', { email, name, role, units, department });
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email,
        name,
        role,
        password: hashedPassword,
        units, // Changed from 'unit' to 'units' to match schema
        department,
        telephone: telephone || null
      }])
      .select('id, email, name, role, units, department, telephone')
      .single();

    if (error) {
      console.error('[Users] User creation error:', error);
      throw error;
    }

    if (!newUser) {
      throw new Error('Failed to create user - no data returned');
    }

    console.log('[Users] Successfully created user:', newUser.id);
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