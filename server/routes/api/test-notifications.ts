/**
 * Test Notifications Routes
 * Routes for creating and testing budget notifications
 */

import { Router } from 'express';
import { authenticateSession, requireAdmin } from '../../authentication';
import { createTestReallocationNotifications } from '../../services/budgetNotificationService';
import { log } from '../../vite';

const router = Router();

/**
 * POST /api/test-notifications/create
 * Creates test budget notifications for demonstration
 */
router.post('/create', authenticateSession, requireAdmin, async (req, res) => {
  try {
    log('[TestNotifications] Admin creating test notifications...', 'info');
    
    await createTestReallocationNotifications();
    
    res.json({
      success: true,
      message: 'Test notifications created successfully'
    });
    
  } catch (error) {
    log(`[TestNotifications] Error creating test notifications: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Failed to create test notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router };
export default router;