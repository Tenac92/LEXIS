/**
 * API Routes Index
 * Centralizes all API route definitions
 */

import { Router } from 'express';
import { log } from '../../vite';
import { authenticateSession, requireAdmin } from '../../auth';

// Import route modules
import authRoutes from './auth';
import projectRoutes from './projects';
import documentRoutes from './documents';
import budgetRoutes from './budget';
import usersRoutes from './users';
import dashboardRoutes from './dashboard';
import attachmentsRoutes from './attachments';
import unitsRoutes from './units';
import templateRoutes from './templates';

// Create main router
const router = Router();

// Apply authentication middleware to all API routes except those in auth
router.use((req, res, next) => {
  // Skip auth routes and OPTIONS requests (for CORS)
  if (req.path.startsWith('/auth') || req.method === 'OPTIONS') {
    return next();
  }
  
  authenticateSession(req, res, next);
});

// Register route groups
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/documents', documentRoutes);
router.use('/budget', budgetRoutes);
router.use('/users', usersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/attachments', attachmentsRoutes);
router.use('/units', unitsRoutes);
router.use('/templates', templateRoutes);

// Error handling for API routes
router.use((err: any, req: any, res: any, next: any) => {
  log(`[API Error] ${err.message || 'Unknown error'}`, 'error');
  console.error('[API Error]', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'An unexpected error occurred',
      status: err.status || 500,
      path: req.path
    }
  });
});

export default router;