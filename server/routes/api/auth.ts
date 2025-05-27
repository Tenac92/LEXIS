/**
 * Authentication API Routes
 * Centralizes all authentication-related endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { log } from '../../vite';
import { 
  authenticateSession, 
  sessionMiddleware,
  AuthenticatedRequest,
  authenticateUser
} from '../../authentication';
import { authLimiter } from "../../authentication"
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';
import { User, insertUserSchema } from '@shared/schema';

// Create router
const router = Router();

// Apply rate limiting to auth routes from auth.ts
router.use(authLimiter);

/**
 * Login validation schema
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

/**
 * User login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body);
    
    // Authenticate user
    const user = await authenticateUser(email, password);
    
    if (!user) {
      log(`[Auth] Login failed for user: ${email}`, 'auth');
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Create session
    req.session.user = user;
    req.session.createdAt = new Date();
    
    log(`[Auth] Login successful for user: ${email}`, 'auth');
    
    // Return user data (excluding sensitive information)
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        units: user.units
      }
    });
  } catch (error) {
    log(`[Auth] Login error: ${error}`, 'error');
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid login data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * User logout
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      log(`[Auth] Logout error: ${err}`, 'error');
      return res.status(500).json({ message: 'Logout failed' });
    }
    
    res.clearCookie('sid');
    res.status(200).json({ message: 'Logout successful' });
  });
});

/**
 * Get current user
 * GET /api/auth/me
 */
router.get('/me', authenticateSession, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(200).json({ authenticated: false });
  }
  
  log(`[Auth] Returning current user: ${JSON.stringify({
    id: req.user.id,
    role: req.user.role,
    sessionID: req.sessionID,
    ip: req.ip
  })}`, 'auth');
  
  res.status(200).json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      units: req.user.units,
      department: req.user.department,
      telephone: req.user.telephone
    }
  });
});

/**
 * Register new user (admin only)
 * POST /api/auth/register
 */
router.post('/register', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admins can register new users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Validate request body against schema
    const userData = insertUserSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();
    
    if (existingUser.data) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert({
        ...userData,
        password: hashedPassword
      })
      .select('id, email, name, role, units, department, telephone, created_at')
      .single();
    
    if (error) {
      throw error;
    }
    
    log(`[Auth] User registered: ${userData.email}`, 'auth');
    
    res.status(201).json({
      message: 'User registered successfully',
      user: data
    });
  } catch (error) {
    log(`[Auth] Registration error: ${error}`, 'error');
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid user data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Change password
 * PUT/POST /api/auth/change-password
 * Supports both PUT and POST methods for compatibility
 */
router.route('/change-password')
  .put(authenticateSession, handleChangePassword)
  .post(authenticateSession, handleChangePassword);

// Handler function for change password
async function handleChangePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    
    // Get current user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', req.user.id);
    
    if (updateError) {
      throw updateError;
    }
    
    log(`[Auth] Password changed for user ID: ${req.user.id}`, 'auth');
    
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    log(`[Auth] Password change error: ${error}`, 'error');
    res.status(500).json({
      message: 'Failed to change password',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;