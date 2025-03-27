/**
 * Authentication Middleware Re-exports
 * 
 * This file centralizes authentication-related exports from the authentication.ts file.
 * It allows middleware to be imported consistently from a single location.
 */

import type { Request } from 'express';
import type { User as SchemaUser } from '../../shared/schema';
import { 
  authenticateSession, 
  authenticateToken,
  requireAdmin,
  authLimiter,
  authenticateUser
} from '../authentication';

// Define User type locally to avoid circular dependencies
export type User = Partial<SchemaUser>;

// Re-create the interface here to avoid circular dependencies
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export { 
  authenticateSession, 
  authenticateToken,
  requireAdmin,
  authLimiter,
  authenticateUser
};