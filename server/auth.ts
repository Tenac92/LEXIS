import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/supabase";
import { User, loginSchema, registerSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SESSION_SECRET || "your-secret-key";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Middleware to verify JWT token
const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('[Auth] No authorization header');
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header missing',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    console.log('[Auth] Authorization header:', authHeader);

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('[Auth] No token found in header');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token required',
        code: 'TOKEN_MISSING'
      });
    }

    try {
      console.log('[Auth] Verifying token...');
      const decoded = jwt.verify(token, SECRET_KEY) as any;
      console.log('[Auth] Token decoded:', decoded);

      const { data: { user }, error } = await supabase.auth.getUser(decoded.email);

      if (error || !user) {
        console.log('[Auth] User not found in Supabase:', error);
        throw error || new Error('User not found');
      }

      req.user = user as User;
      console.log('[Auth] User authenticated:', req.user.email);
      next();
    } catch (error: any) {
      console.error('[Auth] Token verification error:', error);
      return res.status(401).json({
        status: 'error',
        message: error.message || 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    next(error);
  }
};

export async function setupAuth(app: Express) {
  // Middleware to check auth token
  app.use(authenticateToken);

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      console.log('[Auth] Registration attempt:', req.body);
      const parsed = registerSchema.safeParse(req.body);

      if (!parsed.success) {
        console.log('[Auth] Registration validation failed:', parsed.error);
        return res.status(400).json({
          error: { message: parsed.error.message }
        });
      }

      const { email, password, full_name } = parsed.data;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const { data, error } = await supabase.auth.signUp({
        email,
        password: hashedPassword,
        options: {
          data: {
            full_name,
            role: 'user'
          }
        }
      });

      if (error) {
        console.error('[Auth] Supabase registration error:', error);
        throw error;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: data.user?.id,
          email: data.user?.email,
          role: 'user',
          full_name
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      console.log('[Auth] Registration successful:', email);
      console.log('[Auth] Generated token:', token);

      res.status(201).json({ 
        user: {
          id: data.user?.id,
          email: data.user?.email,
          full_name,
          role: 'user'
        },
        token 
      });
    } catch (error: any) {
      console.error('[Auth] Registration error:', error);
      res.status(400).json({ 
        error: { 
          message: error.message || "Registration failed" 
        } 
      });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      console.log('[Auth] Login attempt:', req.body);
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        console.log('[Auth] Login validation failed:', parsed.error);
        return res.status(400).json({
          error: { message: parsed.error.message }
        });
      }

      const { email, password } = parsed.data;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('[Auth] Supabase login error:', error);
        throw error;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: data.user?.id,
          email: data.user?.email,
          role: data.user?.user_metadata?.role || 'user',
          full_name: data.user?.user_metadata?.full_name
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      console.log('[Auth] Login successful:', email);
      console.log('[Auth] Generated token:', token);

      res.json({ 
        user: {
          id: data.user?.id,
          email: data.user?.email,
          full_name: data.user?.user_metadata?.full_name,
          role: data.user?.user_metadata?.role || 'user'
        },
        token
      });
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      res.status(401).json({ 
        error: { 
          message: error.message === "Invalid login credentials" 
            ? "Invalid email or password" 
            : error.message || "Login failed"
        } 
      });
    }
  });

  // Verify token endpoint
  app.post("/api/verify", authenticateToken, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        message: "Invalid token",
        code: 'INVALID_TOKEN'
      });
    }
    res.json({ valid: true, user: req.user });
  });

  // Get current user endpoint
  app.get("/api/user", authenticateToken, (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: "Authentication required",
        code: 'AUTH_REQUIRED'
      });
    }
    res.json(req.user);
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
      res.status(500).json({ 
        error: { message: error.message || "Logout failed" } 
      });
    }
  });
}