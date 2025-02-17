import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import apiRouter from "./controllers";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  await setupAuth(app);

  // Mount all API routes under /api
  app.use('/api', apiRouter);

  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}