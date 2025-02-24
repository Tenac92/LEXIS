import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    console.log('[Auth] Checking session:', {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionID: req.sessionID
    });

    if (!req.session?.user) {
      console.log('[Auth] No user in session');
      return res.status(401).json({ message: "Authentication required" });
    }

    // Add user to request
    req.user = req.session.user;
    console.log('[Auth] User authenticated:', {
      id: req.user.id,
      role: req.user.role,
      sessionID: req.sessionID
    });

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.user?.role || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export default {
  authenticateToken,
  requireAdmin,
};