import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import { authenticateSession } from "./auth";
import documentsController from "./controllers/documentsController";
import unitsController from "./controllers/unitsController";
import projectsController from "./controllers/projectsController";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Set up authentication routes and middleware
    log('[Routes] Setting up authentication...');
    await setupAuth(app);
    log('[Routes] Authentication setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Documents routes - make sure this is registered before the general apiRouter
    app.use('/api/documents', authenticateSession, documentsController);

    // Units and Projects routes
    log('[Routes] Registering units and projects routes...');
    app.use('/api/units', authenticateSession, unitsController);
    app.use('/api/projects', authenticateSession, projectsController);
    log('[Routes] Units and projects routes registered');

    // Mount all API routes under /api
    app.use('/api', apiRouter);

    // Create and return HTTP server
    const httpServer = createServer(app);
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error);
    throw error;
  }
}