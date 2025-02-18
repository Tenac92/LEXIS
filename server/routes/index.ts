import { Router } from 'express';
import { exportDocument } from './document-export';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Document export routes
router.get('/documents/generated/:id/export', authenticateToken, exportDocument);
router.post('/documents/generated/:id/export', authenticateToken, exportDocument);

export default router;