import { Router } from 'express';
import generatedDocumentsRouter from '../controllers/generatedDocuments';
import { exportDocument } from './document-export';
import { authenticateSession } from '../auth';
import documentsController from '../controllers/documentsController';
import recipientsController from '../controllers/recipientsController';
import statsController from '../controllers/statsController';
import usersController from '../controllers/usersController';

const router = Router();

// Mount the generated documents router at /api/documents/generated
router.use('/documents/generated', authenticateToken, generatedDocumentsRouter);

// Mount other controllers
router.use('/documents', authenticateSession, documentsController);
router.use('/recipients', authenticateSession, recipientsController);
router.use('/stats', authenticateSession, statsController);
router.use('/users', authenticateSession, usersController);

// Document export routes 
router.get('/documents/generated/:id/export', authenticateSession, exportDocument);
router.post('/documents/generated/:id/export', authenticateSession, exportDocument);

export default router;