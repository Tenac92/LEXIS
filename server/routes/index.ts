import { Router } from 'express';
import { documentExportRouter } from './document-export';
import { authenticateSession } from '../middleware/auth';
import budgetRouter from './budget';
import templateController from '../controllers/templateController';
import { router as documentsController } from '../controllers/documentsController';
import { router as generatedDocumentsRouter } from '../controllers/generatedDocuments';

const router = Router();

// Mount routers
router.use('/documents', authenticateSession, documentsController);
router.use('/documents/generated', authenticateSession, generatedDocumentsRouter);
router.use('/documents/export', authenticateSession, documentExportRouter);
router.use('/budget', authenticateSession, budgetRouter);
router.use('/templates', authenticateSession, templateController);

export default router;