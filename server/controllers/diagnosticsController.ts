/**
 * Diagnostics Controller
 * 
 * Contains routes for system diagnostics and debugging information.
 * Used for monitoring, troubleshooting, and development purposes.
 */

import { Router, Request, Response } from 'express';
import { log } from '../vite';
import { authenticateSession, requireAdmin } from '../authentication';

// Create the router
export const router = Router();

// Export the router as default
export default router;

/**
 * GET /api/diagnostics/routes
 * Returns information about all registered routes in the application
 * Useful for API documentation and debugging
 */
router.get('/routes', requireAdmin, (req: Request, res: Response) => {
  try {
    log(`[Diagnostics] Route listing requested by admin`);
    
    // Get the main Express app from the request
    const app = req.app;
    const routes: any[] = [];
    
    // Helper function to extract routes from the router stack
    const extractRoutes = (stack: any[], basePath = '') => {
      stack.forEach(layer => {
        if (layer.route) {
          // It's a route
          const path = basePath + (layer.route?.path || '');
          const methods = Object.keys(layer.route.methods)
            .filter(method => layer.route.methods[method])
            .map(method => method.toUpperCase());
          
          routes.push({
            path,
            methods,
            middleware: layer.route.stack
              .map((handler: any) => handler.name || 'anonymous')
              .filter((name: string) => name !== 'bound dispatch')
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          // It's a sub-router
          const path = basePath + (layer.regexp ? layer.regexp.toString().replace(/[?^${}()|[\]\\]/g, '') : '');
          extractRoutes(layer.handle.stack, path);
        } else if (layer.name !== 'bound dispatch') {
          // It's middleware
          routes.push({
            path: basePath + (layer.regexp ? layer.regexp.toString().replace(/[?^${}()|[\]\\]/g, '') : ''),
            type: 'middleware',
            name: layer.name || 'anonymous',
          });
        }
      });
    };
    
    // Get routes from main app
    if (app._router && app._router.stack) {
      extractRoutes(app._router.stack);
    }
    
    return res.status(200).json({
      routes: routes.filter(r => r.path && r.path !== '/'),
      count: routes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log(`[Diagnostics] Error getting route listing: ${error.message}`, 'error');
    
    return res.status(500).json({
      error: 'Failed to list routes',
      message: error.message
    });
  }
});