/**
 * Authentication Middleware Exports 
 * 
 * This file now re-exports middleware functions from the centralized authentication.ts module.
 * Kept for backwards compatibility - prefer importing from '../authentication' directly.
 */

import type { Request, Response, NextFunction } from 'express';
import type { User as SchemaUser } from '../../shared/schema';
import { 
  authenticateToken, 
  requireAdmin
} from '../authentication';

// Define User type locally to avoid circular dependencies
export type User = Partial<SchemaUser>;

// Re-create the interface here to avoid circular dependencies
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json');

  try {
    if (!req.session?.user?.id) {
      console.log('[Auth] No valid user in session:', {
        sessionExists: !!req.session,
        userExists: !!req.session?.user
      });
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    req.user = req.session.user;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Re-export for backwards compatibility
export { 
  authenticateToken, 
  requireAdmin,
  authenticateSession
};

export default {
  authenticateToken,
  requireAdmin,
  authenticateSession
};