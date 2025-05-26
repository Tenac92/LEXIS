/**
 * Legacy Auth Routes - DEPRECATED
 * 
 * @deprecated Use server/routes/api/auth.ts instead
 * This file is kept for backwards compatibility only
 */

import { Router } from 'express';

const router = Router();

// Redirect to new auth API routes
router.use('*', (req, res) => {
  res.status(301).redirect(`/api/auth${req.originalUrl}`);
});

export default router;