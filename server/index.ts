import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupAuth, sessionMiddleware } from './auth';
import { createWebSocketServer } from './websocket';

console.log('[Startup] Beginning server initialization');

// Verify required environment variables
const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('[Startup] Environment variables validated');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
    const app = express();
    console.log('[Startup] Express app created');

    // Security headers
    app.use(securityHeaders);

    // Body parsing middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Session middleware must be applied before any routes
    app.use(sessionMiddleware);
    console.log('[Startup] Core middleware initialized');

    // Serve static files from the public directory
    app.use(express.static(join(__dirname, '../client/public')));

    // Request logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;

      // Add detailed request logging only for API routes
      if (req.path.startsWith('/api')) {
        log(`[Request] ${req.method} ${path}`);
      }

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
        }
      });

      next();
    });

    console.log('[Startup] Request logging middleware configured');

    // Setup authentication before registering other routes
    console.log('[Startup] Setting up authentication...');
    await setupAuth(app);
    console.log('[Startup] Authentication setup complete');

    // Register API routes
    const server = await registerRoutes(app);
    console.log('[Startup] Routes registered successfully');

    // Error handling middleware
    app.use(errorMiddleware);

    // Create WebSocket server
    const wss = createWebSocketServer(server);
    console.log('[Startup] WebSocket server initialized on /ws');

    // Setup Vite or serve static files
    if (app.get("env") === "development") {
      console.log('[Startup] Setting up Vite development server...');
      await setupVite(app, server);
      console.log('[Startup] Vite setup complete');
    } else {
      serveStatic(app);
    }

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../client/index.html'));
    });

    // ALWAYS serve the app on port 5000
    const PORT = 5000;
    const HOST = '0.0.0.0'; // Bind to all network interfaces

    // Start the server
    server.listen(PORT, HOST, () => {
      console.log(`[Startup] Server running at http://${HOST}:${PORT}`);
    });

    // Add error handler for the server
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} is already in use`);
        process.exit(1);
      }
      console.error('[Error] Server error:', error);
    });

    return server;
  } catch (error) {
    console.error('[Error] Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('[Error] Failed to start server:', error);
  process.exit(1);
});