import { Router } from 'express';
import generatedDocumentsRouter from '../controllers/generatedDocuments';
import { exportDocument } from './document-export';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Mount the generated documents router at /api/documents/generated
router.use('/documents/generated', generatedDocumentsRouter);

// Document export routes 
router.get('/documents/generated/:id/export', authenticateToken, exportDocument);
router.post('/documents/generated/:id/export', authenticateToken, exportDocument);

export default router;