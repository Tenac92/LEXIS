import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import { authenticateSession } from "./auth";
import documentsController from "./controllers/documentsController";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  await setupAuth(app);

  // Dashboard routes
  app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

  // Documents routes - make sure this is registered before the general apiRouter
  app.use('/api/documents', authenticateSession, documentsController);

  // Mount all API routes under /api
  app.use('/api', apiRouter);

  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}