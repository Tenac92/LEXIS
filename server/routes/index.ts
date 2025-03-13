import { Router } from 'express';
import { documentExportRouter } from './document-export';
import { authenticateSession } from '../middleware/auth';
import budgetRouter from './budget';
import templateController from '../controllers/templateController';

const router = Router();

// Mount routers
router.use('/documents', authenticateSession, documentExportRouter);
router.use('/budget', authenticateSession, budgetRouter);
router.use('/templates', authenticateSession, templateController);

export default router;