import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import bcrypt from "bcrypt";
import type { User } from "@shared/schema";
import session from "express-session";
import { MemoryStore } from "express-session";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Session middleware
const sessionMiddleware = session({
  secret: 'your-secret-key', // In production, use environment variable
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore(),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Authentication middleware - checks session instead of credentials
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }
    req.user = req.session.user;
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

      // Query our custom auth.users table
      const { data: user, error } = await supabase
        .from('auth.users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        console.error('User lookup error:', error);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Verify password using bcrypt
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        console.error('Password validation failed for user:', email);
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
      req.session.user = userData;

      res.json(userData);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", (req, res) => {
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