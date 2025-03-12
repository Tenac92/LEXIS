import { type Express } from "express";
import { createServer, type Server } from "http";
import { authenticateSession } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import documentsController from "./controllers/documentsController";
import budgetController from "./controllers/budgetController";
import generatedDocumentsRouter from "./controllers/generatedDocuments";
import unitsController from "./controllers/unitsController";
import usersController from "./controllers/usersController";
import projectsRouter from "./routes/projects";
import templatePreviewRouter from "./routes/template-preview";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Mount users routes
    log('[Routes] Setting up users routes...');
    app.use('/api/users', authenticateSession, usersController);
    log('[Routes] Users routes setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Project catalog routes - maintaining both /catalog and /projects endpoints for backwards compatibility
    app.use('/api/projects', authenticateSession, projectsRouter);
    app.use('/api/catalog', authenticateSession, projectsRouter);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    app.get('/api/budget/:mis', authenticateSession, budgetController.getBudget);
    app.post('/api/budget/validate', authenticateSession, budgetController.validateBudget);
    app.patch('/api/budget/:mis', authenticateSession, budgetController.updateBudget);
    app.get('/api/budget-history', authenticateSession, budgetController.getBudgetHistory);
    log('[Routes] Budget routes setup complete');

    // Documents routes - Register specific routes before general ones
    log('[Routes] Setting up document routes...');
    app.use('/api/documents/generated', authenticateSession, generatedDocumentsRouter);
    app.use('/api/documents', authenticateSession, documentsController);
    log('[Routes] Document routes setup complete');

    // Template preview route
    app.use('/api/templates', authenticateSession, templatePreviewRouter);

    // Units routes
    log('[Routes] Registering units routes...');
    app.use('/api/units', authenticateSession, unitsController);
    log('[Routes] Units routes registered');

    // Mount all API routes under /api
    app.use('/api', apiRouter);

    // Create and return HTTP server
    const httpServer = createServer(app);
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}