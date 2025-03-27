/**
 * Authentication Middleware Re-exports
 * 
 * This file centralizes authentication-related exports from the auth.ts file.
 * It allows middleware to be imported consistently from a single location.
 */

import { Request } from 'express';
import { 
  authenticateSession, 
  User,
  authLimiter,
  authenticateUser 
} from '../auth';

export { 
  authenticateSession, 
  authLimiter,
  authenticateUser,
  User
};

// Re-create the AuthenticatedRequest interface here to avoid circular dependencies
export interface AuthenticatedRequest extends Request {
  user?: User;
}