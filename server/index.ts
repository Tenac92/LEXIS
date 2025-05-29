import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/errorHandler";
import { securityHeaders } from "./middleware/securityHeaders";
// Import sessionMiddleware from the new centralized authentication module
import { sessionMiddleware } from './authentication';
import corsMiddleware from './middleware/corsMiddleware';
import { geoIpRestriction } from './middleware/geoIpMiddleware';
import sdegdaefkRootHandler from './middleware/sdegdaefk/rootHandler';
import { databaseErrorRecoveryMiddleware } from './middleware/databaseErrorRecovery';
import documentsPreHandler from './middleware/sdegdaefk/documentsPreHandler';
import { createWebSocketServer } from './websocket';
import { supabase, testConnection, resetConnectionPoolIfNeeded } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import { initializeScheduledTasks } from './services/schedulerService';

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
  'SESSION_SECRET'
];

// Extract Supabase credentials from DATABASE_URL if they're not already set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  if (process.env.DATABASE_URL) {
    console.log('[Startup] SUPABASE_URL or SUPABASE_KEY not found, trying to extract from DATABASE_URL');
    try {
      // Parse PostgreSQL URL format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
      const databaseUrl = process.env.DATABASE_URL;
      const urlPattern = /postgresql:\/\/postgres:(.+)@db\.(.+)\.supabase\.co/;
      const matches = databaseUrl.match(urlPattern);
      
      if (matches && matches.length >= 3) {
        const supabaseKey = matches[1]; // Password is the Supabase key
        const projectRef = matches[2]; // Project reference is part of hostname
        const supabaseUrl = `https://${projectRef}.supabase.co`;
        
        process.env.SUPABASE_URL = supabaseUrl;
        process.env.SUPABASE_KEY = supabaseKey;
        
        console.log(`[Startup] Successfully extracted Supabase credentials from DATABASE_URL`);
        console.log(`[Startup] SUPABASE_URL: ${supabaseUrl}`);
        console.log(`[Startup] SUPABASE_KEY: ${supabaseKey.substring(0, 4)}...${supabaseKey.substring(supabaseKey.length - 4)}`);
      } else {
        console.error('[Startup] Failed to extract Supabase credentials from DATABASE_URL');
        requiredEnvVars.push('SUPABASE_URL', 'SUPABASE_KEY');
      }
    } catch (error) {
      console.error('[Startup] Error extracting Supabase credentials:', error);
      requiredEnvVars.push('SUPABASE_URL', 'SUPABASE_KEY');
    }
  } else {
    requiredEnvVars.push('SUPABASE_URL', 'SUPABASE_KEY');
  }
}

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
    try {
      // Test database connection during startup with a short timeout to not block server startup
      console.log('[Startup] Testing database connection...');
      const dbConnected = await Promise.race([
        testConnection(2, 5000),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 7000))
      ]);
      
      if (!dbConnected) {
        console.warn('[Startup] WARNING: Initial database connection test failed or timed out!');
        console.warn('[Startup] The server will start anyway, and database functions will be retried at runtime');
        console.warn('[Startup] Database error handling will attempt to recover during runtime');
      } else {
        console.log('[Startup] Database connection successfully verified');
      }
    } catch (connErr) {
      console.error('[Startup] Error during database connection test:', connErr);
      console.warn('[Startup] The server will start anyway, and database functions will be retried at runtime');
    }

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
        // Security: Never log request headers in production (contains cookies, tokens, etc.)
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

    // Apply sdegdaefk.gr specific handlers
    app.use(sdegdaefkRootHandler);
    
    // Pre-handle sdegdaefk.gr document requests to prevent database errors 
    app.use(documentsPreHandler);

    // Authentication is handled by middleware and routes

    // Register API routes with enhanced error handling
    try {
      console.log('[Startup] Registering routes...');
      const server = await registerRoutes(app);
      console.log('[Startup] Routes registered successfully');

      // NOTE: The DIRECT document creation route has been moved to server/routes.ts
      // This improves maintainability and ensures proper middleware application
      
      // Database error recovery middleware (must come before the main error middleware)
      app.use(databaseErrorRecoveryMiddleware);
      console.log('[Startup] Database error recovery middleware applied');

      // Enhanced error handling with Supabase-specific error detection
      app.use(errorHandler);
      console.log('[Startup] Enhanced Supabase error handler applied');
      
      // Error handling is already applied above

      // Create WebSocket server with error handling
      try {
        const wss = createWebSocketServer(server);
        console.log('[Startup] WebSocket server initialized on /ws');
        
        // Connect WebSocket server to admin routes
        if (typeof (server as any).setWebSocketServer === 'function') {
          (server as any).setWebSocketServer(wss);
          console.log('[Startup] WebSocket server connected to admin routes');
        } else {
          console.warn('[Startup] Unable to connect WebSocket server to admin routes: setWebSocketServer method not found');
        }
        
        // Initialize scheduled tasks (including quarter transitions)
        initializeScheduledTasks(wss);
        console.log('[Startup] Scheduled tasks initialized including quarter transitions');
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
            
            // Set up periodic database health checks
            const DB_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
            console.log(`[Startup] Scheduling database health checks every ${DB_CHECK_INTERVAL/60000} minutes`);
            
            // Schedule database health checks to prevent connection timeouts
            setInterval(async () => {
              try {
                console.log('[Database] Running scheduled database health check...');
                // Reset the connection pool if needed
                resetConnectionPoolIfNeeded();
                
                // Test connection with short timeout
                const dbStatus = await testConnection(2, 5000);
                
                if (dbStatus) {
                  console.log('[Database] Scheduled health check: Database connection healthy');
                } else {
                  console.error('[Database] Scheduled health check: Database connection problem detected');
                }
              } catch (healthError) {
                console.error('[Database] Error during scheduled health check:', healthError);
              }
            }, DB_CHECK_INTERVAL);
            
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