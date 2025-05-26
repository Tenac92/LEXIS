/**
 * Legacy Health Check - DEPRECATED
 * 
 * @deprecated Use server/routes/health.ts instead
 * This file redirects to the enhanced health endpoint
 */

import { Router, Request, Response } from 'express';

export const router = Router();

// Redirect all routes to enhanced health endpoint
router.use('*', (_req: Request, res: Response) => {
  res.redirect(301, '/api/health');
});

export default router;