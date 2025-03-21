import { type Express, Request, Response } from "express";
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
          .from('project_catalog')
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
    
    // Mount other API routes under /api 
    app.use('/api', apiRouter);

    // Create and return HTTP server
    const httpServer = createServer(app);
    return httpServer;
  } catch (error) {
    log('[Routes] Error registering routes:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}