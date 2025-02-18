import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";

const router = Router();

// Redirecting to the main documents controller
router.get('/', authenticateToken, async (req, res) => {
  return res.redirect('/api/documents');
});

export default router;