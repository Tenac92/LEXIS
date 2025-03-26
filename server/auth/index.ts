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

// Define a safer type for authenticated users that ensures required fields
export type AuthenticatedUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  units?: string[];
  department?: string;
  telephone?: string;
};

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

// Get environment variables and configuration
const sessionSecret = process.env.SESSION_SECRET || 'your-session-secret-1234567890';
const isProduction = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.COOKIE_DOMAIN;

// Log cookie configuration on startup
if (cookieDomain) {
  log(`[Auth] Using cookie domain: ${cookieDomain}`, 'auth');
  log(`[Auth] Cross-domain cookies enabled with SameSite=None and Secure=${isProduction}`, 'auth');
} else {
  log(`[Auth] Using default cookie settings (no domain specified) with SameSite=Lax`, 'auth');
}

// Create PostgreSQL session store
const PgStore = pgSession(session);

/**
 * Session Middleware
 * Configures session management with enhanced security settings
 * With special handling for sdegdaefk.gr cross-domain support
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
  // Extract request origin information
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';
  
  // Check if request is from sdegdaefk.gr domain
  const isSdegdaefkRequest = 
    origin.includes('sdegdaefk.gr') || 
    referer.includes('sdegdaefk.gr') || 
    host.includes('sdegdaefk.gr');
  
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
    // Different handling for sdegdaefk.gr domain
    if (isSdegdaefkRequest) {
      log(`[Auth] Cross-domain auth failed for sdegdaefk.gr: ${JSON.stringify({
        origin, 
        referer,
        host,
        cookies: req.headers.cookie,
        sessionID: req.sessionID
      })}`, 'auth');
    }
    
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Ensure session user has all required fields before assigning to req.user
  const sessionUser = req.session.user;
  if (!sessionUser.id || !sessionUser.email || !sessionUser.name || !sessionUser.role) {
    log(`[Auth] Invalid user object in session: ${JSON.stringify(sessionUser)}`, 'error');
    return res.status(401).json({ message: 'Invalid session data' });
  }

  // Set user on request with the required fields
  req.user = {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    role: sessionUser.role,
    units: sessionUser.units,
    department: sessionUser.department,
    telephone: sessionUser.telephone
  };

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
      // Extract request origin information
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';
      const host = req.headers.host || '';
      
      // Check if request is from sdegdaefk.gr domain
      const isSdegdaefkRequest = 
        origin.includes('sdegdaefk.gr') || 
        referer.includes('sdegdaefk.gr') || 
        host.includes('sdegdaefk.gr');
      
      // Log detailed login attempt for cross-domain debugging
      if (isSdegdaefkRequest) {
        log(`[Auth] Cross-domain login attempt from sdegdaefk.gr: ${JSON.stringify({
          origin,
          referer, 
          host,
          headers: req.headers,
          cookies: req.headers.cookie,
          ip: req.ip
        })}`, 'auth');
      }
      
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
      
      // Force session save to ensure cookie is set correctly 
      req.session.save((err) => {
        if (err) {
          log(`[Auth] Error saving session: ${err}`, 'error');
          return res.status(500).json({ message: 'Session creation failed' });
        }
        
        log(`[Auth] Session created for user: ${email} with ID: ${req.sessionID}`, 'auth');
        
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
        
        // For cross-domain requests, log cookie details
        if (isSdegdaefkRequest) {
          log(`[Auth] Cross-domain session created with: ${JSON.stringify({
            sessionID: req.sessionID,
            cookieDomain: process.env.COOKIE_DOMAIN || 'none set',
            sameSite: cookieDomain ? 'none' : 'lax',
            secure: isProduction 
          })}`, 'auth');
        }
        
        res.status(200).json({ 
          user: sessionUser,
          sessionID: req.sessionID // Include session ID in response for debugging
        });
      });
    } catch (error) {
      log(`[Auth] Login error: ${error}`, 'error');
      res.status(500).json({ message: 'Login failed', error: String(error) });
    }
  });
  
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    // Extract request origin information
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const host = req.headers.host || '';
    
    // Check if request is from sdegdaefk.gr domain
    const isSdegdaefkRequest = 
      origin.includes('sdegdaefk.gr') || 
      referer.includes('sdegdaefk.gr') || 
      host.includes('sdegdaefk.gr');
      
    // Log logout attempt with detailed info for troubleshooting
    log(`[Auth] Logout attempt: ${JSON.stringify({
      sessionID: req.sessionID,
      isSdegdaefkRequest,
      origin,
      host,
      referer,
      cookies: req.headers.cookie
    })}`, 'auth');
    
    req.session.destroy((err) => {
      if (err) {
        log(`[Auth] Logout error: ${err}`, 'error');
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      // Clear the cookie with the same settings used to set it
      const cookieDomain = process.env.COOKIE_DOMAIN || (isSdegdaefkRequest ? 'sdegdaefk.gr' : undefined);
      
      // Log cookie clearing details
      log(`[Auth] Clearing cookie with settings: ${JSON.stringify({
        domain: cookieDomain,
        sameSite: cookieDomain ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production'
      })}`, 'auth');
      
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
      
      // Ensure session user has all required fields
      const sessionUser = req.session.user;
      if (!sessionUser.id || !sessionUser.email || !sessionUser.name || !sessionUser.role) {
        log(`[Auth] Invalid user object in session: ${JSON.stringify(sessionUser)}`, 'error');
        return res.status(401).json({ message: 'Invalid session data' });
      }
      
      // Create a proper authenticated user object
      const user: AuthenticatedUser = {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
        units: sessionUser.units,
        department: sessionUser.department,
        telephone: sessionUser.telephone
      };
      
      // Set user on request
      req.user = user;
      
      // Log authenticated user
      log(`[Auth] Returning current user: ${JSON.stringify({
        id: user.id,
        role: user.role,
        sessionID: req.sessionID,
        ip: req.ip
      })}`, 'auth');
      
      res.status(200).json({ user });
    } catch (error) {
      log(`[Auth] Error retrieving user: ${error}`, 'error');
      res.status(500).json({ message: 'Error retrieving user data', error: String(error) });
    }
  });
  
  return app;
}