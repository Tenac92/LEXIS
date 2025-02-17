import { Request, Response, NextFunction, Express } from "express";
import { User, loginSchema, registerSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SECRET_KEY = process.env.SESSION_SECRET || "your-secret-key";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

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

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authorization header format',
        code: 'INVALID_AUTH_HEADER'
      });
    }

    const token = authHeader.split(' ')[1];
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

      // Find user in database
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (!user || user.length === 0) {
        console.log('[Auth] User not found in database');
        throw new Error('User not found');
      }

      req.user = user[0];
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

      // Find user
      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (userResult.length === 0) {
        return res.status(401).json({
          error: { message: "Invalid email or password" }
        });
      }

      const user = userResult[0];

      // Verify password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: { message: "Invalid email or password" }
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          units: user.units,
          department: user.department
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      console.log('[Auth] Login successful:', email);
      console.log('[Auth] Generated token:', token);

      res.json({ 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          units: user.units,
          department: user.department
        },
        token
      });
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      res.status(401).json({ 
        error: { 
          message: error.message || "Login failed"
        } 
      });
    }
  });

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

      const { email, password, name, units, telephone, department } = parsed.data;

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({
          error: { message: "Email already registered" }
        });
      }

      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db.insert(users).values({
        email,
        password: hashedPassword,
        name,
        role: 'user',
        units,
        telephone,
        department
      }).returning();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          units: newUser.units,
          department: newUser.department
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      console.log('[Auth] Registration successful:', email);
      console.log('[Auth] Generated token:', token);

      res.status(201).json({ 
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          units: newUser.units,
          department: newUser.department
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
  app.post("/api/logout", (req, res) => {
    res.sendStatus(200);
  });
}