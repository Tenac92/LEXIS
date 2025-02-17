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

const SECRET_KEY = process.env.SESSION_SECRET || 'your-secret-key';

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
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));

      if (!user) {
        console.log('[Auth] User not found from token');
        return res.status(401).json({
          error: { message: 'User not found' }
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('[Auth] Token verification error:', error);
      return res.status(401).json({
        error: { message: 'Invalid token' }
      });
    }
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
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Login attempt for:', username);

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

      if (!isValidPassword) {
        console.log('[Auth] Invalid password for user:', username);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id },
        SECRET_KEY,
        { expiresIn: '24h' }
      );

      // Send response
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
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, full_name, unit } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      // Check if user exists
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
        username: email,
        password: hashedPassword,
        full_name: full_name || null,
        unit: unit || null,
        role: 'user'
      }).returning();

      // Generate token
      const token = jwt.sign(
        { userId: newUser.id },
        SECRET_KEY,
        { expiresIn: '24h' }
      );

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
        error: { message: 'Registration failed' }
      });
    }
  });

  app.get("/api/user", authenticateToken, (req, res) => {
    try {
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
    } catch (error) {
      console.error('[Auth] User fetch error:', error);
      res.status(500).json({
        error: { message: 'Failed to fetch user data' }
      });
    }
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });
}