import { Router } from 'express';
import { documentExportRouter } from './document-export';
import { authenticateSession } from '../auth';
import budgetRouter from './budget';
import templateController from '../controllers/templateController';
import { router as documentsRouter } from '../controllers/documentsController';
import { router as generatedDocumentsRouter } from '../controllers/generatedDocuments';

const router = Router();

// Mount routers with /api prefix and authentication
router.use('/api/documents', authenticateSession, documentsRouter);
router.use('/api/documents/generated', authenticateSession, generatedDocumentsRouter);
router.use('/api/documents/export', authenticateSession, documentExportRouter);
router.use('/api/budget', authenticateSession, budgetRouter);
router.use('/api/templates', authenticateSession, templateController);

// Debug logging for mounted routes
console.log('[Routes] API endpoints mounted:', [
  '/api/documents',
  '/api/documents/generated',
  '/api/documents/export',
  '/api/budget',
  '/api/templates'
]);

export default router;