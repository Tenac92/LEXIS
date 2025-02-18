import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import type { User } from "@shared/schema";

// Add type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: { message: 'Authentication required' }
    });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: { message: 'Invalid token' }
      });
    }

    // Transform Supabase user to our User type
    req.user = {
      id: user.id,
      email: user.email,
      role: 'user',
      created_at: user.created_at,
    };

    next();
  } catch (error) {
    console.error('[Auth] Session authentication error:', error);
    return res.status(500).json({
      error: { message: 'Authentication failed' }
    });
  }
};

export async function setupAuth(app: Express) {
  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        role: 'user',
        created_at: data.user.created_at,
      };

      res.json(user);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        error: { message: 'Logout failed' }
      });
    }

    res.sendStatus(200);
  });

  app.get("/api/user", authenticateSession, (req, res) => {
    res.json(req.user);
  });
}