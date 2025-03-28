/**
 * Authentication Module
 * Provides centralized authentication functionality across the application
 */

import { Request, Response, NextFunction, Express } from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { log } from '../vite';
import { supabase } from '../config/db';
import MemoryStore from 'memorystore';

// Handle custom session data structure
declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    createdAt?: Date;
  }
}

// Type definition for an authenticated user
export type AuthenticatedUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  units?: string[];
  department?: string;
  telephone?: string;
};

// Extend Express Request with user property
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Configure session management
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'budget-session-dev-secret';
const cookieDomain = process.env.COOKIE_DOMAIN || null;

if (cookieDomain) {
  log(`[Auth] Using cookie domain: ${cookieDomain} with SameSite=None`, 'auth');
} else {
  log(`[Auth] Using default cookie settings (no domain specified) with SameSite=Lax`, 'auth');
}

// Create MemoryStore for sessions (temporary solution until full Supabase implementation)
const MemoryStoreSession = MemoryStore(session);

/**
 * Session Middleware
 * Configures session management with enhanced security settings
 * With special handling for sdegdaefk.gr cross-domain support
 */
export const sessionMiddleware = session({
  store: new MemoryStoreSession({
    checkPeriod: 86400000, // prune expired entries every 24h
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    stale: false
  }),
  name: 'sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction, // Set secure cookies in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: cookieDomain ? 'none' : 'lax', // 'none' needed for cross-site cookies
    // Set domain conditionally to support sdegdaefk.gr
    ...(cookieDomain ? { domain: cookieDomain } : {})
  },
  proxy: true // Trust the proxy to properly handle secure cookies
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
 * Enhanced for cross-domain support with sdegdaefk.gr
 */
export function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Copy user from session to request for convenience
  req.user = req.session.user;
  
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
    return res.status(403).json({ message: 'Admin privileges required' });
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
      return res.status(403).json({ message: `Role ${role} required` });
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
    // Fetch user using Supabase instead of direct DB query
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      console.error('User lookup error:', error);
      return null;
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, data.password_hash);
    
    if (!passwordMatch) {
      return null;
    }
    
    // Return authenticated user object
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      units: data.units,
      department: data.department,
      telephone: data.telephone
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Setup Auth for Express Application
 * Configures all auth-related middleware and routes
 */
export async function setupAuth(app: Express) {
  // Apply session middleware
  app.use(sessionMiddleware);
  
  // User login endpoint
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
      const sessionUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        units: user.units,
        department: user.department,
        telephone: user.telephone
      };
      
      req.session.user = sessionUser;
      req.session.createdAt = new Date();
      
      // Remove sensitive fields before sending response
      return res.json({ user: sessionUser });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'An error occurred during login' });
    }
  });
  
  // User logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'An error occurred during logout' });
      }
      
      res.clearCookie('sid');
      return res.json({ message: 'Logged out successfully' });
    });
  });
  
  // Current user endpoint
  app.get("/api/auth/me", (req: AuthenticatedRequest, res: Response) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user: AuthenticatedUser = {
      id: req.session.user.id,
      email: req.session.user.email,
      name: req.session.user.name,
      role: req.session.user.role,
      units: req.session.user.units,
      department: req.session.user.department,
      telephone: req.session.user.telephone
    };
    
    return res.json({ user });
  });
  
  log('[Auth] Authentication setup complete', 'auth');
}