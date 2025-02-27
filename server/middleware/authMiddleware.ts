import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

interface AuthenticatedRequest extends Request {
  user?: User;
}

// List of routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me'
];

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

    // Add user to request
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', {
      id: req.user.id,
      role: req.user.role,
      units: req.user.units,
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

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.session?.user?.role || req.session.user.role !== "admin") {
      console.log('[Auth] Admin access denied:', {
        userRole: req.session?.user?.role,
        path: req.path
      });
      return res.status(403).json({ message: "Admin access required" });
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

export default {
  authenticateToken,
  requireAdmin,
};