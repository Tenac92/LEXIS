import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./db";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@/lib/types";
import bcrypt from "bcrypt";

// Session middleware with enhanced security
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'document-manager-secret', // In production, use environment variable
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  name: 'sid', // Custom session ID cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
});

// Authentication middleware - checks session instead of credentials
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Auth] Checking session:', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie
    });

    if (!req.session?.user) {
      console.log('[Auth] No user in session');
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }

    // Add user to request
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', {
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID,
      path: req.path
    });

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

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Attempting login for email:', email);

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        console.error('[Auth] No user found for email:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.error('[Auth] Password validation failed for user:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Map the database fields to our User type
      const userData: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      // Store user data in session
      req.session.user = userData;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('[Auth] Login successful for user:', {
        id: userData.id,
        role: userData.role,
        sessionID: req.sessionID,
        cookies: res.getHeader('set-cookie')
      });

      res.json(userData);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    console.log('[Auth] Logout request received:', {
      hasSession: !!req.session,
      sessionID: req.sessionID
    });

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
      res.clearCookie('sid');
      res.sendStatus(200);
    });
  });

  app.get("/api/user", authenticateSession, (req: Request, res: Response) => {
    console.log('[Auth] User data requested:', {
      hasUser: !!req.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie
    });
    res.json(req.user);
  });
}