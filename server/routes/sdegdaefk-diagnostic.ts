/**
 * Diagnostic endpoints specifically for sdegdaefk.gr integration
 */

import { Router } from 'express';
import { supabase } from '../config/db';
import bcrypt from 'bcrypt';

const router = Router();

/**
 * Test login endpoint that only accepts JSON requests and returns JSON responses
 * This helps debug issues with the main login endpoint by providing a simpler alternative
 */
router.post('/auth-test', async (req, res) => {
  try {
    console.log('[DiagnosticLogin] Login attempt with body:', JSON.stringify(req.body));

    // Verify we received JSON input
    if (!req.is('application/json')) {
      return res.status(400).json({
        status: 'error',
        message: 'Only application/json content type is accepted',
        contentType: req.headers['content-type']
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
        received: { 
          hasEmail: Boolean(email), 
          hasPassword: Boolean(password) 
        }
      });
    }

    // Add brute force protection delay
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('[DiagnosticLogin] Attempting to find user with email:', email);

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, units, department, telephone, password')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('[DiagnosticLogin] No user found for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
        details: 'User not found'
      });
    }

    console.log('[DiagnosticLogin] User found, validating password');

    // Compare password with constant-time comparison
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      console.error('[DiagnosticLogin] Password validation failed for user:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
        details: 'Password invalid'
      });
    }

    // Create a sanitized user object (no password)
    const sanitizedUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      units: userData.units || [],
      department: userData.department || undefined,
      telephone: userData.telephone || undefined
    };

    // Store login success info in session if session exists
    if (req.session) {
      req.session.user = sanitizedUser;
      req.session.createdAt = new Date();

      console.log('[DiagnosticLogin] Session populated with user data');
      
      // Wait for session to save
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[DiagnosticLogin] Session save error:', err);
            reject(err);
          } else {
            console.log('[DiagnosticLogin] Session saved with ID:', req.sessionID);
            resolve();
          }
        });
      });
    } else {
      console.log('[DiagnosticLogin] No session available, user authenticated but no session saved');
    }

    console.log('[DiagnosticLogin] Login successful for user:', { id: userData.id, role: userData.role });

    return res.json({
      status: 'success',
      message: 'Authentication successful',
      user: sanitizedUser,
      sessionStatus: {
        hasSession: !!req.session,
        sessionID: req.sessionID || 'none'
      }
    });

  } catch (error) {
    console.error('[DiagnosticLogin] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get detailed connection information for sdegdaefk.gr integration
 */
router.get('/connection-info', (req, res) => {
  try {
    // Extract headers for diagnostics
    const headers = { ...req.headers };
    
    // Remove sensitive information
    delete headers.cookie;
    delete headers.authorization;
    
    // Get environment configuration (safely)
    const envConfig = {
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      HAS_COOKIE_DOMAIN: Boolean(process.env.COOKIE_DOMAIN),
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'not set',
      HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
      HAS_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      HAS_SUPABASE_KEY: Boolean(process.env.SUPABASE_KEY) || Boolean(process.env.SUPABASE_ANON_KEY),
      HAS_SESSION_SECRET: Boolean(process.env.SESSION_SECRET)
    };
    
    // Session information (safely)
    const sessionInfo = {
      exists: Boolean(req.session),
      hasUser: Boolean(req.session?.user),
      sid: req.sessionID || 'none',
      createdAt: req.session?.createdAt ? new Date(req.session.createdAt).toISOString() : null,
      cookie: req.session?.cookie ? {
        maxAge: req.session.cookie.maxAge,
        secure: req.session.cookie.secure,
        httpOnly: req.session.cookie.httpOnly,
        sameSite: req.session.cookie.sameSite,
        domain: req.session.cookie.domain || 'not set',
        path: req.session.cookie.path
      } : null
    };
    
    return res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        ip: req.ip,
        protocol: req.protocol,
        secure: req.secure,
        headers
      },
      server: {
        timestamp: new Date().toISOString(),
        environment: envConfig
      },
      session: sessionInfo
    });
  } catch (error) {
    console.error('[Diagnostic] Error getting connection info:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving connection information',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;