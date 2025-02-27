import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import bcrypt from "bcrypt";

interface AuthenticatedRequest extends Request {
  user?: User;
}

// Properly extend express-session types
declare module 'express-session' {
  interface SessionData {
    user: User;
  }
}

// Session middleware with enhanced security
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'document-manager-secret',
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  name: 'sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
});

// Authentication middleware
export const authenticateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('[Auth] Checking session:', { 
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID 
    });

    if (!req.session?.user?.id) {
      console.log('[Auth] No valid user in session');
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    // Add user to request
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', { 
      id: req.user.id,
      role: req.user.role
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

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required'
        });
      }

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

      // Compare password
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

      // Store user data in session
      req.session.user = sessionUser;

      // Save session explicitly
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

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

  // Logout route
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
        res.clearCookie('sid');
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Already logged out' });
    }
  });

  // Get current user route
  app.get("/api/auth/me", authenticateSession, (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('[Auth] Returning current user:', { 
      id: req.user.id,
      role: req.user.role 
    });
    res.json(req.user);
  });

  console.log('[Auth] Authentication setup completed successfully');
}