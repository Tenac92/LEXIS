import { Router } from 'express';
import { exportDocument } from './document-export';

const router = Router();

// Other routes...

router.post('/documents/generated/:id/export', exportDocument);

export default router;
