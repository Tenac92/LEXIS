import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupAuth, sessionMiddleware } from './auth';
import corsMiddleware from './middleware/corsMiddleware';
import { geoIpRestriction } from './middleware/geoIpMiddleware';
import sdegdaefkRootHandler from './middleware/sdegdaefk/rootHandler';
import { createWebSocketServer } from './websocket';
import { supabase } from './config/db';

// Enhanced error handlers
process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught Exception:', error);
  // Log additional context if available
  if (error.stack) {
    console.error('[Fatal] Stack trace:', error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', {
    promise,
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack
    } : reason
  });
  process.exit(1);
});

console.log('[Startup] Beginning server initialization');

// Verify required environment variables with detailed logging
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SESSION_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('[Fatal] Missing required environment variables:', missingVars);
  process.exit(1);
}

console.log('[Startup] Environment variables validated');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
    const app = express();
    console.log('[Startup] Express app created');

    // Enable trust proxy with detailed logging
    app.set('trust proxy', 1);
    console.log('[Startup] Trust proxy enabled with level:', app.get('trust proxy'));

    // Apply security headers
    app.use(securityHeaders);
    console.log('[Startup] Security headers applied');
    
    // Apply CORS middleware for sdegdaefk.gr
    app.use(corsMiddleware);
    console.log('[Startup] CORS middleware for sdegdaefk.gr applied');
    
    // Apply GeoIP restriction middleware to limit access to Greece only
    app.use(geoIpRestriction);
    console.log('[Startup] GeoIP restriction middleware applied (Greece only)');

    // Body parsing middleware with size limits
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
    console.log('[Startup] Body parsing middleware configured');

    // Session middleware must be applied before any routes
    app.use(sessionMiddleware);
    console.log('[Startup] Session middleware initialized');

    // Serve static files with proper security headers
    app.use(express.static(join(__dirname, '../client/public'), {
      maxAge: '1d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    }));

    // Enhanced request logging middleware with detailed debugging
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      const ip = req.ip;
      const method = req.method;

      // Document route logging is handled by the standard logging system
      
      if (path.startsWith('/api')) {
        log(`[Request] ${method} ${path} from ${ip}`);
        if (path !== '/api/auth/me') { // Don't log auth check details
          console.log('[Request] Headers:', req.headers);
        }
      }

      // Capture response information for better debugging
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          log(`${method} ${path} ${res.statusCode} in ${duration}ms`);
        }
        
        // Document route responses are now handled by the standard logging system
        
        // @ts-ignore
        return originalEnd.apply(this, args);
      };

      next();
    });

    console.log('[Startup] Request logging middleware configured');
    
    // Apply sdegdaefk.gr root path handler
    app.use(sdegdaefkRootHandler);
    console.log('[Startup] sdegdaefk.gr root path handler applied');

    // Setup authentication with enhanced error handling
    try {
      console.log('[Startup] Setting up authentication...');
      await setupAuth(app);
      console.log('[Startup] Authentication setup complete');
    } catch (authError) {
      console.error('[Fatal] Authentication setup failed:', authError);
      throw authError;
    }

    // Register API routes with enhanced error handling
    try {
      console.log('[Startup] Registering routes...');
      const server = await registerRoutes(app);
      console.log('[Startup] Routes registered successfully');

      // NOTE: The DIRECT document creation route has been moved to server/routes.ts
      // This improves maintainability and ensures proper middleware application

      // Error handling middleware
      app.use(errorMiddleware);

      // Create WebSocket server with error handling
      try {
        const wss = createWebSocketServer(server);
        console.log('[Startup] WebSocket server initialized on /ws');
      } catch (wsError) {
        console.error('[Warning] WebSocket server initialization failed:', wsError);
        // Continue without WebSocket support
      }

      // Setup Vite or serve static files
      if (app.get("env") === "development") {
        console.log('[Startup] Setting up Vite development server...');
        await setupVite(app, server);
        console.log('[Startup] Vite setup complete');
      } else {
        serveStatic(app);
      }

      // Catch-all route for SPA with proper content headers
      app.get('*', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(join(__dirname, '../client/index.html'));
      });

      // ALWAYS serve the app on port 5000
      const PORT = 5000;
      const HOST = '0.0.0.0'; // Bind to all network interfaces

      // Start the server with enhanced error handling
      return new Promise((resolve, reject) => {
        try {
          const serverInstance = server.listen(PORT, HOST, () => {
            console.log(`[Startup] Server running at http://${HOST}:${PORT}`);
            console.log('[Startup] Environment:', app.get('env'));
            console.log('[Startup] Node version:', process.version);
            resolve(serverInstance);
          });

          // Add error handler for the server
          serverInstance.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
              console.error(`[Fatal] Port ${PORT} is already in use`);
              reject(error);
            } else {
              console.error('[Fatal] Server error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
              });
              reject(error);
            }
          });

          // Handle graceful shutdown
          process.on('SIGTERM', () => {
            console.log('[Shutdown] Received SIGTERM signal');
            serverInstance.close(() => {
              console.log('[Shutdown] Server closed');
              process.exit(0);
            });
          });

        } catch (error) {
          console.error('[Fatal] Failed to start server:', error);
          reject(error);
        }
      });

    } catch (routesError) {
      console.error('[Fatal] Routes registration failed:', routesError);
      throw routesError;
    }

  } catch (error) {
    console.error('[Fatal] Server initialization failed:', error);
    throw error;
  }
}

// Start server with comprehensive error handling
startServer().catch((error) => {
  console.error('[Fatal] Failed to start server:', {
    message: error.message,
    stack: error.stack,
    cause: error.cause
  });
  process.exit(1);
});