import { Request, Response, NextFunction, Express } from "express";
import { User } from "@shared/schema";
import bcrypt from "bcrypt";
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      console.log('[Auth] No session');
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }

    console.log('[Auth] Session found:', { userId: req.session.userId });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      console.log('[Auth] User not found in database');
      return res.status(401).json({
        error: { message: 'User not found' }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      error: { message: 'Authentication failed' }
    });
  }
};

export async function setupAuth(app: Express) {
  // Configure session middleware
  app.use(session({
    store: new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        console.log('[Auth] Missing credentials:', { email: !!email, password: !!password });
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      console.log('[Auth] Login attempt:', { email });

      // Find user by email (stored in username field)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, email));

      if (!user) {
        console.log('[Auth] User not found:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare passwords
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        console.log('[Auth] Invalid password for user:', email);
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      console.log('[Auth] Login successful:', { userId: user.id, email });

      // Set user session
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        user: {
          id: user.id,
          email: user.username,
          full_name: user.full_name || null,
          role: user.role,
          unit: user.unit
        }
      });
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
      res.clearCookie('connect.sid');
      res.sendStatus(200);
    });
  });

  app.get("/api/user", authenticateSession, (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        error: { message: 'Not authenticated' }
      });
    }

    res.json(req.user);
  });
}