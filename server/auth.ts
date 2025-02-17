import { Request, Response, NextFunction, Express } from "express";
import { User, loginSchema, registerSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const SECRET_KEY = process.env.SESSION_SECRET;

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('[Auth] No token provided');
      return res.status(401).json({
        error: { message: 'No token provided' }
      });
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY) as { userId: number };
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (!user || user.length === 0) {
        console.log('[Auth] User not found');
        return res.status(401).json({
          error: { message: 'User not found' }
        });
      }

      req.user = user[0];
      next();
    } catch (error) {
      console.error('[Auth] Token verification error:', error);
      return res.status(401).json({
        error: { message: 'Invalid token' }
      });
    }
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    next(error);
  }
};

export async function setupAuth(app: Express) {
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Login attempt:', { email: username });

      // Find user by email (stored in username field)
      const [user] = await db.select().from(users).where(eq(users.username, username));

      if (!user) {
        console.log('[Auth] User not found:', username);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare passwords
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log('[Auth] Password validation:', { isValid: isValidPassword });

      if (!isValidPassword) {
        console.log('[Auth] Password validation failed for user:', username);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      // Send success response
      res.json({
        user: {
          id: user.id,
          email: user.username,
          full_name: user.full_name || user.username.split('@')[0],
          role: user.role,
          unit: user.unit
        },
        token
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, full_name, unit } = req.body;

      // Validate input
      const [existingUser] = await db.select().from(users).where(eq(users.username, email));

      if (existingUser) {
        return res.status(400).json({
          error: { message: 'User already exists' }
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db.insert(users).values({
        username: email, // Store email in username field
        password: hashedPassword,
        full_name,
        unit,
        role: 'user'
      }).returning();

      // Generate token
      const token = jwt.sign(
        { userId: newUser.id },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      // Send success response
      res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.username,
          full_name: newUser.full_name || email.split('@')[0],
          role: newUser.role,
          unit: newUser.unit
        },
        token
      });
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  });

  app.get("/api/user", authenticateToken, (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        error: { message: 'Not authenticated' }
      });
    }

    res.json({
      id: req.user.id,
      email: req.user.username,
      full_name: req.user.full_name || req.user.username.split('@')[0],
      role: req.user.role,
      unit: req.user.unit
    });
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });
}