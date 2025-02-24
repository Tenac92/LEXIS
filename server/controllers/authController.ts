import { Router } from 'express';
import { supabase } from '../db';
import bcrypt from 'bcrypt';
import type { User } from '@shared/schema';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    console.log('[Auth] Attempting login for email:', email);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.error('[Auth] No user found for email:', email);
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.error('[Auth] Password validation failed for user:', email);
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Create session with user data
    const userData: Partial<User> = {
      id: user.id,
      name: user.name,
      role: user.role,
      unit: user.unit,
      department: user.department,
      isAdmin: user.role === 'admin'
    };

    req.session.user = userData;

    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('[Auth] Login successful:', {
      id: userData.id,
      role: userData.role,
      sessionID: req.sessionID
    });

    res.json(userData);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({
          message: 'Logout failed'
        });
      }
      res.clearCookie('sid');
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'Already logged out' });
  }
});

router.get('/me', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

export default router;