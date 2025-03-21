import express from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { setupVite, serveStatic } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupAuth, sessionMiddleware } from './auth';
import { createWebSocketServer } from './websocket';
import router from './routes/index';

console.log('[Startup] Beginning server initialization');

// Verify required environment variables
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
    const app = express();

    // Trust proxy with detailed logging
    app.set('trust proxy', 1);

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
    console.log('[Startup] Body parsing middleware configured');

    // Session middleware (before routes)
    app.use(sessionMiddleware);
    console.log('[Startup] Session middleware initialized');

    // Setup authentication
    await setupAuth(app);
    console.log('[Startup] Authentication setup complete');

    // Apply security headers
    app.use(securityHeaders);
    console.log('[Startup] Security headers applied');

    // Mount API routes BEFORE Vite middleware
    app.use('/', router);
    console.log('[Startup] API routes mounted');

    // In development, setup Vite AFTER API routes
    if (app.get("env") === "development") {
      await setupVite(app);
      console.log('[Startup] Vite development server initialized');
    } else {
      serveStatic(app);
    }

    // Error handling middleware
    app.use(errorMiddleware);

    // Catch-all route for SPA must be LAST
    app.get('*', (req, res) => {
      // Only handle HTML requests, let API requests fall through
      if (req.accepts('html')) {
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(join(__dirname, '../client/index.html'));
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    // Start the server
    const PORT = 5000;
    const HOST = '0.0.0.0';

    const server = app.listen(PORT, HOST, () => {
      console.log(`[Startup] Server running at http://${HOST}:${PORT}`);
      console.log('[Startup] Environment:', app.get('env'));
    });

    // Initialize WebSocket server
    try {
      const wss = createWebSocketServer(server);
      console.log('[Startup] WebSocket server initialized');
    } catch (wsError) {
      console.error('[Warning] WebSocket initialization failed:', wsError);
    }

    return server;
  } catch (error) {
    console.error('[Fatal] Server initialization failed:', error);
    throw error;
  }
}

// Start server with error handling
startServer().catch((error) => {
  console.error('[Fatal] Failed to start server:', {
    message: error.message,
    stack: error.stack,
    cause: error.cause
  });
  process.exit(1);
});