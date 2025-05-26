/**
 * Authentication Middleware - Re-exports from centralized authentication
 * 
 * @deprecated - Import directly from '../authentication' instead
 * This file is kept for backwards compatibility only
 */

export { 
  authenticateSession, 
  authenticateToken,
  requireAdmin,
  authLimiter,
  authenticateUser,
  type User,
  type AuthenticatedRequest
} from '../authentication';