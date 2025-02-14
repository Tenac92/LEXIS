import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
    },
    name: 'sessionId', // Set a custom cookie name
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`[Auth] Attempting login for username: ${username}`);
        const user = await storage.getUserByUsername(username);

        if (!user) {
          console.log(`[Auth] User not found: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log(`[Auth] User found, verifying password`);
        const isValid = await comparePasswords(password, user.password);

        if (!isValid) {
          console.log(`[Auth] Invalid password for user: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log(`[Auth] Login successful for user: ${username}`);
        return done(null, user);
      } catch (err) {
        console.error(`[Auth] Error during login:`, err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log(`[Auth] Serializing user: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[Auth] Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`[Auth] User not found during deserialization: ${id}`);
        return done(new Error('User not found'));
      }
      done(null, user);
    } catch (err) {
      console.error(`[Auth] Error during deserialization:`, err);
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log(`[Auth] Registration attempt:`, req.body);
      const { username, password, full_name } = req.body;

      if (!username || !password || !full_name) {
        console.log(`[Auth] Registration failed: Missing required fields`);
        return res.status(400).json({ 
          message: "Username, password, and full name are required" 
        });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`[Auth] Registration failed: Username exists: ${username}`);
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        full_name,
        role: 'user'
      });

      console.log(`[Auth] User registered successfully: ${username}`);
      req.login(user, (err) => {
        if (err) {
          console.error(`[Auth] Login after registration failed:`, err);
          return next(err);
        }
        return res.status(201).json(user);
      });
    } catch (err) {
      console.error(`[Auth] Registration error:`, err);
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log(`[Auth] Login attempt:`, req.body);

    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error(`[Auth] Login error:`, err);
        return next(err);
      }
      if (!user) {
        console.log(`[Auth] Authentication failed:`, info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error(`[Auth] Session creation failed:`, err);
          return next(err);
        }
        console.log(`[Auth] Login successful for user: ${user.username}`);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const username = req.user?.username;
    console.log(`[Auth] Logout attempt for user: ${username}`);

    req.logout((err) => {
      if (err) {
        console.error(`[Auth] Logout error:`, err);
        return next(err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error(`[Auth] Session destruction error:`, err);
          return next(err);
        }
        console.log(`[Auth] Logout successful for user: ${username}`);
        res.clearCookie('sessionId');
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log(`[Auth] Unauthenticated request to /api/user`);
      return res.sendStatus(401);
    }
    console.log(`[Auth] Authenticated user request: ${req.user?.username}`);
    res.json(req.user);
  });
}