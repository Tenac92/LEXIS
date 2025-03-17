import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import bcrypt from "bcrypt";
import { rateLimit } from 'express-rate-limit';

interface AuthenticatedRequest extends Request {
  user?: User;
}

// Properly extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: User;  // Make user optional to match runtime behavior
    createdAt?: Date;
  }
}

// Session middleware with enhanced security settings
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'document-manager-secret',
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  name: 'sid', // Custom session ID name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Secure in production
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: 'strict',
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN : undefined
  }
});

// Rate limiting middleware for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication middleware with enhanced logging
export const authenticateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('[Auth] Checking session:', { 
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie 
    });

    if (!req.session?.user?.id) {
      console.log('[Auth] No valid user in session:', {
        sessionExists: !!req.session,
        userExists: !!req.session?.user,
        sessionID: req.sessionID
      });
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    // Add user to request
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', { 
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID
    });
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export async function setupAuth(app: Express) {
  console.log('[Auth] Starting authentication setup...');

  // Apply session middleware
  app.use(sessionMiddleware);
  console.log('[Auth] Session middleware applied');

  // Login route with enhanced security and rate limiting
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required'
        });
      }

      // Add brute force protection delay
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('[Auth] Attempting login for email:', email);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, role, units, department, telephone, password')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('[Auth] No user found for email:', email);
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Compare password with constant-time comparison
      const isPasswordValid = await bcrypt.compare(password, userData.password);
      if (!isPasswordValid) {
        console.error('[Auth] Password validation failed for user:', email);
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Create session with user data, excluding sensitive fields
      const sessionUser: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        units: userData.units || [],
        department: userData.department,
        telephone: userData.telephone
      };

      // Store user data in session with expiry
      req.session.user = sessionUser;
      req.session.createdAt = new Date();

      // Save session explicitly and wait for completion
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            reject(err);
          } else {
            console.log('[Auth] Session saved successfully:', {
              sessionID: req.sessionID,
              userID: sessionUser.id
            });
            resolve();
          }
        });
      });

      // Set secure cookie headers
      res.setHeader('Set-Cookie', [
        `sid=${req.sessionID}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${8 * 60 * 60}`
      ]);

      console.log('[Auth] Login successful:', {
        id: sessionUser.id,
        role: sessionUser.role,
        sessionID: req.sessionID
      });

      res.json(sessionUser);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        message: 'Login failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Logout route with enhanced session cleanup
  app.post("/api/auth/logout", (req, res) => {
    console.log('[Auth] Logging out user:', { 
      sessionID: req.sessionID,
      userId: req.session?.user?.id 
    });

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Logout error:', err);
          return res.status(500).json({
            message: 'Logout failed'
          });
        }
        res.clearCookie('sid', { path: '/' });
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Already logged out' });
    }
  });

  // Get current user route with enhanced error handling
  app.get("/api/auth/me", authenticateSession, (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      console.log('[Auth] No user found in authenticated request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('[Auth] Returning current user:', { 
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID
    });
    res.json(req.user);
  });

  console.log('[Auth] Authentication setup completed successfully');
}