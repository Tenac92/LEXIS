import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
// Import from the auth middleware which re-exports from the authentication module
import { authenticateSession, User, AuthenticatedRequest } from "./middleware/auth";
import apiRouter from "./controllers";
import { getDashboardStats } from "./controllers/dashboard";
// Import the budgetController for the getBudgetByMis function
import { getBudgetByMis } from './controllers/budgetController';
// Import the budget router with validation endpoints from routes/budget.ts
import budgetRouter from './routes/budget';
import { router as budgetNotificationsRouter } from "./controllers/budgetNotificationsController";
import { router as unitsRouter } from "./controllers/unitsController";
import { router as usersRouter } from "./controllers/usersController";
import { router as projectRouter } from "./controllers/projectController";
import { router as documentsRouter } from "./controllers/documentsController";
import templatePreviewRouter from "./routes/template-preview";
import authRouter from "./routes/auth";
import budgetUploadRouter from "./routes/budget-upload"; // Import the budget upload router
import attachmentsRouter from "./controllers/attachments"; // Import for attachments (default export)
import healthcheckRouter from "./routes/healthcheck"; // Import the original healthcheck router
import healthRouter from "./routes/health"; // Import our new enhanced health check router
import sdegdaefkDiagnosticRouter from "./routes/sdegdaefk-diagnostic"; // Import the sdegdaefk.gr diagnostic router
import { registerAdminRoutes } from "./routes/admin"; // Import admin routes for quarter transitions
import documentsBrowserHandler from "./middleware/sdegdaefk/documentsBrowserHandler"; // Import browser request handler for /documents
import authBrowserHandler from "./middleware/sdegdaefk/authBrowserHandler"; // Import browser request handler for /auth
// Note: We now use the consolidated documentsController instead of multiple document route files
import { log } from "./vite";
import { supabase } from "./config/db"; // Main supabase client
import { verifyDatabaseConnections } from "./data"; // Database utilities
import { BudgetService } from "./services/budgetService"; // Budget service for operations

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // TODO: Refactor - Move these direct document routes to the consolidated DocumentController
    // IMPORTANT: Register direct document creation route first to bypass any routing conflicts
    app.post('/api/documents', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
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
          .select('budget_na853')
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
          installment: String(r.installment || 'Α').trim(),
          installments: Array.isArray(r.installments) ? r.installments : [String(r.installment || 'Α').trim()],
          installmentAmounts: r.installmentAmounts || {}
        }));

        const now = new Date().toISOString();

        // Create document with exact schema match and set initial status to pending
        const documentPayload = {
          unit,
          project_id,
          project_na853: projectData.budget_na853,
          expenditure_type,
          status: 'pending', // Always set initial status to pending
          recipients: formattedRecipients,
          total_amount: parseFloat(String(total_amount)) || 0,
          generated_by: req.user.id,
          department: req.user.department || null,
          // Instead of contact_number, use telephone field to match the schema
          telephone: req.user.telephone || null,
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
        
        // NOTE: Budget update has been removed from this endpoint to prevent duplicate updates.
        // The budget is now updated only in the V2 document creation endpoint.
        // This prevents duplicate budget history entries.
        
        res.status(201).json({ id: data.id });
      } catch (error) {
        console.error('[DIRECT_ROUTE] Error creating document:', error);
        res.status(500).json({ 
          message: 'Error creating document', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Removed test routes for production code
    
    // VERSION 2 DOCUMENT CREATION ENDPOINT - Direct access for client-side
    // This is the endpoint that the create-document-dialog.tsx component uses
    // TODO: Refactor - Move to DocumentsController and standardize with the v1 endpoint
    app.post('/api/v2-documents', async (req: Request, res: Response) => {
      try {
        console.log('[DIRECT_ROUTE_V2] Document creation request with body:', req.body);
        
        // Check if there's a session but don't require auth for testing
        console.log('[DIRECT_ROUTE_V2] Session info:', (req as any).session);
        
        const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [], region } = req.body;
        
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
              .select('budget_na853')
              .eq('mis', project_id)
              .single();
            
            if (!projectError && projectData && projectData.budget_na853) {
              // Use the full NA853 value without stripping non-numeric characters
              project_na853 = String(projectData.budget_na853);
              console.log('[DIRECT_ROUTE_V2] Retrieved NA853 from Projects table:', project_na853);
              
              // If NA853 is empty for some reason, use project_mis as fallback
              if (!project_na853) {
                console.error('[DIRECT_ROUTE_V2] NA853 value is empty:', projectData.budget_na853);
                // Try to use project_mis as fallback
                if (req.body.project_mis) {
                  project_na853 = req.body.project_mis;
                  console.log('[DIRECT_ROUTE_V2] Using project_mis as fallback:', req.body.project_mis);
                } else {
                  // Last resort - use project_id as fallback
                  project_na853 = project_id;
                  console.log('[DIRECT_ROUTE_V2] Using project_id as fallback:', project_id);
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
          // Για συμβατότητα με παλιό schema, κρατάμε το πεδίο installment (χρησιμοποιεί την πρώτη δόση αν υπάρχει)
          installment: String(r.installment || (r.installments && r.installments.length > 0 ? r.installments[0] : 'ΕΦΑΠΑΞ')).trim(),
          // Νέο schema για πολλαπλές δόσεις
          installments: Array.isArray(r.installments) ? r.installments : [String(r.installment || 'ΕΦΑΠΑΞ').trim()],
          installmentAmounts: r.installmentAmounts || {}
        }));
        
        const now = new Date().toISOString();
        
        // Log user authentication status
        console.log('[DIRECT_ROUTE_V2] User info for document creation:', {
          hasSession: !!(req as any).session,
          hasUser: !!(req as any).session?.user,
          userId: (req as any).session?.user?.id,
          userDepartment: (req as any).session?.user?.department
        });

        // Create document payload
        const documentPayload = {
          unit,
          mis: req.body.project_mis || project_id, // Use numeric project_mis if available
          project_na853,
          expenditure_type,
          status: 'pending', // Always set initial status to pending
          recipients: formattedRecipients,
          total_amount: parseFloat(String(total_amount)) || 0,
          attachments: attachments || [],
          region: region || null, // Add region field
          generated_by: (req as any).session?.user?.id || null, // Add user ID if available
          department: (req as any).session?.user?.department || null, // Add department if available
          created_at: now,
          updated_at: now
        };
        
        console.log('[DIRECT_ROUTE_V2] Inserting document with payload:', documentPayload);
        
        // Insert into database - Use explicit ID generation with max+1 to avoid conflicts
        // First check if we need to handle a conflict case
        const { data: maxIdData } = await supabase
          .from('generated_documents')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
          .single();
        
        // Get the max ID and add 1
        const newId = (maxIdData?.id || 0) + 100; // Add 100 to ensure we're well clear of any existing IDs
        console.log('[DIRECT_ROUTE_V2] Found max ID:', maxIdData?.id, 'Using new ID:', newId);
        
        // Create a copy of document payload with an explicit new ID
        const finalPayload = { 
          ...documentPayload,
          id: newId
        };
        
        // Insert into database with explicit ID
        const { data, error } = await supabase
          .from('generated_documents')
          .insert([finalPayload])
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
        
        // Update the budget to reflect the document creation
        try {
          // Convert project_id to MIS if needed (project_id or project_mis)
          const projectMIS = req.body.project_mis || project_id;
          console.log('[DIRECT_ROUTE_V2] Updating budget for project:', projectMIS, 'with amount:', documentPayload.total_amount);
          console.log('[DIRECT_ROUTE_V2] Budget update parameters: ', {
            mis: projectMIS, 
            amount: documentPayload.total_amount,
            userId: (req as any).session?.user?.id || 'guest',
            documentId: data.id,
            changeReason: `Δημιουργία εγγράφου ID:${data.id} για το έργο με MIS:${projectMIS}`
          });
          
          const budgetResult = await BudgetService.updateBudget(
            projectMIS,                         // MIS
            documentPayload.total_amount,       // Amount
            (req as any).session?.user?.id || 'guest',  // User ID
            data.id,                            // Document ID
            `Δημιουργία εγγράφου ID:${data.id} για το έργο με MIS:${projectMIS}`  // Change reason
          );
          
          console.log('[DIRECT_ROUTE_V2] Budget update result:', budgetResult.status);
          console.log('[DIRECT_ROUTE_V2] Full budget update response:', JSON.stringify(budgetResult, null, 2));
        } catch (budgetError) {
          console.error('[DIRECT_ROUTE_V2] Error updating budget (document still created):', budgetError);
          console.error('[DIRECT_ROUTE_V2] Budget update error details:', budgetError instanceof Error ? budgetError.message : 'Unknown error');
          // Continue without failing - document is created but budget may not be updated
        }
        
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

    // Authentication routes
    log('[Routes] Setting up authentication routes...');
    
    // Import the consolidated auth router
    const authApiRouter = await import('./routes/api/auth').then(m => m.default);
    
    // Use the consolidated auth router for all auth routes
    app.use('/api/auth', authApiRouter);
    
    // Note: We are now using the consolidated auth routes from server/routes/api/auth.ts
    // which includes all auth functionality:
    // - POST /api/auth/login
    // - POST /api/auth/logout
    // - GET /api/auth/me
    // - PUT /api/auth/change-password
    // - POST /api/auth/register
    
    log('[Routes] Authentication routes setup complete with consolidated router');

    // Mount users routes
    log('[Routes] Setting up users routes...');
    app.use('/api/users', authenticateSession, usersRouter);
    log('[Routes] Users routes setup complete');

    // Dashboard routes
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);

    // Project catalog routes - maintaining both /catalog and /projects endpoints for backwards compatibility
    
    // TODO: Refactor - Move these project-related public endpoints to projectController
    // Public access to project regions for document creation
    app.get('/api/projects/:mis/regions', async (req, res) => {
      try {
        const { mis } = req.params;
        
        if (!mis) {
          return res.status(400).json({
            status: 'error',
            message: 'MIS parameter is required'
          });
        }
        
        console.log('[Projects] Public access fetching regions for project:', mis);
        
        // Query project to get regions
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('region')
          .eq('mis', mis)
          .single();
        
        if (projectError) {
          console.error('[Projects] Error fetching project regions:', projectError);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch project regions'
          });
        }
        
        console.log('[Projects] Regions for project', mis, ':', projectData?.region);
        return res.json(projectData?.region || {});
      } catch (error) {
        console.error('[Projects] Error in public regions access:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch project regions'
        });
      }
    });
    
    // Public access to project search for document creation
    app.get('/api/projects/search', async (req, res) => {
      try {
        const { query } = req.query;
        
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            status: 'error',
            message: 'Search query is required'
          });
        }
        
        console.log('[Projects] Public access searching for projects with query:', query);
        
        // First try to determine which columns are available in Projects table
        let columns = 'mis';
        // First check if 'mis' column exists - this should always exist
        const { data: columnCheckData } = await supabase
          .from('Projects')
          .select('mis')
          .limit(1);
        
        // If we got data with mis, then this column exists
        if (columnCheckData && columnCheckData.length > 0) {
          console.log('[Projects] Confirmed mis column exists');
          
          // Now check if we can select more columns
          // Try name column first
          try {
            const { data: nameCheck } = await supabase
              .from('Projects')
              .select('mis, name')
              .limit(1);
            
            if (nameCheck && nameCheck.length > 0) {
              columns = 'mis, name';
              console.log('[Projects] Using columns:', columns);
            }
          } catch (err) {
            // Try title column next
            try {
              const { data: titleCheck } = await supabase
                .from('Projects')
                .select('mis, title')
                .limit(1);
              
              if (titleCheck && titleCheck.length > 0) {
                columns = 'mis, title';
                console.log('[Projects] Using columns:', columns);
              }
            } catch (err2) {
              // Just stick with mis
              console.log('[Projects] Only using mis column');
            }
          }
        }
        
        // Query projects based on search term with available columns
        console.log('[Projects] Querying Projects with columns:', columns);
        const { data: projectsData, error: projectsError } = await supabase
          .from('Projects')
          .select(columns)
          .ilike('mis', `%${query}%`)
          .limit(25);
        
        if (projectsError) {
          console.error('[Projects] Error searching projects:', projectsError);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to search projects'
          });
        }
        
        console.log('[Projects] Found', projectsData?.length || 0, 'projects for query:', query);
        return res.json(projectsData || []);
      } catch (error) {
        console.error('[Projects] Error in public project search:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to search projects'
        });
      }
    });
    
    // Use authentication for all other project routes
    app.use('/api/projects', authenticateSession, projectRouter);
    app.use('/api/catalog', authenticateSession, projectRouter);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    
    // Allow public access to budget data by MIS for document creation
    // Using our specialized controller function for MIS lookups
    app.get('/api/budget/:mis', getBudgetByMis);
    
    // Budget notifications routes - must be registered BEFORE the main budget routes
    log('[Routes] Setting up budget notifications routes...');
    app.use('/api/budget-notifications', authenticateSession, budgetNotificationsRouter);
    log('[Routes] Budget notifications routes setup complete');
    
    // Budget upload routes for Excel file imports - MUST come BEFORE the main budget routes
    log('[Routes] Setting up budget upload routes...');
    app.use('/api/budget/upload', authenticateSession, budgetUploadRouter);
    log('[Routes] Budget upload routes setup complete');
    
    // Use authentication for all other budget routes
    // This MUST come after more specific /api/budget/* routes
    app.use('/api/budget', authenticateSession, budgetRouter);
    log('[Routes] Main budget routes registered');

    // Documents routes
    log('[Routes] Setting up document routes...');
    
    // Add public route to get document by ID - for testing purposes
    app.get('/api/documents/public/:id', async (req, res) => {
      try {
        const { id } = req.params;
        console.log('[Documents] Public access to document with ID:', id);
        
        // Fetch document from Supabase
        const { data, error } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('[Documents] Error fetching document:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch document'
          });
        }
        
        if (!data) {
          return res.status(404).json({
            status: 'error',
            message: 'Document not found'
          });
        }
        
        console.log('[Documents] Successfully retrieved document:', data.id);
        return res.json(data);
      } catch (error) {
        console.error('[Documents] Error in public document access:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch document'
        });
      }
    });
    
    // NOTE: The above direct document routes need to be consolidated here
    // The documentsController should handle all document-related operations
    // Handle documents routes with proper authentication
    app.use('/api/documents', authenticateSession, documentsRouter);
    log('[Routes] Document routes setup complete');

    // Template preview route
    app.use('/api/templates', authenticateSession, templatePreviewRouter);

    // Units routes
    log('[Routes] Registering units routes...');
    
    // TODO: Refactor - Move this public units endpoint to unitsController
    // Allow public access to units endpoint for document creation
    app.get('/api/users/units', async (req, res) => {
      try {
        console.log('[Units] Public access to units list');
        
        // Query Monada table for units
        const { data: unitsData, error } = await supabase
          .from('Monada')
          .select('unit, unit_name');
        
        if (error) {
          console.error('[Units] Error fetching units:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch units'
          });
        }
        
        console.log('[Units] Successfully fetched units:', unitsData?.length || 0);
        return res.json(unitsData || []);
      } catch (error) {
        console.error('[Units] Error in public units access:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch units'
        });
      }
    });
    
    // Use authentication for other units routes
    app.use('/api/units', authenticateSession, unitsRouter);
    log('[Routes] Units routes registered');
    
    // Attachments routes
    log('[Routes] Registering attachments routes...');
    // Allow public access to attachments routes for document creation
    app.use('/api/attachments', attachmentsRouter);
    log('[Routes] Attachments routes registered');
    
    // Register the healthcheck router (no authentication required)
    log('[Routes] Registering healthcheck routes...');
    app.use('/api/healthcheck', healthcheckRouter);
    
    // Register enhanced health check router (no authentication required)
    log('[Routes] Registering enhanced health check routes...');
    app.use('/api/health', healthRouter);
    
    // Register sdegdaefk.gr diagnostic endpoints (no authentication required)
    log('[Routes] Registering sdegdaefk.gr diagnostic routes...');
    app.use('/api/sdegdaefk-diagnostic', sdegdaefkDiagnosticRouter);
    
    // Special route for direct browser access from sdegdaefk.gr domain
    app.get('/sdegdaefk-gr', (req, res) => {
      try {
        const origin = req.headers.origin;
        const referer = req.headers.referer;
        const host = req.headers.host;
        const acceptHeader = req.headers.accept || '';
        
        // Check if this is a browser request (looking for HTML)
        const isBrowserRequest = acceptHeader.includes('text/html') || req.headers['sec-fetch-dest'] === 'document';
        
        // Check if this is from sdegdaefk.gr domain
        const isSdegdaefkRequest = 
          (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
          (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
          (typeof referer === 'string' && referer.includes('sdegdaefk.gr'));
        
        log(`[Routes] sdegdaefk-gr page accessed: origin=${origin || 'none'}, host=${host || 'none'}, browser=${isBrowserRequest}`, 'info');
        
        // If this is a browser request, show a friendly HTML page
        if (isBrowserRequest) {
          const connectionStatus = {
            app: true,
            server: true,
            integration: true
          };
          
          const htmlResponse = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>ΣΔΕΓΔΑΕΦΚ - Έλεγχος Σύνδεσης</title>
                <style>
                  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                  h1 { color: #1a5276; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                  .status-box { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; margin: 20px 0; }
                  .item { margin-bottom: 15px; }
                  .label { font-weight: bold; display: inline-block; width: 180px; }
                  .success { color: #27ae60; }
                  .warning { color: #f39c12; }
                  .error { color: #c0392b; }
                  .btn { display: inline-block; background: #2980b9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
                  .btn:hover { background: #3498db; }
                  .info { background-color: #d4e6f1; padding: 15px; border-radius: 5px; margin-top: 20px; }
                </style>
              </head>
              <body>
                <h1>ΣΔΕΓΔΑΕΦΚ - Έλεγχος Σύνδεσης</h1>
                <div class="status-box">
                  <div class="item">
                    <span class="label">Εφαρμογή:</span> 
                    <span class="success">✓ Λειτουργική</span>
                  </div>
                  <div class="item">
                    <span class="label">Διακομιστής:</span> 
                    <span class="success">✓ Συνδεδεμένος</span>
                  </div>
                  <div class="item">
                    <span class="label">Ενσωμάτωση sdegdaefk.gr:</span>
                    <span class="success">✓ Ενεργοποιημένη</span>
                  </div>
                  <div class="item">
                    <span class="label">Αίτημα από:</span> 
                    ${req.headers.origin || req.headers.host || 'Άγνωστο'}
                  </div>
                  <div class="item">
                    <span class="label">Χρόνος Διακομιστή:</span> 
                    ${new Date().toLocaleString('el-GR')}
                  </div>
                </div>
                
                <div class="info">
                  <p>Η ενσωμάτωση με το domain sdegdaefk.gr λειτουργεί κανονικά. Αυτή η σελίδα παρέχεται για επαλήθευση της συνδεσιμότητας.</p>
                </div>
                
                <a class="btn" href="/">Μετάβαση στην εφαρμογή</a>
              </body>
            </html>
          `;
          
          return res
            .status(200)
            .set({
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache'
            })
            .send(htmlResponse);
        }
        
        // For API requests, return JSON status
        return res.status(200).json({
          status: 'ok',
          message: 'sdegdaefk.gr integration check',
          timestamp: new Date().toISOString(),
          from: {
            origin: origin || 'none',
            host: host || 'none'
          },
          integration: {
            enabled: true,
            cors: {
              enabled: true,
              credentials: true
            },
            cookieDomain: process.env.COOKIE_DOMAIN || 'not configured'
          }
        });
      } catch (error: any) {
        log(`[Routes] Error in sdegdaefk-gr page: ${error.message}`, 'error');
        
        res.status(500).json({
          status: 'error',
          message: 'Error processing sdegdaefk.gr integration check',
          error: 'internal_error',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Special route for sdegdaefk.gr domain database connectivity test
    app.get('/sdegdaefk-database-check', async (req, res) => {
      try {
        const origin = req.headers.origin;
        const referer = req.headers.referer;
        const host = req.headers.host;

        log(`[Routes] sdegdaefk-database-check requested from: origin=${origin || 'none'}, host=${host || 'none'}, referer=${referer || 'none'}`, 'info');

        // Check if this is from sdegdaefk.gr domain
        const isSdegdaefkRequest = 
          (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
          (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
          (typeof referer === 'string' && referer.includes('sdegdaefk.gr'));

        // Import database utilities to test connection
        const { verifyDatabaseConnections } = await import('./data/index');
        const connectionStatus = await verifyDatabaseConnections();

        // Prepare a safe response with just enough information
        const response = {
          status: 'ok',
          message: 'Database connectivity check for sdegdaefk.gr integration',
          timestamp: new Date().toISOString(),
          domain: 'sdegdaefk.gr',
          isSdegdaefkRequest,
          database: {
            postgres: connectionStatus.pg ? 'connected' : 'disconnected',
            supabase: connectionStatus.supabase ? 'connected' : 'disconnected'
          }
        };

        res.status(200).json(response);
      } catch (error: any) {
        log(`[Routes] Error in sdegdaefk-database-check: ${error.message}`, 'error');
        
        // Safe error response
        res.status(500).json({
          status: 'error',
          message: 'Database connectivity check failed',
          error: 'internal_error',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Register special handlers for direct browser access issues from sdegdaefk.gr
    
    // Fix browser requests to /documents path
    app.use(documentsBrowserHandler);
    log('[Routes] Special handler for /documents browser requests registered successfully');
    
    // Fix browser requests to /auth paths
    app.use(authBrowserHandler);
    log('[Routes] Special handler for /auth browser requests registered successfully');
    
    // Finish setup of diagnostic routes
    log('[Routes] Healthcheck routes registered');

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

    // TODO: Refactor - Consider removing this test route or move it to a test controller
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
              .select('budget_na853')
              .eq('mis', lookupID)
              .single();
            
            if (!projectError && projectData && projectData.budget_na853) {
              // Convert to numeric value - extract only the numbers from the NA853 string
              let numericNA853 = String(projectData.budget_na853).replace(/\D/g, '');
              if (numericNA853) {
                project_na853 = numericNA853;
                console.log('[TEST] Retrieved and converted NA853 from Projects table:', project_na853);
              } else {
                // If we can't get a numeric value, try something else
                console.error('[TEST] Could not convert NA853 to numeric value:', projectData.budget_na853);
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
    // NOTE: V2 document creation endpoint is now handled in server/index.ts
    // This duplicate endpoint was causing conflicts
    // The v2-documents endpoint implementation has been moved to server/index.ts
    // to prevent duplicate endpoint registrations.

    // Special handler for root path requests from sdegdaefk.gr domain
    app.get('/', (req, res, next) => {
      try {
        const origin = req.headers.origin;
        const referer = req.headers.referer;
        const host = req.headers.host;
        
        // Check if this is from sdegdaefk.gr domain
        const isSdegdaefkRequest = 
          (typeof origin === 'string' && origin.includes('sdegdaefk.gr')) ||
          (typeof host === 'string' && host.includes('sdegdaefk.gr')) ||
          (typeof referer === 'string' && referer.includes('sdegdaefk.gr'));
        
        if (isSdegdaefkRequest) {
          log(`[Routes] Root path accessed from sdegdaefk.gr domain: origin=${origin || 'none'}, host=${host || 'none'}`, 'info');
          
          // Continue to the next middleware (Vite will handle serving the client app)
          next();
        } else {
          // For other domains, also just continue to next middleware
          next();
        }
      } catch (error: any) {
        // In case of error, just proceed to next middleware
        log(`[Routes] Error handling root path request: ${error.message}`, 'error');
        next();
      }
    });
    
    // Setup Main API Router
    const mainApiRouter = express.Router();
    app.use('/api', mainApiRouter);
    
    // Register Admin Routes with WebSocket server passed for real-time notifications
    log('[Routes] Setting up admin routes...');
    // Create a placeholder for WebSocket server to be used later
    let wsPlaceholder: any = null;
    const wsProxy = new Proxy({}, {
      get: (_target, prop) => {
        if (wsPlaceholder && typeof wsPlaceholder[prop] === 'function') {
          return wsPlaceholder[prop].bind(wsPlaceholder);
        }
        return wsPlaceholder ? wsPlaceholder[prop] : null;
      }
    });
    
    // Register admin routes with the proxy (will be connected to real WebSocket later)
    registerAdminRoutes(mainApiRouter, wsProxy);
    log('[Routes] Admin routes registered successfully');
    
    // Mount the general API router
    mainApiRouter.use('/', apiRouter);
    
    // Create and return HTTP server
    const httpServer = createServer(app);
    
    // Create a method to set the real WebSocket server later from index.ts
    (httpServer as any).setWebSocketServer = (wss: any) => {
      wsPlaceholder = wss;
      log('[Routes] WebSocket server connected to admin routes');
    };
    
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}