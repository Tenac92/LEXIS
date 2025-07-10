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
  // Remove problematic expenditure types router for now
  
  // Mount API routes
  app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);
  app.use('/api/documents', documentsRouter);
  app.use('/api/users', usersRouter);
  // Basic expenditure types endpoint  
  app.get('/api/expenditure-types', async (req: Request, res: Response) => {
    try {
      const { data: expenditureTypes, error } = await supabase
        .from('expediture_types')
        .select('*')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching expenditure types:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(expenditureTypes || []);
    } catch (error) {
      console.error('[API] Error in expenditure types endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Health check endpoint
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      // Test database connection
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (error) {
        return res.status(500).json({
          status: 'error',
          message: 'Database connection failed',
          error: error.message
        });
      }
      
      res.json({
        status: 'success',
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      console.error('[Health] Health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Public API routes
  app.get('/api/public/expenditure-types', async (req: Request, res: Response) => {
    try {
      const { data: expenditureTypes, error } = await supabase
        .from('expediture_types')
        .select('*')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching public expenditure types:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(expenditureTypes || []);
    } catch (error) {
      console.error('[API] Error in public expenditure types endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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
  
  // SQL Execution endpoint
  app.post('/api/sql/execute', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query is required and must be a string'
        });
      }

      const startTime = Date.now();
      const queryLower = query.toLowerCase().trim();
      
      // Determine query type and route appropriately
      let result;
      
      if (queryLower.includes('select count(')) {
        // Handle COUNT queries
        const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;
          
          result = {
            success: true,
            data: [{ count }],
            queryType: 'count',
            executionTime: Date.now() - startTime,
            rowCount: 1
          };
        }
      } else if (queryLower.startsWith('select')) {
        // Handle SELECT queries
        const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          
          // Parse SELECT fields
          const selectMatch = query.match(/select\s+(.*?)\s+from/i);
          const fields = selectMatch ? selectMatch[1].trim() : '*';
          
          // Parse LIMIT
          const limitMatch = query.match(/limit\s+(\d+)/i);
          const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
          
          let supabaseQuery = supabase.from(tableName);
          
          if (fields === '*') {
            supabaseQuery = supabaseQuery.select('*');
          } else {
            supabaseQuery = supabaseQuery.select(fields);
          }
          
          supabaseQuery = supabaseQuery.limit(limit);
          
          const { data, error } = await supabaseQuery;
          
          if (error) throw error;
          
          result = {
            success: true,
            data,
            queryType: 'select',
            executionTime: Date.now() - startTime,
            rowCount: data?.length || 0
          };
        }
      } else if (queryLower.includes('information_schema') || queryLower.includes('current_database')) {
        // System queries
        if (queryLower.includes('current_database') || queryLower.includes('version')) {
          result = {
            success: true,
            data: [{
              current_database: 'Supabase PostgreSQL',
              version: 'PostgreSQL via Supabase',
              connection_status: 'Active',
              timestamp: new Date().toISOString()
            }],
            queryType: 'system',
            executionTime: Date.now() - startTime,
            rowCount: 1
          };
        } else if (queryLower.includes('table_name')) {
          // Table listing
          const knownTables = [
            'Projects', 'project_index', 'project_history', 'budget_na853_split',
            'budget_history', 'event_types', 'expenditure_types', 'kallikratis',
            'Monada', 'users', 'beneficiaries', 'employees', 'documents'
          ];
          
          const tableData = knownTables.map(table => ({
            table_name: table,
            table_type: 'BASE TABLE',
            table_schema: 'public'
          }));
          
          result = {
            success: true,
            data: tableData,
            queryType: 'system',
            executionTime: Date.now() - startTime,
            rowCount: tableData.length
          };
        }
      } else {
        // Unsupported query type
        result = {
          success: false,
          error: 'Query type not supported. Use SELECT, COUNT, or system queries.',
          queryType: 'unsupported',
          executionTime: Date.now() - startTime
        };
      }
      
      res.json(result);
      
    } catch (error: any) {
      console.error('SQL execution error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'SQL execution failed',
        executionTime: Date.now() - Date.now()
      });
    }
  });

  // Budget endpoints
  app.get('/api/budget/data/:projectId', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      // Try to find project by ID or MIS
      let projectQuery = supabase
        .from('Projects')
        .select('id, mis')
        .or(`id.eq.${projectId},mis.eq.${projectId}`)
        .single();
      
      const { data: project, error: projectError } = await projectQuery;
      
      if (projectError || !project) {
        console.log(`[Budget] Project not found for ID: ${projectId}`);
        return res.json({
          status: 'success',
          data: {
            user_view: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            current_budget: 0,
            q1: 0,
            q2: 0,
            q3: 0,
            q4: 0,
            total_spent: 0,
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0
          }
        });
      }
      
      // Get budget data
      const { data: budgetData, error: budgetError } = await supabase
        .from('project_budget')
        .select('*')
        .eq('project_id', project.id)
        .single();
      
      if (budgetError || !budgetData) {
        console.log(`[Budget] Budget not found for project: ${project.id}`);
        return res.json({
          status: 'success',
          data: {
            user_view: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: budgetData?.katanomes_etous || 0,
            ethsia_pistosi: budgetData?.ethsia_pistosi || 0,
            current_budget: 0,
            q1: budgetData?.q1 || 0,
            q2: budgetData?.q2 || 0,
            q3: budgetData?.q3 || 0,
            q4: budgetData?.q4 || 0,
            total_spent: 0,
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0
          }
        });
      }
      
      // Calculate budget metrics
      const totalBudget = (budgetData.q1 || 0) + (budgetData.q2 || 0) + (budgetData.q3 || 0) + (budgetData.q4 || 0);
      const annualBudget = budgetData.ethsia_pistosi || 0;
      
      res.json({
        status: 'success',
        data: {
          user_view: budgetData.user_view || 0,
          total_budget: totalBudget,
          annual_budget: annualBudget,
          katanomes_etous: budgetData.katanomes_etous || 0,
          ethsia_pistosi: budgetData.ethsia_pistosi || 0,
          current_budget: totalBudget,
          q1: budgetData.q1 || 0,
          q2: budgetData.q2 || 0,
          q3: budgetData.q3 || 0,
          q4: budgetData.q4 || 0,
          total_spent: 0,
          available_budget: totalBudget,
          quarter_available: totalBudget,
          yearly_available: annualBudget
        }
      });
      
    } catch (error) {
      console.error('[Budget] Error fetching budget data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Project regions endpoint
  app.get('/api/projects/:id/regions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get project data with regions from project_index
      const { data: projectIndex, error: indexError } = await supabase
        .from('project_index')
        .select(`
          *,
          kallikratis:kallikratis_id (
            *
          )
        `)
        .eq('project_id', parseInt(id));
      
      if (indexError) {
        console.error('[Projects] Error fetching project regions:', indexError);
        return res.status(500).json({ error: indexError.message });
      }
      
      // Extract unique regions
      const regions = new Set();
      const regionalUnits = new Set();
      const municipalities = new Set();
      
      projectIndex?.forEach(index => {
        if (index.kallikratis) {
          const k = index.kallikratis;
          if (k.perifereia) regions.add(k.perifereia);
          if (k.perifereiaki_enotita) regionalUnits.add(k.perifereiaki_enotita);
          if (k.onoma_neou_ota) municipalities.add(k.onoma_neou_ota);
        }
      });
      
      res.json({
        regions: Array.from(regions),
        regional_units: Array.from(regionalUnits),
        municipalities: Array.from(municipalities),
        project_index: projectIndex || []
      });
      
    } catch (error) {
      console.error('[Projects] Error in regions endpoint:', error);
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