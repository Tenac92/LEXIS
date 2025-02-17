import { Request, Response, NextFunction, Express } from "express";
import { User } from "@shared/schema";
import bcrypt from "bcrypt";
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool, db } from "./config/db";

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
    console.log('[Auth] Checking session:', { 
      sessionId: req.sessionID,
      userId: req.session.userId 
    });

    if (!req.session.userId) {
      console.log('[Auth] No user ID in session');
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    console.log('[Auth] User lookup result:', { 
      userId: req.session.userId,
      found: !!user 
    });

    if (!user) {
      return res.status(401).json({
        error: { message: 'User not found' }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Session authentication error:', error);
    return res.status(500).json({
      error: { message: 'Authentication failed' }
    });
  }
};

export async function setupAuth(app: Express) {
  app.use(session({
    store: new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60
    }),
    secret: process.env.SESSION_SECRET || 'development-secret-key',
    name: 'session_id',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      console.log('[Auth] Login attempt received:', { 
        email: req.body.email,
        hasPassword: !!req.body.password
      });

      const { email, password } = req.body;

      if (!email || !password) {
        console.log('[Auth] Missing credentials');
        return res.status(400).json({
          error: { message: 'Email and password are required' }
        });
      }

      // Find user by email (stored in username field)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, email));

      console.log('[Auth] Database lookup result:', { 
        email,
        userFound: !!user
      });

      if (!user) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Compare passwords
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log('[Auth] Password validation:', { 
        email,
        isValid: isValidPassword
      });

      if (!isValidPassword) {
        return res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }

      // Set user session
      req.session.userId = user.id;

      // Wait for session to be saved
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            reject(err);
          } else {
            console.log('[Auth] Session saved successfully:', { 
              sessionId: req.sessionID,
              userId: user.id
            });
            resolve();
          }
        });
      });

      // Return user data
      const userData = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      };

      console.log('[Auth] Login successful:', userData);
      res.json(userData);

    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed' }
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    console.log('[Auth] Logout request received:', { 
      sessionId: req.sessionID,
      userId: req.session.userId
    });

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Logout error:', err);
          return res.status(500).json({
            error: { message: 'Logout failed' }
          });
        }
        res.clearCookie('session_id');
        console.log('[Auth] Logout successful');
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(200);
    }
  });

  // Get current user data
  app.get("/api/user", authenticateSession, (req, res) => {
    const user = req.user!;
    const userData = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };

    console.log('[Auth] User data retrieved:', userData);
    res.json(userData);
  });
}