/**
 * Authentication Module
 * Provides centralized authentication functionality across the application
 */

import { Request, Response, NextFunction, Express } from "express";
import session from "express-session";
import { rateLimit } from 'express-rate-limit';
import bcrypt from "bcrypt";
import { User } from "@shared/schema";
import { storage } from "../storage";
import { supabase } from "../data";
import { log } from "../vite";

/**
 * User Types
 */
// Authenticated User Type - used in session and requests
export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'units' | 'department' | 'telephone'>;

// Request with Authenticated User
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Session Configuration
 */
// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    createdAt?: Date;
  }
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me'
];

// Maximum session age in milliseconds (8 hours)
const MAX_SESSION_AGE = 8 * 60 * 60 * 1000;

/**
 * Session Middleware
 * Configures session management with enhanced security settings
 */
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'document-manager-secret',
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  name: 'sid', // Custom session ID name
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Use 'lax' for better compatibility
    path: '/',
  },
  proxy: true // Enable proxy support
});

/**
 * Rate Limiting
 * Prevents abuse on authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later',
  skip: (req) => req.path !== '/api/auth/login', // Only apply to login route
  handler: (req, res) => {
    log(`[Auth] Rate limit exceeded: ${req.ip}`, "warn");
    res.status(429).json({
      message: 'Too many login attempts from this IP, please try again later'
    });
  }
});

/**
 * Authentication Middleware
 * Verifies user session and adds user data to request
 */
export function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isPublicRoute = PUBLIC_ROUTES.some(route => req.path.startsWith(route));

    log('[Auth] Checking session: ' + JSON.stringify({
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie,
      ip: req.ip,
      protocol: req.protocol,
      secure: req.secure
    }), 'auth');

    // Allow public routes without authentication
    if (isPublicRoute) {
      log('[Auth] Allowing public route access', 'auth');
      return next();
    }

    if (!req.session) {
      log('[Auth] No session found', 'auth');
      return res.status(401).json({ message: "No session found" });
    }

    if (!req.session.user) {
      log('[Auth] No user in session', 'auth');
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check session age
    const sessionCreatedAt = req.session.createdAt ? new Date(req.session.createdAt).getTime() : 0;
    const currentTime = new Date().getTime();

    if (currentTime - sessionCreatedAt > MAX_SESSION_AGE) {
      log('[Auth] Session expired', 'auth');
      req.session.destroy((err) => {
        if (err) log(`[Auth] Error destroying expired session: ${err}`, "error");
      });
      return res.status(401).json({ message: "Session expired" });
    }

    // Add user to request
    req.user = req.session.user;

    // Regenerate session ID periodically to prevent session fixation
    if (Math.random() < 0.1) { // 10% chance of regeneration
      req.session.regenerate((err) => {
        if (err) log(`[Auth] Session regeneration error: ${err}`, "error");
      });
    }

    log('[Auth] User authenticated: ' + JSON.stringify({
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID,
      ip: req.ip
    }), 'auth');

    next();
  } catch (error) {
    log(`[Auth] Authentication error: ${error}`, "error");
    res.status(500).json({ 
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Admin Role Middleware
 * Ensures that the authenticated user has admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (req.user.role !== "admin") {
      log('[Auth] Admin access denied: ' + JSON.stringify({
        userRole: req.user.role,
        path: req.path
      }), 'auth');
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    log(`[Auth] Admin validation error: ${error}`, "error");
    res.status(500).json({ 
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Role Specific Middleware Factory
 * Creates middleware that requires a specific role
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (req.user.role !== role && req.user.role !== "admin") {
        log(`[Auth] Role access denied: required=${role}, user=${req.user.role}`, 'auth');
        return res.status(403).json({ message: `${role} role required` });
      }

      next();
    } catch (error) {
      log(`[Auth] Role validation error: ${error}`, "error");
      res.status(500).json({ 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Login Authentication
 * Validates user credentials and creates a session
 */
export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  try {
    // Get user from database
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      log(`[Auth] User not found: ${email}`, 'auth');
      return null;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, data.password);
    if (!isValidPassword) {
      log(`[Auth] Invalid password for user: ${email}`, 'auth');
      return null;
    }

    // Return user data (excluding password)
    const { password: _, ...userData } = data;
    return userData as AuthenticatedUser;
  } catch (error) {
    log(`[Auth] Authentication error: ${error}`, "error");
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
  
  // Apply rate limiting to auth routes
  app.use('/api/auth', authLimiter);

  // Setup login route
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
        units: user.units || [],
        department: user.department,
        telephone: user.telephone
      };

      req.session.user = sessionUser;
      req.session.createdAt = new Date();

      // Send success response
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
      log(`[Auth] Login error: ${error}`, "error");
      res.status(500).json({ 
        message: 'Login failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Setup logout route
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        log(`[Auth] Logout error: ${err}`, "error");
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('sid');
      res.status(200).json({ message: 'Logout successful' });
    });
  });

  // User info route
  app.get("/api/auth/me", authenticateSession, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(200).json({ authenticated: false });
    }
    
    log('[Auth] Returning current user: ' + JSON.stringify({
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID,
      ip: req.ip
    }), 'auth');

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

  log('[Auth] Authentication system initialized', 'init');
}

export default {
  setupAuth,
  authenticateSession,
  requireAdmin,
  requireRole,
  authenticateUser,
  sessionMiddleware,
  authLimiter
};