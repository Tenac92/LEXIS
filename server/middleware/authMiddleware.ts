/**
 * Authentication Middleware Exports 
 * 
 * This file now re-exports middleware functions from the centralized authentication.ts module.
 * Kept for backwards compatibility - prefer importing from '../authentication' directly.
 */

import type { Request } from 'express';
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

// Re-export for backwards compatibility
export { 
  authenticateToken, 
  requireAdmin
};

export default {
  authenticateToken,
  requireAdmin,
};