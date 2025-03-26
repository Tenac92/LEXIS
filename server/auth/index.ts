/**
 * Authentication Module
 * Provides centralized authentication functionality across the application
 */

import { Request, Response, NextFunction, Express } from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { User } from '@shared/schema';
import { log } from '../vite';
import { db, supabase } from '../data';
import bcrypt from 'bcrypt';

// PostgreSQL session store
import pgSession from 'connect-pg-simple';
import { pool } from '../config/db';

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'units' | 'department' | 'telephone'>;

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Extend express-session with our user types
declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    createdAt?: Date;
  }
}

// Get session secret from environment
const sessionSecret = process.env.SESSION_SECRET || 'your-session-secret-1234567890';
const isProduction = process.env.NODE_ENV === 'production';

// Create PostgreSQL session store
const PgStore = pgSession(session);

/**
 * Session Middleware
 * Configures session management with enhanced security settings
 */
export const sessionMiddleware = session({
  store: new PgStore({
    pool, // Use the pool instance directly
    tableName: 'session',
    createTableIfMissing: true
  }),
  name: 'sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set secure cookies in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.COOKIE_DOMAIN ? 'none' : 'lax', // 'none' needed for cross-site cookies
    // Set domain conditionally to support sdegdaefk.gr
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
  }
});

/**
 * Rate Limiting
 * Prevents abuse on authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 requests per IP in the window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' }
});

/**
 * Authentication Middleware
 * Verifies user session and adds user data to request
 */
export function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Log session information
  log(`[Auth] Checking session: ${JSON.stringify({
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    sessionID: req.sessionID,
    cookies: req.headers.cookie,
    ip: req.ip,
    protocol: req.protocol,
    secure: req.secure
  })}`, 'auth');

  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Set user on request
  req.user = req.session.user;

  // Log authenticated user
  log(`[Auth] User authenticated: ${JSON.stringify({
    id: req.user.id,
    role: req.user.role,
    sessionID: req.sessionID,
    ip: req.ip
  })}`, 'auth');

  next();
}

/**
 * Admin Role Middleware
 * Ensures that the authenticated user has admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
}

/**
 * Role Specific Middleware Factory
 * Creates middleware that requires a specific role
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: `${role} access required` });
    }

    next();
  };
}

/**
 * Login Authentication
 * Validates user credentials and creates a session
 */
export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  try {
    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, units, department, telephone, password')
      .eq('email', email)
      .single();
    
    if (error || !user) {
      log(`[Auth] User not found: ${email}`, 'auth');
      return null;
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      log(`[Auth] Invalid password for user: ${email}`, 'auth');
      return null;
    }
    
    // Return user without sensitive data
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      units: user.units,
      department: user.department,
      telephone: user.telephone
    };
  } catch (error) {
    log(`[Auth] Authentication error: ${error}`, 'error');
    return null;
  }
}

/**
 * Setup Auth for Express Application
 * Configures all auth-related middleware and routes
 */
export async function setupAuth(app: Express) {
  // Register session middleware
  app.use(sessionMiddleware);
  
  // Basic login and logout routes for backward compatibility
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const user = await authenticateUser(email, password);
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Create session
      req.session.user = user;
      req.session.createdAt = new Date();
      
      log(`[Auth] Session created for user: ${email}`, 'auth');
      
      // Create user session object to return
      const sessionUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        units: user.units,
        department: user.department,
        telephone: user.telephone
      };
      
      res.status(200).json({ user: sessionUser });
    } catch (error) {
      log(`[Auth] Login error: ${error}`, 'error');
      res.status(500).json({ message: 'Login failed', error: String(error) });
    }
  });
  
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        log(`[Auth] Logout error: ${err}`, 'error');
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      // Clear the cookie with the same settings used to set it
      const cookieDomain = process.env.COOKIE_DOMAIN;
      res.clearCookie('sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: cookieDomain ? 'none' : 'lax',
        ...(cookieDomain ? { domain: cookieDomain } : {})
      });
      
      res.status(200).json({ message: 'Logout successful' });
    });
  });
  
  app.get("/api/auth/me", (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if session exists before proceeding
      if (!req.session) {
        return res.status(401).json({ message: 'No session available' });
      }
      
      // Check if user exists in session
      if (!req.session.user) {
        return res.status(401).json({ message: 'No authenticated user found' });
      }
      
      // Set user on request
      req.user = req.session.user;
      
      // Log authenticated user
      log(`[Auth] Returning current user: ${JSON.stringify({
        id: req.user.id,
        role: req.user.role,
        sessionID: req.sessionID,
        ip: req.ip
      })}`, 'auth');
      
      res.status(200).json({ user: req.user });
    } catch (error) {
      log(`[Auth] Error retrieving user: ${error}`, 'error');
      res.status(500).json({ message: 'Error retrieving user data', error: String(error) });
    }
  });
  
  return app;
}