import { Router, Request, Response } from 'express';
import { getDashboardStats } from './dashboard';

// Create and export the router
export const router = Router();

// Redirect stats requests to dashboard stats
router.get('/', async (req: Request, res: Response) => {
  try {
    await getDashboardStats(req, res);
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});