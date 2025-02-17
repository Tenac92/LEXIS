import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/supabase";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function setupAuth(app: Express) {
  // Middleware to check Supabase session
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error) throw error;
      if (user) req.user = user as User;

      next();
    } catch (error) {
      console.error('[Auth] Session verification error:', error);
      next();
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      console.log('[Auth] Registration attempt:', req.body);
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({
          message: "Email, password, and full name are required"
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role: 'user'
          }
        }
      });

      if (error) throw error;

      console.log('[Auth] Registration successful:', email);
      res.status(201).json({ data: { user: data.user, session: data.session }, error: null });
    } catch (error: any) {
      console.error('[Auth] Registration error:', error);
      res.status(400).json({ data: null, error: { message: error.message } });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      console.log('[Auth] Login attempt:', req.body);
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required"
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      console.log('[Auth] Login successful:', email);
      res.json({ data: { user: data.user, session: data.session }, error: null });
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      res.status(401).json({ data: null, error: { message: error.message } });
    }
  });

  // Logout endpoint
  app.post("/api/logout", async (req, res) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      console.log('[Auth] Logout successful');
      res.sendStatus(200);
    } catch (error: any) {
      console.error('[Auth] Logout error:', error);
      res.status(500).json({ data: null, error: { message: error.message } });
    }
  });

  // Get current user endpoint
  app.get("/api/user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.log('[Auth] No authorization header');
        return res.sendStatus(401);
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error) throw error;
      if (!user) {
        console.log('[Auth] No user found');
        return res.sendStatus(401);
      }

      console.log('[Auth] User found:', user.email);
      res.json(user);
    } catch (error: any) {
      console.error('[Auth] Error getting user:', error);
      res.status(401).json({ message: error.message });
    }
  });
}