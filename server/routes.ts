import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { authenticateToken } from "./middleware/authMiddleware";
import documentsController from "./controllers/documentsController";
import recipientsController from "./controllers/recipientsController";
import statsController from "./controllers/statsController";
import usersController from "./controllers/usersController";
import generatedDocuments from "./controllers/generatedDocuments";
import attachments from "./controllers/attachments";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes first
  setupAuth(app);

  // API routes
  app.use('/api/documents', authenticateToken, documentsController);
  app.use('/api/recipients', authenticateToken, recipientsController);
  app.use('/api/stats', authenticateToken, statsController);
  app.use('/api/users', authenticateToken, usersController);
  app.use('/api/generated', authenticateToken, generatedDocuments);
  app.use('/api/attachments', authenticateToken, attachments);

  const httpServer = createServer(app);
  return httpServer;
}