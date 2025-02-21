import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import { authenticateSession } from "./auth";
import documentsController from "./controllers/documentsController";
import budgetController from "./controllers/budgetController";
import generatedDocumentsRouter from "./controllers/generatedDocuments";
import unitsController from "./controllers/unitsController";
import { listProjects, getExpenditureTypes, exportProjectsXLSX, bulkUpdateProjects } from "./controllers/projectController";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Set up authentication routes and middleware
    log('[Routes] Setting up authentication...');
    await setupAuth(app);
    log('[Routes] Authentication setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Project catalog routes
    app.get('/api/catalog', authenticateSession, listProjects);
    app.get('/api/catalog/:mis/expenditure-types', authenticateSession, getExpenditureTypes);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    app.get('/api/budget/:mis', authenticateSession, budgetController.getBudget);
    app.post('/api/budget/validate', authenticateSession, budgetController.validateBudget);
    app.patch('/api/budget/:mis', authenticateSession, budgetController.updateBudget);
    // Add the missing budget history route
    app.get('/api/budget/history', authenticateSession, budgetController.getBudgetHistory);
    log('[Routes] Budget routes setup complete');

    // Documents routes
    app.use('/api/documents', authenticateSession, documentsController);
    app.use('/api/documents/generated', authenticateSession, generatedDocumentsRouter);

    // Units and Projects routes
    log('[Routes] Registering units and projects routes...');
    app.use('/api/units', authenticateSession, unitsController);
    app.get('/api/projects', authenticateSession, listProjects);
    app.get('/api/projects/export/xlsx', authenticateSession, exportProjectsXLSX);
    app.put('/api/projects/bulk-update', authenticateSession, bulkUpdateProjects);
    log('[Routes] Units and projects routes registered');

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