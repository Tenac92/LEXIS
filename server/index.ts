import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";

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
    server = await registerRoutes(app);

    // Error handling middleware
    app.use(errorMiddleware);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../client/index.html'));
    });

    // Get port from environment variable with fallback
    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0'; // Bind to all network interfaces

    // Kill any existing process on the port (if running on Unix-like system)
    try {
      const execSync = require('child_process').execSync;
      execSync(`kill $(lsof -t -i:${PORT}) 2>/dev/null || true`);
    } catch (error) {
      // Ignore errors if process killing fails or on Windows
      console.log('Port cleanup attempted');
    }

    // Add error handler for the server
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port or free up the current port.`);
        process.exit(1);
      }
      console.error('Server error:', error);
    });

    // Start the server
    server.listen(PORT, HOST, () => {
      log(`Server running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();