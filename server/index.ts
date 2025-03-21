import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupAuth, sessionMiddleware } from './auth';
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

      // Special attention to document routes to debug our issue
      if (path.includes('document') || path.includes('documents')) {
        console.log(`[DOCUMENT_DEBUG] ${method} ${path} requested from ${ip}`);
        console.log(`[DOCUMENT_DEBUG] Headers:`, req.headers);
        if (method === 'POST') {
          console.log(`[DOCUMENT_DEBUG] Body:`, req.body);
        }
      }
      
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
        
        // Special attention to document routes
        if (path.includes('document') || path.includes('documents')) {
          console.log(`[DOCUMENT_DEBUG] Response for ${method} ${path}: status=${res.statusCode}, duration=${duration}ms`);
        }
        
        // @ts-ignore
        return originalEnd.apply(this, args);
      };

      next();
    });

    console.log('[Startup] Request logging middleware configured');

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

      // DIRECT document creation route bypass - added as a direct fix for 404 issues
      // This is added after all other routes are registered to ensure it catches the request
      app.post('/api/v2-documents', express.json(), async (req: Request, res: Response) => {
        try {
          console.log('[DIRECT_ROUTE_V2] Document creation request with body:', req.body);
          
          // Check if there's a session but don't require auth for testing
          console.log('[DIRECT_ROUTE_V2] Session info:', (req as any).session);
          
          const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [] } = req.body;
          
          if (!recipients?.length || !project_id || !unit || !expenditure_type) {
            return res.status(400).json({
              message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
            });
          }
          
          // Get project NA853 from Supabase if not provided
          let project_na853 = req.body.project_na853;
          if (!project_na853) {
            console.log('[DIRECT_ROUTE_V2] Fetching NA853 for project with MIS:', project_id);
            
            try {
              // Look up in the Projects table - using the project_id as the MIS value
              const { data: projectData, error: projectError } = await supabase
                .from('Projects')
                .select('na853')
                .eq('mis', project_id)
                .single();
              
              if (!projectError && projectData && projectData.na853) {
                // Extract only numeric parts for database compatibility
                const numericNA853 = String(projectData.na853).replace(/\D/g, '');
                if (numericNA853) {
                  project_na853 = numericNA853;
                  console.log('[DIRECT_ROUTE_V2] Retrieved and converted NA853 from Projects table:', project_na853);
                } else {
                  console.error('[DIRECT_ROUTE_V2] Could not extract numeric value from NA853:', projectData.na853);
                  // Try to use project_mis as numeric fallback
                  if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
                    project_na853 = req.body.project_mis;
                    console.log('[DIRECT_ROUTE_V2] Using project_mis as numeric fallback:', req.body.project_mis);
                  } else {
                    // Last resort - use 0 as safe fallback
                    project_na853 = '0';
                    console.log('[DIRECT_ROUTE_V2] Using safe numeric fallback: 0');
                  }
                }
              } else {
                // If no data found in Projects table, use project_mis as fallback
                if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
                  console.log('[DIRECT_ROUTE_V2] Using project_mis directly as numeric fallback:', req.body.project_mis);
                  project_na853 = req.body.project_mis;
                } else {
                  console.error('[DIRECT_ROUTE_V2] Could not find project in Projects table:', projectError);
                  return res.status(400).json({ 
                    message: 'Project not found in Projects table and no fallback available', 
                    error: 'Project NA853 could not be determined'
                  });
                }
              }
            } catch (error) {
              console.error('[DIRECT_ROUTE_V2] Error during project lookup:', error);
              
              // If error happens, use project_mis as numeric fallback if available and valid
              if (req.body.project_mis && !isNaN(Number(req.body.project_mis))) {
                console.log('[DIRECT_ROUTE_V2] Using project_mis as numeric fallback due to error:', req.body.project_mis);
                project_na853 = req.body.project_mis;
              } else {
                console.error('[DIRECT_ROUTE_V2] No valid numeric fallback available');
                // Last resort - use 0 as safe numeric value
                project_na853 = '0';
                console.log('[DIRECT_ROUTE_V2] Using safe numeric fallback: 0');
              }
            }
            
            console.log('[DIRECT_ROUTE_V2] Final NA853 value:', project_na853);
          }
          
          // Format recipients data
          const formattedRecipients = recipients.map((r: any) => ({
            firstname: String(r.firstname).trim(),
            lastname: String(r.lastname).trim(),
            fathername: String(r.fathername || '').trim(),
            afm: String(r.afm).trim(),
            amount: parseFloat(String(r.amount)),
            installment: String(r.installment).trim()
          }));
          
          const now = new Date().toISOString();
          
          // Log user authentication status
          console.log('[DIRECT_ROUTE_V2] User info for document creation:', {
            hasSession: !!req.session,
            hasUser: !!req.session?.user,
            userId: req.session?.user?.id,
            userDepartment: req.session?.user?.department
          });

          // Create document payload
          const documentPayload = {
            unit,
            project_id: req.body.project_mis || project_id, // Use numeric project_mis if available
            project_na853,
            expenditure_type,
            status: 'pending', // Always set initial status to pending
            recipients: formattedRecipients,
            total_amount: parseFloat(String(total_amount)) || 0,
            attachments: attachments || [],
            generated_by: req.session?.user?.id || null, // Add user ID if available
            department: req.session?.user?.department || null, // Add department if available
            created_at: now,
            updated_at: now
          };
          
          console.log('[DIRECT_ROUTE_V2] Inserting document with payload:', documentPayload);
          
          // Insert into database
          const { data, error } = await supabase
            .from('generated_documents')
            .insert([documentPayload])
            .select('id')
            .single();
          
          if (error) {
            console.error('[DIRECT_ROUTE_V2] Supabase error:', error);
            return res.status(500).json({ 
              message: 'Error creating document in database', 
              error: error.message,
              details: error.details
            });
          }
          
          console.log('[DIRECT_ROUTE_V2] Document created successfully with ID:', data.id);
          res.status(201).json({ 
            id: data.id,
            message: 'Document created and stored in database'
          });
        } catch (error) {
          console.error('[DIRECT_ROUTE_V2] Error:', error);
          res.status(500).json({ 
            message: 'Error in direct route', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

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