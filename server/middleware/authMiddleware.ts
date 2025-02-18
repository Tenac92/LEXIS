import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check if there's a user object in the session
  if (!req.session?.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  req.user = req.session.user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export default {
  authenticateToken,
  requireAdmin,
};