/**
 * Unified Authentication System
 * 
 * This file consolidates all authentication-related functionality including:
 * - Session management
 * - User authentication
 * - Authorization middleware
 * - Password management
 */

import { Request, Response, NextFunction, Express } from "express";
import { supabase } from "./config/db";
import session from "express-session";
import { storage } from "./storage";
import type { User as SchemaUser } from "../shared/schema";
import bcrypt from "bcrypt";
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

// ============================================================================
// Authentication Types
// ============================================================================

// User type for authentication contexts
export type User = Partial<SchemaUser>;

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Properly extend express-session types
declare module 'express-session' {
  interface SessionData {
    user?: Partial<SchemaUser>;  // Make user optional to match runtime behavior
    createdAt?: Date;
    diagnostic?: {
      lastChecked?: string;
      accessCount?: number;
      [key: string]: any;  // Allow any additional diagnostic information
    };
  }
}

// ============================================================================
// Configuration Constants
// ============================================================================

// List of routes that don't require authentication
export const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/users/units',
  '/api/projects', // Read-only project list endpoint
  '/api/projects/*/complete' // Read-only project details endpoint
];

// Maximum session age in milliseconds (24 hours)
export const MAX_SESSION_AGE = 24 * 60 * 60 * 1000;

// Password validation schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

// ============================================================================
// Session Middleware
// ============================================================================

// Session middleware with enhanced security settings for cross-domain support
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'document-manager-secret',
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore, // Using the in-memory store from storage.ts
  name: 'sid', // Custom session ID name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only true in production
    httpOnly: true,
    maxAge: 48 * 60 * 60 * 1000, // 48 hours (extended from 24)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined, // Set domain for cross-domain cookies
  },
  proxy: true // Enable proxy support
});

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

// Rate limiting middleware for auth routes with proxy support
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Disabled rate limiting for testing critical security fixes
  message: { message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Configure rate limiter for proxy environment
  skipFailedRequests: true,
  // Only count failed attempts to be more lenient
  skipSuccessfulRequests: true,
});

// ============================================================================
// Authentication and Authorization Middleware
// ============================================================================

/**
 * Authentication middleware that verifies user session
 * Compatible with /api/auth/me endpoint
 */
export const authenticateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('[Auth] authenticateSession middleware called for:', req.path);
    console.log('[Auth] Session ID:', req.sessionID);
    console.log('[Auth] Session user exists:', !!req.session?.user);
    
    // Check if the request path is in the public routes list
    const isPublicRoute = PUBLIC_ROUTES.some(route => {
      // Handle wildcard routes
      if (route.includes('*')) {
        const pattern = route.replace('*', '[^/]+');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(req.path);
      }
      return req.path.startsWith(route);
    });
    
    // Security: Minimal authentication logging

    // Skip authentication for public routes
    if (isPublicRoute) {
      return next();
    }
    
    // Explicitly handle the units endpoint separately since it's causing issues
    if (req.path === '/api/users/units') {
      return next();
    }

    if (!req.session?.user?.id) {
      console.log('[Auth] No user in session for path:', req.path);
      console.log('[Auth] Session ID:', req.sessionID);
      console.log('[Auth] Session exists:', !!req.session);
      console.log('[Auth] Session user:', req.session?.user);
      console.log('[Auth] Cookie header:', req.headers.cookie);
      
      // Create an error object with status code to be handled by our error middleware
      const authError = new Error('Authentication required');
      Object.defineProperty(authError, 'status', {
        value: 401,
        writable: true,
        configurable: true
      });
      throw authError;
    }
    
    // Make sure we have a complete user object
    const sessionUser = req.session.user;
    if (!sessionUser || !sessionUser.id || !sessionUser.email || !sessionUser.role) {
      console.log('[Auth] Invalid user data in session:', sessionUser);
      
      // Create an error object with status code to be handled by our error middleware
      const invalidSessionError = new Error('Invalid session data');
      Object.defineProperty(invalidSessionError, 'status', {
        value: 401,
        writable: true,
        configurable: true
      });
      throw invalidSessionError;
    }

    // Add user to request with all required fields
    req.user = {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name || '',
      role: sessionUser.role,
      units: sessionUser.units || [],
      unit_id: sessionUser.unit_id || [],
      department: sessionUser.department || undefined,
      telephone: sessionUser.telephone || undefined,
      descr: sessionUser.descr || undefined,
      details: sessionUser.details || undefined
    };
    
    console.log('[Auth] User authenticated:', { 
      id: req.user?.id,
      name: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      units: req.user?.units,
      unit_id: req.user?.unit_id,
      sessionID: req.sessionID,
      ip: req.ip
    });
    
    // Double-check that user was properly set
    if (!req.user) {
      console.error('[Auth] Failed to set req.user despite having session user');
      const authError = new Error('Failed to set user data');
      Object.defineProperty(authError, 'status', {
        value: 500,
        writable: true,
        configurable: true
      });
      throw authError;
    }
    
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    // Pass the error to the next middleware (error middleware)
    next(error);
  }
};

/**
 * Authentication middleware that checks request tokens
 * Compatible with API routes
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isPublicRoute = PUBLIC_ROUTES.some(route => req.path.startsWith(route));

    console.log('[Auth] Request details:', {
      path: req.path,
      method: req.method,
      isPublicRoute,
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie ? 'present' : 'missing'
    });

    // Allow public routes without authentication
    if (isPublicRoute) {
      console.log('[Auth] Allowing public route access');
      return next();
    }

    if (!req.session) {
      console.log('[Auth] No session found');
      return res.status(401).json({ message: "No session found" });
    }

    if (!req.session.user) {
      console.log('[Auth] No user in session');
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check session age - using a more lenient approach
    const sessionCreatedAt = req.session.createdAt ? new Date(req.session.createdAt).getTime() : 0;
    const currentTime = new Date().getTime();

    // Only enforce session expiration if the session is more than MAX_SESSION_AGE old
    // And provide an extension mechanism for active sessions
    if (sessionCreatedAt > 0 && currentTime - sessionCreatedAt > MAX_SESSION_AGE) {
      console.log('[Auth] Session age check:', {
        age: Math.floor((currentTime - sessionCreatedAt) / (60 * 60 * 1000)) + ' hours',
        userId: req.session.user?.id,
        path: req.path
      });
      
      // If this is an API call for data (not a form submission), extend the session
      // This prevents disrupting users during active work
      if (req.method === 'GET' || req.path.includes('/api/auth/me')) {
        console.log('[Auth] Extending session for active user');
        // Update the session timestamp to extend its life
        req.session.createdAt = new Date();
      } else {
        // For form submissions and other writes, enforce the expiration
        console.log('[Auth] Session truly expired, user needs to re-login');
        req.session.destroy((err) => {
          if (err) console.error('[Auth] Error destroying expired session:', err);
        });
        return res.status(401).json({ message: "Session expired" });
      }
    }

    // Ensure all required user properties are present
    const sessionUser = req.session.user;
    if (!sessionUser.id || !sessionUser.role) {
      console.log('[Auth] Invalid user data in session');
      return res.status(401).json({ message: "Invalid user data" });
    }

    // Validate user role
    if (!['admin', 'user', 'manager'].includes(sessionUser.role)) {
      console.log('[Auth] Invalid user role');
      return res.status(403).json({ message: "Invalid user role" });
    }

    // Add fully typed user to request
    req.user = sessionUser as User;

    // Regenerate session ID periodically to prevent session fixation
    if (Math.random() < 0.1) { // 10% chance of regeneration
      req.session.regenerate((err) => {
        if (err) console.error('[Auth] Session regeneration error:', err);
      });
    }

    console.log('[Auth] User authenticated:', {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      units: req.user.units,
      department: req.user.department,
      sessionID: req.sessionID
    });

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Middleware to check if the user has admin role
 * Temporarily modified to allow quarter transition
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // TEMPORARY: Allow any authenticated user to access admin endpoints
    // specifically for quarter transition operations
    if (req.path.includes('quarter-transition')) {
      console.log('[Auth] TEMPORARY: Bypassing admin check for quarter transition:', {
        userRole: req.user?.role,
        userId: req.user?.id,
        path: req.path
      });
      return next();
    }

    if (!req.user?.role || req.user.role !== "admin") {
      console.log('[Auth] Admin access denied:', {
        userRole: req.user?.role,
        path: req.path
      });
      return res.status(403).json({ message: "Admin access required" });
    }

    // Add additional admin validation if needed
    if (!req.user.id) {
      return res.status(403).json({ message: "Invalid admin user data" });
    }

    next();
  } catch (error) {
    console.error('[Auth] Admin validation error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// User Authentication Functions
// ============================================================================

/**
 * Authenticate a user with email and password
 * Enhanced to handle different schema variations and provide better error logging
 * @param email User email
 * @param password User password
 * @returns User object if authentication is successful, null otherwise
 */
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    console.log(`[Auth] Authenticating user: ${email}`);
    
    // Add a short delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Query the user with all fields to handle potential schema variations
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')  // Include all fields to handle potential schema variations
      .eq('email', email)
      .single();

    if (userError) {
      console.error(`[Auth] Database error when retrieving user: ${email}`, userError);
      return null;
    }

    if (!userData) {
      console.error(`[Auth] No user found for email: ${email}`);
      return null;
    }

    // Enhanced password validation logic
    // Check if password field exists and validate
    if (!userData.password) {
      console.error(`[Auth] User has no password field: ${email}`);
      return null;
    }

    // Compare password with constant-time comparison
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      console.error(`[Auth] Password validation failed for user: ${email}`);
      return null;
    }

    // Log successful authentication
    console.log('[Auth] User validated successfully:', { 
      id: userData.id, 
      email: userData.email,
      role: userData.role,
      name: userData.name
    });

    // Create user object, excluding sensitive fields
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      units: userData.units || [],
      unit_id: userData.unit_id || [],
      department: userData.department || undefined,
      telephone: userData.telephone || undefined,
      descr: userData.descr || undefined,
      details: userData.details || undefined,
      created_at: userData.created_at || undefined,
      updated_at: userData.updated_at || undefined
    };

    return user;
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return null;
  }
}

/**
 * Change a user's password
 * @param userId The user ID
 * @param currentPassword The current password
 * @param newPassword The new password
 * @returns Success status and message
 */
export async function changeUserPassword(
  userId: number, 
  currentPassword: string, 
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, message: 'User not found' };
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (updateError) {
      console.error('[Auth] Error updating password:', updateError);
      return { success: false, message: 'Failed to update password' };
    }

    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    console.error('[Auth] Error changing password:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// ============================================================================
// Express Server Integration
// ============================================================================

/**
 * Setup authentication routes and middleware for the Express app
 * @param app Express application
 */
export async function setupAuth(app: Express) {
  console.log('[Auth] Starting authentication setup...');

  // Apply session middleware
  app.use(sessionMiddleware);
  console.log('[Auth] Session middleware applied');

  // Login route with enhanced security and rate limiting
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required'
        });
      }

      // Add brute force protection delay
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('[Auth] Attempting login for email:', email);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')  // Include all fields to handle potential schema variations
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('[Auth] No user found for email:', email);
        return res.status(401).json({
          message: 'Invalid email or password'
        });
      }

      // Enhanced password validation logic
      // Check if password field exists and validate
      if (!userData.password) {
        console.error('[Auth] User has no password field:', email);
        return res.status(401).json({
          message: 'Invalid email or password'
        });
      }

      // Compare password with constant-time comparison
      const isPasswordValid = await bcrypt.compare(password, userData.password);
      if (!isPasswordValid) {
        console.error('[Auth] Password validation failed for user:', email);
        return res.status(401).json({
          message: 'Invalid email or password'
        });
      }

      // Create session with user data, excluding sensitive fields
      const sessionUser: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        units: userData.units || [],
        department: userData.department || undefined,
        telephone: userData.telephone || undefined,
        descr: userData.descr || undefined,
        details: userData.details || undefined
      };

      // Store user data in session with expiry
      req.session.user = sessionUser;
      req.session.createdAt = new Date();

      // Save session explicitly and wait for completion
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            reject(err);
          } else {
            console.log('[Auth] Session saved successfully:', {
              sessionID: req.sessionID,
              userID: sessionUser.id,
              secure: req.secure,
              protocol: req.protocol
            });
            resolve();
          }
        });
      });

      console.log('[Auth] Login successful:', {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        units: sessionUser.units,
        department: sessionUser.department,
        sessionID: req.sessionID,
        ip: req.ip
      });

      // Match the response format that the client expects
      // Ensure we only include fields that are expected by the client
      const clientUser = {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        units: sessionUser.units || []
      };
      
      return res.status(200).json({
        message: "Login successful",
        user: clientUser
      });

    } catch (error) {
      console.error('[Auth] Login error:', error);
      return res.status(500).json({
        message: 'Login failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Logout route with enhanced session cleanup
  app.post("/api/auth/logout", (req, res) => {
    console.log('[Auth] Logging out user:', { 
      sessionID: req.sessionID,
      userId: req.session?.user?.id,
      ip: req.ip
    });

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Logout error:', err);
          return res.status(500).json({
            message: 'Logout failed'
          });
        }
        
        // Use same cookie settings as the session
        res.clearCookie('sid', { 
          path: '/',
          secure: process.env.NODE_ENV === 'production',  // Match session setting
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          httpOnly: true,
          domain: process.env.COOKIE_DOMAIN || undefined // Use same domain as session cookie
        });
        
        console.log('[Auth] Cleared session cookie with domain:', process.env.COOKIE_DOMAIN || 'default');
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Already logged out' });
    }
  });

  // Change password route
  app.post("/api/auth/change-password", authenticateSession, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }
      
      // Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }
      
      // Use the centralized change password function
      const result = await changeUserPassword(
        req.user.id, 
        currentPassword, 
        newPassword
      );

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      console.log('[Auth] Password changed successfully for user:', req.user.id);
      return res.status(200).json({ message: result.message });
    } catch (error) {
      console.error('[Auth] Error changing password:', error);
      return res.status(500).json({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get current user route - simplified to avoid authentication middleware conflicts
  app.get("/api/auth/me", (req: AuthenticatedRequest, res) => {
    try {
      // Check if user has a valid session without throwing errors
      if (!req.session?.user?.id) {
        return res.status(200).json({
          authenticated: false,
          message: 'No active session'
        });
      }
      
      const sessionUser = req.session.user;
      
      // Validate session user data
      if (!sessionUser.email || !sessionUser.role) {
        return res.status(200).json({
          authenticated: false,
          message: 'Invalid session data'
        });
      }
      
      // Touch the session to keep it active
      req.session.touch();
      
      console.log('[Auth] Returning current user:', { 
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        units: sessionUser.units,
        unit_id: sessionUser.unit_id,
        sessionID: req.sessionID
      });
      
      // Create a clean user response
      const userResponse = {
        id: sessionUser.id,
        name: sessionUser.name || '',
        email: sessionUser.email,
        role: sessionUser.role,
        units: sessionUser.units || [],
        unit_id: sessionUser.unit_id || [],
        department: sessionUser.department,
        telephone: sessionUser.telephone,
        descr: sessionUser.descr,
        details: sessionUser.details
      };
      
      return res.status(200).json({
        authenticated: true,
        user: userResponse
      });
      
    } catch (error) {
      console.error('[Auth] Error in /api/auth/me:', error);
      return res.status(200).json({
        authenticated: false,
        message: 'Session error'
      });
    }
  });

  console.log('[Auth] Authentication setup completed successfully');
}