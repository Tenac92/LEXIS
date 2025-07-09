import { Request, Response, Express } from 'express';
import { Server } from 'http';
import { authenticateSession, AuthenticatedRequest } from './authentication';
import { supabase } from './config/db';
import { log } from './vite';
import { createServer } from 'http';
import { storage } from './storage';

function getChangeTypeLabel(type: string): string {
  switch (type) {
    case 'NEW':
      return 'Νέα καταχώρηση';
    case 'INCREASE':
      return 'Αύξηση';
    case 'DECREASE':
      return 'Μείωση';
    case 'TRANSFER':
      return 'Μεταφορά';
    default:
      return type;
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case 'pending':
      return 'Εκκρεμές';
    case 'approved':
      return 'Εγκεκριμένο';
    case 'rejected':
      return 'Απορριφθέν';
    case 'cancelled':
      return 'Ακυρωμένο';
    default:
      return status || 'Άγνωστο';
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register API routes
  log('[Routes] Registering API routes...');
  
  // Basic document creation endpoint (legacy)
  app.post('/api/documents', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        recipients = [],
        total_amount,
        project_id,
        expenditure_type,
        region,
        unit,
        attachments,
        esdian,
        director_signature
      } = req.body;

      // Format recipients data
      const formattedRecipients = recipients.map((r: any) => ({
        firstname: String(r.firstname).trim(),
        lastname: String(r.lastname).trim(),
        fathername: String(r.fathername || '').trim(),
        afm: String(r.afm).trim(),
        amount: parseFloat(String(r.amount)),
        installment: String(r.installment || 'ΕΦΑΠΑΞ').trim(),
        secondary_text: r.secondary_text ? String(r.secondary_text).trim() : ""
      }));

      const now = new Date().toISOString();
      
      // Create document payload
      const documentPayload = {
        status: 'pending',
        recipients: formattedRecipients,
        total_amount: parseFloat(String(total_amount)) || 0,
        generated_by: req.user.id,
        department: req.user.department || null,
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
      
      res.status(201).json({ id: data.id });
    } catch (error) {
      console.error('[DIRECT_ROUTE] Error creating document:', error);
      res.status(500).json({ 
        message: 'Error creating document', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Authentication routes handled by authentication.ts
  log('[Routes] Authentication routes handled by authentication.ts setupAuth()');

  // Import and mount API controllers
  const { getDashboardStats } = await import('./controllers/dashboard');
  const { router: documentsRouter } = await import('./controllers/documentsController');
  const { router: usersRouter } = await import('./controllers/usersController');
  
  // Mount API routes
  app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);
  app.use('/api/documents', documentsRouter);
  app.use('/api/users', usersRouter);
  
  // Public API routes
  app.get('/api/public/monada', async (req: Request, res: Response) => {
    try {
      const { data: monada, error } = await supabase
        .from('Monada')
        .select('*')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching monada:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(monada);
    } catch (error) {
      console.error('[API] Error in monada endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/public/units', async (req: Request, res: Response) => {
    try {
      const { data: units, error } = await supabase
        .from('Monada')
        .select('unit_name')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching units:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Extract unique unit names
      const uniqueUnits = new Set<string>();
      units?.forEach(unit => {
        if (unit.unit_name?.name && typeof unit.unit_name.name === 'string') {
          uniqueUnits.add(unit.unit_name.name);
        }
      });
      
      const unitsList = Array.from(uniqueUnits).sort().map(unitName => ({
        id: unitName,
        name: unitName
      }));
      
      res.json(unitsList);
    } catch (error) {
      console.error('[API] Error in units endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  log('[Routes] API routes registered');
  
  // Additional project endpoints
  app.get('/api/projects-working/:unitName', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      let { unitName } = req.params;
      
      // Decode URL-encoded Greek characters
      try {
        unitName = decodeURIComponent(unitName);
      } catch (decodeError) {
        console.log(`[ProjectsWorking] URL decode failed, using original: ${unitName}`);
      }
      
      console.log(`[ProjectsWorking] Fetching projects for unit: ${unitName}`);
      
      // Get projects with enhanced data using optimized schema
      const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, indexRes] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Monada').select('*'),
        supabase.from('event_types').select('*'),
        supabase.from('expediture_types').select('*'),
        supabase.from('project_index').select('*')
      ]);
      
      if (projectsRes.error) {
        console.error(`[ProjectsWorking] Query failed:`, projectsRes.error);
        return res.status(500).json({
          message: 'Database query failed',
          error: projectsRes.error.message
        });
      }
      
      const projects = projectsRes.data || [];
      const monadaData = monadaRes.data || [];
      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      const indexData = indexRes.data || [];
      
      // Filter projects by unit using project_index directly
      const unitProjects = projects.filter(project => {
        const projectIndexEntries = indexData.filter(idx => idx.project_id === project.id);
        return projectIndexEntries.some(idx => {
          const unitData = monadaData.find(m => m.id === idx.monada_id);
          return unitData && unitData.unit === unitName;
        });
      });
      
      console.log(`[ProjectsWorking] Found ${unitProjects.length} projects for unit ${unitName}`);
      
      res.json(unitProjects);
    } catch (error) {
      console.error(`[ProjectsWorking] Error:`, error);
      res.status(500).json({
        message: 'Error fetching projects',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  log('[Routes] All routes registered successfully');
  
  return httpServer;
}