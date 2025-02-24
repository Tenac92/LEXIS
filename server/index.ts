import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupWebSocket } from './websocket';

// Verify required environment variables
const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security headers
app.use(securityHeaders);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from the public directory
app.use(express.static(join(__dirname, '../client/public')));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Add detailed request logging
  if (req.path.startsWith('/api')) {
    log(`[Request] ${req.method} ${path}`);
    log(`[Headers] ${JSON.stringify(req.headers)}`);
    if (req.method !== 'GET') {
      log(`[Body] ${JSON.stringify(req.body)}`);
    }
    log(`[Session] ${req.session ? 'Active' : 'Not initialized'}`);
    if (req.session?.user) {
      log(`[Session] User: ${JSON.stringify(req.session.user)}`);
    }
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  let server;
  try {
    log('[Startup] Initializing Express server...');
    server = await registerRoutes(app);
    log('[Startup] Routes registered successfully');

    // Set up WebSocket server
    setupWebSocket(server);
    log('[Startup] WebSocket server initialized');

    // Error handling middleware
    app.use(errorMiddleware);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      log('[Startup] Setting up Vite development server...');
      await setupVite(app, server);
      log('[Startup] Vite setup complete');
    } else {
      serveStatic(app);
    }

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../client/index.html'));
    });

    // Use port 5000 to match the expected configuration
    const PORT = parseInt(process.env.PORT || '5000', 10);
    const HOST = '0.0.0.0'; // Bind to all network interfaces

    // Add error handler for the server
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} is already in use`);
        process.exit(1);
      }
      console.error('[Error] Server error:', error);
    });

    // Start the server
    server.listen(PORT, HOST, () => {
      log(`[Startup] Server running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('[Error] Failed to start server:', error);
    process.exit(1);
  }
})();