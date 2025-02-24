import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import bcrypt from "bcrypt";

interface AuthenticatedRequest extends Request {
  user?: User;
}

declare module 'express-session' {
  interface SessionData {
    user?: User;
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
    if (!req.session?.user) {
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    // Add user to request
    req.user = req.session.user;
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      message: 'Authentication failed'
    });
  }
};

export async function setupAuth(app: Express) {
  // Apply session middleware
  app.use(sessionMiddleware);

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
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('[Auth] No user found for email:', email);
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Type assertion since we know the structure matches our User type
      const user = userData as User;

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.error('[Auth] Password validation failed for user:', email);
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Create session with user data
      const sessionUser: Partial<User> = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        units: user.units,
        department: user.department
      };

      // Store user data in session
      req.session.user = sessionUser as User;

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
    res.json(req.session?.user);
  });
}