import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import apiRouter from "./controllers";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes first
  await setupAuth(app);

  // Mount all API routes under /api
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}