import express from 'express';
import { authenticateSession } from '../auth';
import documentsController from './documentsController';
import recipientsController from './recipientsController';
import statsController from './statsController';
import usersController from './usersController';
import authController from './authController';

const router = express.Router();

// Mount auth controller without authentication middleware
router.use('/auth', authController);

// Mount other controllers with authentication middleware
router.use('/documents', authenticateSession, documentsController);
router.use('/recipients', authenticateSession, recipientsController);
router.use('/stats', authenticateSession, statsController);
router.use('/users', authenticateSession, usersController);

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