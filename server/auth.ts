import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Session middleware
const sessionMiddleware = session({
  secret: 'document-manager-secret', // In production, use environment variable
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Authentication middleware - checks session instead of credentials
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.user) {
      console.log('[Auth] No user in session');
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', req.user.email);
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      error: { message: 'Authentication failed' }
    });
  }
};

export async function setupAuth(app: Express) {
  // Apply session middleware
  app.use(sessionMiddleware);

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Attempting login for email:', email);

      // Query the users table directly using supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.error('[Auth] Database query error:', error);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      if (!user) {
        console.error('[Auth] No user found for email:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare password - for now just compare directly since we're using Supabase's auth
      if (password !== user.password) {
        console.error('[Auth] Password validation failed for user:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      const userData: User = {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      };

      // Store user data in session
      if (req.session) {
        req.session.user = userData;
        console.log('[Auth] User data stored in session:', userData);
      }

      console.log('[Auth] Login successful for user:', email);
      res.json(userData);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    if (!req.session) {
      return res.status(500).json({
        error: { message: 'Session not found' }
      });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth] Logout error:', err);
        return res.status(500).json({
          error: { message: 'Logout failed' }
        });
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", authenticateSession, (req, res) => {
    res.json(req.user);
  });
}