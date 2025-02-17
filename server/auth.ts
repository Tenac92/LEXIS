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
  // Configure session middleware with secure settings
  app.use(session({
    store: new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'development-secret-key',
    name: 'session_id', // Custom cookie name
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
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      // Find user by email (stored in username field)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, email));

      if (!user) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare passwords
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Set user session
      req.session.userId = user.id;

      // Wait for session to be saved before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Return user data without sensitive information
      res.json({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Logout error:', err);
          return res.status(500).json({
            error: { message: 'Logout failed' }
          });
        }
        res.clearCookie('session_id');
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(200);
    }
  });

  // Protected route to get current user data
  app.get("/api/user", authenticateSession, (req, res) => {
    const user = req.user!;
    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    });
  });
}