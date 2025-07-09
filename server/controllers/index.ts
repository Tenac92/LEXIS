import express from 'express';
import { authenticateSession } from '../authentication';
import documentsRouter from './documentsController';
import { router as budgetRouter } from './budgetController';
import { router as recipientsRouter } from './recipientsController';
// statsController removed - functionality moved to dashboard
import { router as usersRouter } from './usersController';
import { router as projectRouter } from './projectController';
import { router as beneficiaryRouter } from './beneficiaryController';
import { errorHandler, asyncHandler } from '../middleware/errorHandler';
import expenditureTypesController from './expenditureTypesController';

const router = express.Router();

// Mount budget routes
router.use('/budget', authenticateSession, budgetRouter);

// Register the consolidated documents controller
router.use('/documents', authenticateSession, documentsRouter);
router.use('/recipients', authenticateSession, recipientsRouter);
router.use('/users', authenticateSession, usersRouter);
router.use('/projects', authenticateSession, projectRouter);
router.use('/beneficiaries', authenticateSession, beneficiaryRouter);

// Add expenditure types routes
router.get('/expenditure-types', authenticateSession, expenditureTypesController.getExpenditureTypes);
router.get('/expenditure-types/:id', authenticateSession, expenditureTypesController.getExpenditureTypeById);
router.post('/expenditure-types', authenticateSession, expenditureTypesController.createExpenditureType);
router.put('/expenditure-types/:id', authenticateSession, expenditureTypesController.updateExpenditureType);
router.delete('/expenditure-types/:id', authenticateSession, expenditureTypesController.deleteExpenditureType);

// Public expenditure types endpoint for forms
router.get('/public/expenditure-types', expenditureTypesController.getExpenditureTypesForFilter);

// Healthcheck endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling for unmatched routes
router.use('*', (req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler with enhanced error handling
router.use(errorHandler);

export default router;