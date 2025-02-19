import { Router } from 'express';
import { exportDocument } from './document-export';
import { authenticateToken } from '../middleware/authMiddleware';
import generatedDocumentsRouter from '../controllers/generatedDocuments';

const router = Router();

// Generated documents routes
router.use('/documents/generated', generatedDocumentsRouter);

// Document export routes
router.get('/documents/generated/:id/export', authenticateToken, exportDocument);
router.post('/documents/generated/:id/export', authenticateToken, exportDocument);

export default router;