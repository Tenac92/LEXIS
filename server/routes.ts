import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { authenticateSession } from "./auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
import { router as budgetRouter } from "./controllers/budgetController";
import { router as generatedDocumentsRouter } from "./controllers/generatedDocuments";
import { router as unitsRouter } from "./controllers/unitsController";
import { router as usersRouter } from "./controllers/usersController";
import { router as projectRouter } from "./controllers/projectController";
import templatePreviewRouter from "./routes/template-preview";
import authRouter from "./routes/auth";
import documentsRouter from "./routes/documents"; // Import from our new dedicated route file
import { log } from "./vite";
import { supabase } from "./config/db";
import { User } from "../shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // IMPORTANT: Register direct document creation route first to bypass any routing conflicts
    app.post('/api/documents', authenticateSession, async (req: Request & { user?: User }, res: Response) => {
      try {
        console.log('[DIRECT_ROUTE] Document creation request received:', JSON.stringify(req.body));

        if (!req.user?.id) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const { unit, project_id, expenditure_type, recipients, total_amount, attachments } = req.body;

        if (!recipients?.length || !project_id || !unit || !expenditure_type) {
          return res.status(400).json({
            message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
          });
        }

        // Get project NA853
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('na853')
          .eq('mis', project_id)
          .single();

        if (projectError || !projectData) {
          return res.status(404).json({ message: 'Project not found', error: projectError?.message });
        }

        // Format recipients data
        const formattedRecipients = recipients.map((r: any) => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          fathername: String(r.fathername).trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          installment: String(r.installment).trim()
        }));

        const now = new Date().toISOString();

        // Create document with exact schema match and set initial status to pending
        const documentPayload = {
          unit,
          project_id,
          project_na853: projectData.na853,
          expenditure_type,
          status: 'pending', // Always set initial status to pending
          recipients: formattedRecipients,
          total_amount: parseFloat(String(total_amount)) || 0,
          generated_by: req.user.id,
          department: req.user.department || null,
          contact_number: req.user.telephone || null,
          user_name: req.user.name || null,
          attachments: attachments || [],
          created_at: now,
          updated_at: now
        };

        console.log('[DIRECT_ROUTE] Document payload prepared:', documentPayload);

        // Insert into database
        const { data, error } = await supabase
          .from('generated_documents')
          .insert([documentPayload])
          .select('id')
          .single();

        if (error) {
          console.error('[DIRECT_ROUTE] Error creating document:', error);
          return res.status(500).json({ 
            message: 'Error creating document', 
            error: error.message,
            details: error.details
          });
        }

        console.log('[DIRECT_ROUTE] Document created successfully:', data.id);
        res.status(201).json({ id: data.id });
      } catch (error) {
        console.error('[DIRECT_ROUTE] Error creating document:', error);
        res.status(500).json({ 
          message: 'Error creating document', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Test diagnostics route
    app.get('/api/test-route', (req, res) => {
      console.log('[TEST] Test route accessed');
      res.status(200).json({ message: 'Test route works' });
    });

    // Test document creation route
    app.post('/api/test-documents', (req, res) => {
      console.log('[TEST] Document test route accessed with payload:', req.body);
      res.status(200).json({ 
        message: 'Document test route works',
        receivedData: req.body
      });
    });

    // Authentication routes
    log('[Routes] Setting up authentication routes...');
    app.use('/api/auth', authRouter);
    log('[Routes] Authentication routes setup complete');

    // Mount users routes
    log('[Routes] Setting up users routes...');
    app.use('/api/users', authenticateSession, usersRouter);
    log('[Routes] Users routes setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Project catalog routes - maintaining both /catalog and /projects endpoints for backwards compatibility
    app.use('/api/projects', authenticateSession, projectRouter);
    app.use('/api/catalog', authenticateSession, projectRouter);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    app.use('/api/budget', authenticateSession, budgetRouter);
    log('[Routes] Budget routes setup complete');

    // Documents routes
    log('[Routes] Setting up document routes...');
    // Handle documents routes with proper authentication
    app.use('/api/documents', authenticateSession, documentsRouter);
    log('[Routes] Document routes setup complete');

    // Template preview route
    app.use('/api/templates', authenticateSession, templatePreviewRouter);

    // Units routes
    log('[Routes] Registering units routes...');
    app.use('/api/units', authenticateSession, unitsRouter);
    log('[Routes] Units routes registered');

    // Diagnostic route to see all registered routes
    app.get('/api/diagnostics/routes', (_req, res) => {
      console.log('[DIAGNOSTICS] Getting registered routes');

      // Collect and format all registered routes
      const routes: any[] = [];

      // Helper function to extract routes from the router stack
      function extractRoutes(stack: any[], basePath = '') {
        stack.forEach(layer => {
          if (layer.route) {
            // It's a route
            const path = basePath + (layer.route?.path || '');
            const methods = Object.keys(layer.route.methods || {})
              .filter(m => layer.route.methods[m])
              .join('|').toUpperCase();

            routes.push({ path, methods });
          } else if (layer.name === 'router' && layer.handle?.stack) {
            // It's a sub-router, extract its path prefix
            let path = basePath;
            if (layer.regexp) {
              const match = layer.regexp.toString().match(/^\/\^\\\/([^\\]+)/);
              if (match) {
                path += '/' + match[1];
              }
            }

            // Recursively process this router's stack
            extractRoutes(layer.handle.stack, path);
          }
        });
      }

      // Process the main app router
      if (app._router?.stack) {
        extractRoutes(app._router.stack);
      }

      res.json({
        routes,
        timestamp: new Date().toISOString()
      });
    });

    // Test document creation route without authentication
    app.post('/api/test-document-post', async (req, res) => {
      try {
        console.log('[TEST] Document test route received payload:', req.body);

        const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [] } = req.body;

        if (!recipients?.length || !project_id || !unit || !expenditure_type) {
          console.error('[TEST] Missing required fields:', { 
            hasRecipients: Boolean(recipients?.length), 
            hasProjectId: Boolean(project_id), 
            hasUnit: Boolean(unit), 
            hasExpenditureType: Boolean(expenditure_type) 
          });
          return res.status(200).json({
            success: false,
            message: 'Missing required fields',
            receivedData: req.body,
            id: `test-${Date.now()}`
          });
        }

        // Get project NA853 from Supabase if not provided
        let project_na853 = req.body.project_na853;
        if (!project_na853) {
          // In the database, the project_id is stored as mis in the Projects table
          console.log('[TEST] Fetching NA853 for project with MIS:', project_id);
          
          try {
            // Use project_mis if it's available, otherwise use project_id (both should be the MIS field in Projects table)
            const lookupID = project_mis || project_id;
            console.log('[TEST] Looking up project using MIS:', lookupID);
            
            const { data: projectData, error: projectError } = await supabase
              .from('Projects')
              .select('na853')
              .eq('mis', lookupID)
              .single();
            
            if (!projectError && projectData && projectData.na853) {
              // Convert to numeric value - extract only the numbers from the NA853 string
              let numericNA853 = String(projectData.na853).replace(/\D/g, '');
              if (numericNA853) {
                project_na853 = numericNA853;
                console.log('[TEST] Retrieved and converted NA853 from Projects table:', project_na853);
              } else {
                // If we can't get a numeric value, try something else
                console.error('[TEST] Could not convert NA853 to numeric value:', projectData.na853);
                if (project_mis && !isNaN(Number(project_mis))) {
                  project_na853 = project_mis;
                } else {
                  project_na853 = '0'; // Fallback to safe numeric value
                }
              }
            } else {
              // If not found in Projects table, use project_mis directly as the fallback
              if (project_mis && !isNaN(Number(project_mis))) {
                console.log('[TEST] Using project_mis directly as numeric fallback:', project_mis);
                project_na853 = project_mis;
              } else {
                console.error('[TEST] Could not find project information:', projectError);
                return res.status(200).json({ 
                  success: false,
                  message: 'Project not found in Projects table, using fallback ID',
                  receivedData: req.body,
                  id: `test-${Date.now()}`
                });
              }
            }
          } catch (error) {
            console.error('[TEST] Error during project lookup:', error);
            // If error happens, use project_mis as fallback if available
            if (project_mis) {
              console.log('[TEST] Using project_mis directly due to error:', project_mis);
              project_na853 = project_mis;
            } else {
              return res.status(200).json({ 
                success: false,
                message: 'Error looking up project, using fallback',
                receivedData: req.body,
                id: `test-${Date.now()}`
              });
            }
          }
          console.log('[TEST] Retrieved NA853:', project_na853);
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

        // Create document payload
        const documentPayload = {
          unit,
          project_id: project_mis || project_id, // Use numeric project_mis if available
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
        
        // Log user authentication status
        console.log('[TEST] User info for document creation:', {
          hasSession: !!req.session,
          hasUser: !!req.session?.user,
          userId: req.session?.user?.id,
          userDepartment: req.session?.user?.department
        });

        console.log('[TEST] Attempting to insert document with payload:', documentPayload);

        // Insert into database
        const { data, error } = await supabase
          .from('generated_documents')
          .insert([documentPayload])
          .select('id')
          .single();

        if (error) {
          console.error('[TEST] Supabase insert error:', error);
          return res.status(200).json({ 
            success: false,
            message: 'Database insert failed, but returning test ID',
            error: error.message,
            receivedData: req.body,
            id: `test-${Date.now()}`
          });
        }

        console.log('[TEST] Document created successfully with ID:', data.id);
        return res.status(200).json({
          success: true,
          message: 'Document created and stored in database',
          receivedData: req.body,
          id: data.id
        });
      } catch (error) {
        console.error('[TEST] Unexpected error:', error);
        return res.status(200).json({
          success: false,
          message: 'Error in test route, returning fallback',
          error: error instanceof Error ? error.message : 'Unknown error',
          receivedData: req.body,
          id: `test-${Date.now()}`
        });
      }
    });

    // Mount other API routes under /api 
    // V2 document creation endpoint
    app.post('/api/v2-documents', express.json(), async (req: Request, res: Response) => {
      try {
        console.log('[DIRECT_ROUTE_V2] Document creation request with body:', req.body);

        const { unit, project_id, region, expenditure_type, recipients, total_amount, attachments = [] } = req.body;

        if (!recipients?.length || !project_id || !unit || !expenditure_type) {
          return res.status(400).json({
            message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
          });
        }

        // Get project NA853 value - project_id is the MIS field in Projects table
        const project_mis = req.body.project_mis;
        let project_na853: string;
        
        try {
          const { data: projectData, error: projectError } = await supabase
            .from('Projects')
            .select('na853')
            .eq('mis', project_mis || project_id)
            .single();
  
          if (projectError || !projectData) {
            console.error('[V2_ENDPOINT] Project fetch error:', projectError);
            
            if (project_mis && !isNaN(Number(project_mis))) {
              // Use project_mis as numeric fallback
              console.log('[V2_ENDPOINT] Using project_mis as numeric fallback:', project_mis);
              project_na853 = project_mis;
            } else {
              return res.status(400).json({ 
                message: 'Project not found in database and no fallback available' 
              });
            }
          } else {
            // Extract only numeric parts from NA853 string for database compatibility
            let numericNA853 = String(projectData.na853).replace(/\D/g, '');
            if (numericNA853) {
              project_na853 = numericNA853;
              console.log('[V2_ENDPOINT] Converted project NA853 to numeric:', project_na853);
            } else {
              // If we can't extract numbers, use mis as fallback or default to 0
              if (project_mis && !isNaN(Number(project_mis))) {
                project_na853 = project_mis;
                console.log('[V2_ENDPOINT] Using project_mis as numeric fallback:', project_mis);
              } else {
                project_na853 = '0'; // Safe fallback
                console.log('[V2_ENDPOINT] Using safe numeric fallback: 0');
              }
            }
          }
        } catch (error) {
          console.error('[V2_ENDPOINT] Error looking up project:', error);
          
          if (project_mis && !isNaN(Number(project_mis))) {
            console.log('[V2_ENDPOINT] Using project_mis as numeric fallback due to error:', project_mis);
            project_na853 = project_mis;
          } else {
            console.error('[V2_ENDPOINT] No valid numeric fallback available:', { project_mis });
            return res.status(500).json({ 
              message: 'Error looking up project data, no valid numeric fallback available',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Log user authentication status
        console.log('[V2_ENDPOINT] User info for document creation:', {
          hasSession: !!req.session,
          hasUser: !!req.session?.user,
          userId: req.session?.user?.id,
          userDepartment: req.session?.user?.department
        });

        const { data, error } = await supabase
          .from('generated_documents')
          .insert([{
            unit,
            project_id: project_mis || project_id, // Use numeric project_mis if available
            project_na853,
            expenditure_type,
            recipients,
            total_amount,
            region,
            status: 'draft',
            attachments,
            generated_by: req.session?.user?.id || null, // Add user ID if available
            department: req.session?.user?.department || null // Add department if available
          }])
          .select('id')
          .single();

        if (error) {
          console.error('[DIRECT_ROUTE_V2] Supabase error:', error);
          return res.status(500).json({ 
            message: 'Error creating document in database', 
            error: error.message
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

    app.use('/api', apiRouter);

    // Create and return HTTP server
    const httpServer = createServer(app);
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}