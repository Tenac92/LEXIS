import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateSession } from '../authentication';
import type { User } from '@shared/schema';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';

// Create a Supabase client with SERVICE_ROLE key that can bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || '',
  {
    auth: {
      persistSession: false
    }
  }
);

// Original Supabase client from config (using ANON key)
import { supabase } from '../config/db';

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
      .select('id, unit, unit_name');

    if (error) {
      console.error('[Units] Supabase query error:', error);
      throw error;
    }

    console.log('[Units] Raw units data sample:', units?.slice(0, 2));

    // Extract unique unit names from various possible structures
    const uniqueUnits = new Set<{id: string, name: string}>();
    units?.forEach(unit => {
      let unitName: string | null = null;
      let unitId: string | null = null;

      // Try different possible structures
      if (unit.unit_name?.name && typeof unit.unit_name.name === 'string') {
        unitName = unit.unit_name.name;
        unitId = unit.id?.toString() || unit.unit_name.name;
      } else if (unit.unit && typeof unit.unit === 'string') {
        unitName = unit.unit;
        unitId = unit.id?.toString() || unit.unit;
      } else if (typeof unit.unit_name === 'string') {
        unitName = unit.unit_name;
        unitId = unit.id?.toString() || unit.unit_name;
      }

      if (unitName) {
        // Use a combination of id and name to ensure uniqueness
        const existingUnit = Array.from(uniqueUnits).find(u => u.name === unitName);
        if (!existingUnit) {
          uniqueUnits.add({ id: unitId || unitName, name: unitName });
        }
      }
    });

    const unitsList = Array.from(uniqueUnits).sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('[Units] Found matching units:', unitsList.length);
    res.json(unitsList);
  } catch (error) {
    console.error('[Units] Units fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch units', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get parts for selected units (by numeric IDs)
router.get('/units/parts', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { units } = req.query;

    if (!units) {
      return res.status(400).json({ message: 'Units parameter is required' });
    }

    // Parse numeric unit IDs from query parameter
    const unitIdStrings = Array.isArray(units) ? units : [units];
    const unitIds = unitIdStrings.flatMap(v => String(v).split(',')).map(Number).filter(Number.isFinite);
    console.log('[Units] Fetching parts for unit IDs:', unitIds);
    
    if (unitIds.length === 0) {
      console.log('[Units] No valid unit IDs provided');
      return res.json([]);
    }
    
    // Get units by numeric IDs
    const { data: selectedUnits, error } = await supabase
      .from('Monada')
      .select('id, parts')
      .in('id', unitIds);
    
    if (error) {
      console.error('[Units] Error fetching units:', error);
      throw error;
    }
    
    console.log('[Units] Found matching units:', selectedUnits?.length || 0);
    
    // Combine all parts from selected units - extract 'tmima' fields
    const allParts = selectedUnits?.reduce<string[]>((acc, unit) => {
      if (unit.parts && typeof unit.parts === 'object') {
        // Extract tmima values from each section (Α, Β, Γ, Δ, etc.)
        const tmimaValues = Object.values(unit.parts)
          .filter((section): section is Record<string, any> => 
            section !== null && typeof section === 'object' && section !== undefined && 'tmima' in section
          )
          .map(section => section.tmima)
          .filter((tmima): tmima is string => typeof tmima === 'string');
        return [...acc, ...tmimaValues];
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
      .select('id, email, name, role, unit_id, telephone, department')
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

    const { email, name, password, role, unit_id, units, department, telephone, details } = req.body;

    // Support both field names for compatibility - prefer unit_id from frontend
    const unitsToValidate = unit_id || units;

    // Validate required fields (department conditionally required)
    const basicFields = { email, name, password, role, units: unitsToValidate };
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

    // Verify units exist - Parse numeric unit IDs
    const unitIds = unitsToValidate.map(Number).filter(Number.isFinite);
    console.log('[Users] Verifying unit IDs:', unitIds);
    
    if (unitIds.length !== unitsToValidate.length) {
      console.error('[Users] Invalid unit IDs (non-numeric):', unitsToValidate);
      return res.status(400).json({
        message: 'Unit IDs must be numeric',
        error: 'Invalid unit ID format'
      });
    }
    
    // Get units by numeric IDs
    const { data: allUnits, error: fetchError } = await supabase
      .from('Monada')
      .select('id, parts')
      .in('id', unitIds);
      
    if (fetchError) {
      console.error('[Users] Error fetching units:', fetchError);
      return res.status(500).json({
        message: 'Failed to verify units',
        error: fetchError.message
      });
    }
    
    // Check if all requested units were found
    if (!allUnits || allUnits.length !== unitIds.length) {
      console.error('[Users] Invalid unit IDs:', unitIds, 'Found:', allUnits?.length || 0);
      return res.status(400).json({
        message: 'One or more invalid units selected',
        error: 'Not all requested unit IDs are valid'
      });
    }
    
    const unitData = allUnits;

    // Verify department exists in units' parts - extract tmima fields
    const allParts = Array.from(new Set(
      unitData.flatMap(unit => {
        if (!unit.parts || typeof unit.parts !== 'object') return [];
        // Extract tmima values from each section
        return Object.values(unit.parts)
          .filter((section): section is Record<string, any> => 
            section !== null && typeof section === 'object' && section !== undefined && 'tmima' in section
          )
          .map(section => section.tmima)
          .filter((tmima): tmima is string => typeof tmima === 'string');
      })
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

    // Store numeric unit IDs directly
    console.log('[Users] Storing unit IDs:', { originalUnits: unitsToValidate, unitIds });
    
    // Create user - department is optional
    console.log('[Users] Creating new user:', { email, name, role, unit_ids: unitIds, department });
    
    const userData = {
      email,
      name,
      role,
      password: hashedPassword,
      unit_id: unitIds, // Store numeric IDs
      telephone: telephone || null
    };
    
    // Only add department if it's provided
    if (department) {
      Object.assign(userData, { department });
    }
    
    // Only add details if it's provided
    if (details && typeof details === 'object') {
      Object.assign(userData, { details });
    }
    
    // Use supabaseAdmin with service role key to bypass RLS policies
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert([userData])
      .select('id, email, name, role, unit_id, department, telephone')
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

// Update user
router.patch('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Users] Update request received for user ID:', req.params.id);
    
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Convert id to number since IDs are stored as numbers in the database
    const userId = parseInt(req.params.id, 10);
    
    // Check if user exists before update
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();
      
    if (checkError || !existingUser) {
      console.error('[Users] User not found:', checkError || 'No user with that ID');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prepare update data - clean empty strings and handle null values
    const updateData: Record<string, any> = {
      name: req.body.name?.trim() || null,
      email: req.body.email?.trim() || null,
      role: req.body.role?.trim() || null,
      unit_id: Array.isArray(req.body.unit_id) ? req.body.unit_id : [],
      telephone: req.body.telephone?.trim() || null,
      department: req.body.department?.trim() || null
    };

    // Remove null values and empty strings to prevent database errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === null || updateData[key] === '' || updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Ensure unit_id is always an array
    if (updateData.unit_id && !Array.isArray(updateData.unit_id)) {
      updateData.unit_id = [];
    }
    
    // Only update password if it's provided
    if (req.body.password && req.body.password.trim() !== '') {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
      updateData.password = hashedPassword;
    }
    
    // Update the user with extra logging
    console.log('[Users] Updating user with ID:', userId);
    
    // Use supabaseAdmin with service role key to bypass RLS policies
    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('[Users] Supabase update error:', error);
      throw error;
    }

    console.log('[Users] User updated successfully, ID:', userId);
    res.status(200).json({ 
      message: 'User updated successfully',
      user: {
        id: userId,
        email: req.body.email,
        name: req.body.name,
        role: req.body.role
      }
    });
  } catch (error) {
    console.error('[Users] User update error:', error);
    res.status(500).json({ 
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete user
router.delete('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Users] Delete request received for user ID:', req.params.id);
    
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Convert id to number since IDs are stored as numbers in the database
    const userId = parseInt(req.params.id, 10);
    
    // Check if user exists before deletion
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (checkError || !existingUser) {
      console.error('[Users] User not found:', checkError || 'No user with that ID');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete the user with extra logging
    console.log('[Users] Deleting user with ID:', userId);
    
    // Use supabaseAdmin with service role key to bypass RLS policies
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('[Users] Supabase deletion error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to delete user', 
        error: error.message 
      });
    }

    console.log('[Users] User deleted successfully, ID:', userId);
    return res.status(200).json({ 
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('[Users] User deletion error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get users with matching units
router.get('/matching-units', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.unit_id || req.user.unit_id.length === 0) {
      return res.status(400).json({ message: 'User has no assigned units' });
    }

    console.log('[Users] Fetching users with matching units for units:', req.user.unit_id);
    // Get all users except the current user
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, unit_id, role')
      .neq('id', req.user.id)  
      .order('name');

    if (error) {
      console.error('[Users] Supabase query error:', error);
      throw error;
    }

    // Filter users to only include those that have at least one matching unit
    const filteredUsers = users?.filter(user => {
      if (!user.unit_id || !Array.isArray(user.unit_id) || !req.user?.unit_id) return false;
      return user.unit_id.some((unit: number) => req.user!.unit_id!.includes(unit));
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