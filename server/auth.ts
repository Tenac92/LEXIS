import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import bcrypt from "bcrypt";

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
    console.log('[Auth] User authenticated:', req.user.username);
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
      const username = email; // Use email as username for compatibility

      if (!username || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Attempting login for username:', username);

      // Query the users table using email as username
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('[Auth] Database query error:', error);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      if (!user) {
        console.error('[Auth] No user found for username:', username);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.error('[Auth] Password validation failed for user:', username);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Map the database fields to our User type
      const userData: User = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        unit: user.unit,
        active: user.active,
        name: user.name,
        created_at: user.created_at,
      };

      // Store user data in session
      if (req.session) {
        req.session.user = userData;
        console.log('[Auth] User data stored in session:', userData);
      }

      console.log('[Auth] Login successful for user:', username);
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