import { Router } from 'express';
import { supabase } from '../config/db';
import { authenticateSession } from '../auth';
import type { User } from '@shared/schema';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: User;
}

export const router = Router();

// Get all units
router.get('/units', authenticateSession, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Units] Fetching units from Monada table');
    const { data: units, error } = await supabase
      .from('Monada')
      .select('unit_name');

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    // Extract unique unit names from the JSON structure
    const uniqueUnits = new Set<string>();
    units?.forEach(unit => {
      if (unit.unit_name?.name && typeof unit.unit_name.name === 'string') {
        uniqueUnits.add(unit.unit_name.name);
      }
    });

    const unitsList = Array.from(uniqueUnits).sort().map(unitName => ({
      id: unitName,
      name: unitName
    }));
    
    res.json(unitsList);
  } catch (error) {
    console.error('[Units] Units fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch units', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get parts for selected units
router.get('/units/parts', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { units } = req.query;

    if (!units) {
      return res.status(400).json({ message: 'Units parameter is required' });
    }

    const unitsList = Array.isArray(units) ? units : [units];
    console.log('[Units] Fetching parts for units:', unitsList);
    
    // Get all units first and filter manually to avoid JSON path issues with Greek characters
    const { data: allUnits, error } = await supabase
      .from('Monada')
      .select('unit_name, parts');
    
    if (error) {
      console.error('[Units] Error fetching units:', error);
      throw error;
    }
    
    // Filter to get only the selected units
    const selectedUnits = allUnits?.filter(unit => 
      unit.unit_name && 
      typeof unit.unit_name === 'object' && 
      unit.unit_name.name && 
      unitsList.includes(unit.unit_name.name)
    );
    
    console.log('[Units] Found matching units:', selectedUnits?.length || 0);
    
    // Combine all parts from selected units
    const allParts = selectedUnits?.reduce<string[]>((acc, unit) => {
      if (unit.parts && typeof unit.parts === 'object') {
        // Extract values from the parts object
        return [...acc, ...Object.values(unit.parts)];
      }
      return acc;
    }, []) || [];

    // Remove duplicates
    const uniqueParts = Array.from(new Set(allParts));
    
    console.log('[Units] Found parts:', uniqueParts);
    res.json(uniqueParts.sort());
  } catch (error) {
    console.error('[Units] Error fetching unit parts:', error);
    res.status(500).json({ 
      message: 'Failed to fetch unit parts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get parts for a specific unit
router.get('/units/:unitName/parts', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { unitName } = req.params;

    console.log('[Units] Fetching parts for unit:', unitName);
    
    // Get all units and filter manually to avoid JSON path issues with Greek characters
    const { data: allUnits, error } = await supabase
      .from('Monada')
      .select('unit_name, parts');

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    // Find the matching unit
    const unitData = allUnits?.find(unit => 
      unit.unit_name && 
      typeof unit.unit_name === 'object' && 
      unit.unit_name.name === unitName
    );

    if (!unitData) {
      console.log('[Units] Unit not found:', unitName);
      return res.json([]);
    }

    const parts = unitData?.parts ? Object.values(unitData.parts) : [];
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

    // Validate required fields (department conditionally required)
    const basicFields = { email, name, password, role, units };
    const missingFields = Object.entries(basicFields)
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
    
    // Get all units first
    const { data: allUnits, error: fetchError } = await supabase
      .from('Monada')
      .select('unit, unit_name, parts');
      
    if (fetchError) {
      console.error('[Users] Error fetching units:', fetchError);
      return res.status(500).json({
        message: 'Failed to verify units',
        error: fetchError.message
      });
    }
    
    // Filter units manually instead of using JSON path operations
    const validUnits = allUnits?.filter(unit => {
      // Check if this unit's name is in the requested units array
      return unit.unit_name && 
             typeof unit.unit_name === 'object' &&
             unit.unit_name.name && 
             units.includes(unit.unit_name.name);
    });
    
    // Check if all requested units were found
    if (!validUnits || validUnits.length !== units.length) {
      console.error('[Users] Invalid units:', units, 'Found:', validUnits?.length || 0);
      return res.status(400).json({
        message: 'One or more invalid units selected',
        error: 'Not all requested units are valid'
      });
    }
    
    // Use validUnits instead of unitData for the next steps
    const unitData = validUnits;

    // Verify department exists in units' parts, if department is provided
    const allParts = Array.from(new Set(
      unitData.flatMap(unit => Object.values(unit.parts || {}))
    ));

    // Only validate department if it's provided and there are parts available
    if (department && allParts.length > 0 && !allParts.includes(department)) {
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

    // Create user - department is optional
    console.log('[Users] Creating new user:', { email, name, role, units, department });
    
    const userData = {
      email,
      name,
      role,
      password: hashedPassword,
      units,
      telephone: telephone || null
    };
    
    // Only add department if it's provided
    if (department) {
      Object.assign(userData, { department });
    }
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([userData])
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

// Get users with matching units
router.get('/matching-units', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.units || req.user.units.length === 0) {
      return res.status(400).json({ message: 'User has no assigned units' });
    }

    console.log('[Users] Fetching users with matching units for units:', req.user.units);
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, units')
      .neq('id', req.user.id)  
      .filter('units', 'cs', `{${req.user.units.join(',')}}`)  
      .order('name');

    if (error) {
      console.error('[Users] Supabase query error:', error);
      throw error;
    }

    // Filter users to only include those that have at least one matching unit
    const filteredUsers = users?.filter(user => {
      return user.units?.some(unit => req.user?.units.includes(unit));
    }) || [];

    console.log('[Users] Found matching users:', filteredUsers.length);
    res.json(filteredUsers);
  } catch (error) {
    console.error('[Users] Error fetching matching users:', error);
    res.status(500).json({
      message: 'Failed to fetch matching users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});