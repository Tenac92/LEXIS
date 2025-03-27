import { Router } from 'express';
import { 
  changePasswordSchema, 
  changeUserPassword, 
  authenticateSession
} from '../authentication';
import type { AuthenticatedRequest } from '../authentication';

const router = Router();

// Change password route
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: 'Invalid input',
        errors: validation.error.errors
      });
    }

    const { currentPassword, newPassword } = validation.data;
    
    // Use the centralized change password function
    const result = await changeUserPassword(
      req.user.id, 
      currentPassword, 
      newPassword
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('[Auth] Error changing password:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;