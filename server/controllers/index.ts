import express from 'express';
import { authenticateSession } from '../auth';
import { router as documentsRouter } from './documentsController';
import { router as budgetRouter } from './budgetController';
import { router as recipientsRouter } from './recipientsController';
import { router as statsRouter } from './statsController';
import { router as usersRouter } from './usersController';
import { router as projectRouter } from './projectController';

const router = express.Router();

// Mount budget routes
router.use('/budget', authenticateSession, budgetRouter);

// Mount other controllers with authentication middleware
router.use('/documents', authenticateSession, documentsRouter);
router.use('/recipients', authenticateSession, recipientsRouter);
router.use('/stats', authenticateSession, statsRouter);
router.use('/users', authenticateSession, usersRouter);
router.use('/projects', authenticateSession, projectRouter);

// Healthcheck endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling for unmatched routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
router.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);

  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

export default router;