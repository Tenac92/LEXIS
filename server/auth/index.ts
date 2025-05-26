/**
 * Legacy Auth Module - DEPRECATED
 * 
 * @deprecated Use server/authentication.ts instead
 * This file is kept for backwards compatibility only
 */

export { 
  sessionMiddleware, 
  authLimiter,
  authenticateSession,
  requireAdmin,
  authenticateUser,
  type User as AuthUser,
  type AuthenticatedRequest
} from '../authentication';