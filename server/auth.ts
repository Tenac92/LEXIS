import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import bcrypt from "bcrypt";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
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
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    // Verify password using bcrypt
    const isValid = await bcrypt.compare(password, user.encrypted_password);
    if (!isValid) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      error: { message: 'Authentication failed' }
    });
  }
};

export async function setupAuth(app: Express) {
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
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Verify password using bcrypt
      const isValid = await bcrypt.compare(password, user.encrypted_password);
      if (!isValid) {
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

      res.json(userData);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session?.destroy((err) => {
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