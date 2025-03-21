import { type Express } from "express";
import { createServer, type Server } from "http";
import { authenticateSession } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import documentsRouter from "./controllers/documentsController";
import { router as budgetRouter } from "./controllers/budgetController";
import { router as generatedDocumentsRouter } from "./controllers/generatedDocuments";
import { router as unitsRouter } from "./controllers/unitsController";
import { router as usersRouter } from "./controllers/usersController";
import { router as projectRouter } from "./controllers/projectController";
import templatePreviewRouter from "./routes/template-preview";
import authRouter from "./routes/auth";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Authentication routes
    log('[Routes] Setting up authentication routes...');
    app.use('/api/auth', authRouter);
    log('[Routes] Authentication routes setup complete');

    // Mount users routes
    log('[Routes] Setting up users routes...');
    app.use('/api/users', authenticateSession, usersRouter);
    log('[Routes] Users routes setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Project catalog routes - maintaining both /catalog and /projects endpoints for backwards compatibility
    app.use('/api/projects', authenticateSession, projectRouter);
    app.use('/api/catalog', authenticateSession, projectRouter);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    app.use('/api/budget', authenticateSession, budgetRouter);
    log('[Routes] Budget routes setup complete');

    // Documents routes
    log('[Routes] Setting up document routes...');
    // Handle documents routes with proper authentication
    app.use('/api/documents', authenticateSession, documentsRouter);
    log('[Routes] Document routes setup complete');

    // Template preview route
    app.use('/api/templates', authenticateSession, templatePreviewRouter);

    // Units routes
    log('[Routes] Registering units routes...');
    app.use('/api/units', authenticateSession, unitsRouter);
    log('[Routes] Units routes registered');

    // Mount other API routes under /api - these don't conflict with the ones above
    app.use('/api', apiRouter);

    // Create and return HTTP server
    const httpServer = createServer(app);
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}