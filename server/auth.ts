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
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'Username and password are required' }
      });
    }
    try {
      console.log('[Auth] Login attempt:', req.body);
      const result = loginSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: { message: 'Invalid login data' }
        });
      }

      const { username, password } = result.data;

      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

      if (!user || user.length === 0) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      const isValidPassword = await bcrypt.compare(password, user[0].password);

      if (!isValidPassword) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      const token = jwt.sign(
        { userId: user[0].id },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      res.json({
        user: {
          id: user[0].id,
          username: user[0].username,
          full_name: user[0].full_name || user[0].username.split('@')[0],
          role: user[0].role,
          unit: user[0].unit
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
      const result = registerSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: { message: 'Invalid registration data' }
        });
      }

      const { username, password, full_name, unit } = result.data;
      const existingUser = await db.select().from(users).where(eq(users.username, username));

      if (existingUser.length > 0) {
        return res.status(400).json({
          error: { message: 'User already exists' }
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        username,
        password: hashedPassword,
        full_name,
        unit,
        role: 'user'
      }).returning();

      const token = jwt.sign(
        { userId: newUser.id },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: {
          id: newUser.id,
          username: newUser.username,
          full_name: newUser.full_name || username.split('@')[0],
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
      username: req.user.username,
      full_name: req.user.full_name || req.user.username.split('@')[0],
      role: req.user.role,
      unit: req.user.unit
    });
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });
}