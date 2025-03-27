/**
 * Authentication Middleware Re-exports
 * 
 * This file centralizes authentication-related exports from the auth.ts file.
 * It allows middleware to be imported consistently from a single location.
 */

import { Request } from 'express';
import type { User as SchemaUser } from "@shared/schema.unified";
import { 
  authenticateSession, 
  authLimiter,
  authenticateUser 
} from '../auth';

// Define User type from schema
export type User = Partial<SchemaUser>;

export { 
  authenticateSession, 
  authLimiter,
  authenticateUser
};

// Re-create the AuthenticatedRequest interface here to avoid circular dependencies
export interface AuthenticatedRequest extends Request {
  user?: User;
}