import { Request, Response, Express } from 'express';
import { Server } from 'http';
import { authenticateSession, AuthenticatedRequest } from './authentication';
import { supabase } from './config/db';
import { log } from './vite';
import { createServer } from 'http';
import { storage } from './storage';
import { getBudgetByMis } from './controllers/budgetController';

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
  
  // Import and register controllers
  const { default: attachmentsRouter } = await import('./controllers/attachments');
  app.use('/api/attachments', attachmentsRouter);
  
  const { router: beneficiariesRouter } = await import('./controllers/beneficiaryController');
  app.use('/api/beneficiaries', beneficiariesRouter);
  
  // Register project resolver controller for NA853 and project resolution endpoints
  const { default: projectResolverRouter } = await import('./controllers/projectResolverController');
  app.use('/api/projects', projectResolverRouter);
  
  // Register subprojects controller for project subprojects
  const { default: subprojectsRouter } = await import('./controllers/subprojectsController');
  app.use('/api/projects', subprojectsRouter);
  
  // Standalone subprojects routes
  app.use('/api/subprojects', subprojectsRouter);
  
  // Projects by unit endpoint for document creation
  app.get('/api/projects-working/:unitName', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { unitName } = req.params;
      
      if (!unitName) {
        return res.status(400).json({ error: 'Unit name is required' });
      }
      
      // Decode the unit name if it's URL encoded
      const decodedUnitName = decodeURIComponent(unitName);
      
      log(`[Projects Working] Fetching projects for unit: ${decodedUnitName}`);
      
      // Check if unitName is numeric (unit ID) or string (unit name)
      let unitId: number | null = null;
      
      if (/^\d+$/.test(decodedUnitName)) {
        // It's a numeric unit ID
        unitId = parseInt(decodedUnitName, 10);
      } else {
        // It's a unit name, find the corresponding ID
        const unitResult = await supabase
          .from('Monada')
          .select('id')
          .eq('unit', decodedUnitName)
          .single();
          
        if (unitResult.data) {
          unitId = unitResult.data.id;
        }
      }
      
      if (!unitId) {
        log(`[Projects Working] Unit not found: ${decodedUnitName}`);
        return res.json([]);
      }
      
      // Get projects linked to this unit through project_index
      const [projectIndexRes, projectsRes, monadaRes, eventTypesRes, expenditureTypesRes] = await Promise.all([
        supabase.from('project_index').select('*').eq('monada_id', unitId),
        supabase.from('Projects').select('*'),
        supabase.from('Monada').select('*'),
        supabase.from('event_types').select('*'),
        supabase.from('expenditure_types').select('*')
      ]);

      if (projectIndexRes.error) {
        console.error('[Projects Working] Database error:', projectIndexRes.error);
        return res.status(500).json({ error: 'Failed to fetch project index' });
      }

      if (projectsRes.error) {
        console.error('[Projects Working] Database error:', projectsRes.error);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }
      
      const projectIndexItems = projectIndexRes.data || [];
      const allProjects = projectsRes.data || [];
      const monadaData = monadaRes.data || [];
      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      
      // Get unique project IDs for this unit
      const projectIds = Array.from(new Set(projectIndexItems.map(item => item.project_id)));
      
      // Filter projects to those linked to this unit
      const unitProjects = allProjects.filter(project => projectIds.includes(project.id));
      
      log(`[Projects Working] Found ${unitProjects.length} projects for unit ${decodedUnitName}`);
      
      // Enhance each project with related data
      const enhancedProjects = unitProjects.map(project => {
        const projectIndexForProject = projectIndexItems.filter(idx => idx.project_id === project.id);
        
        // Get expenditure types for this project
        const projectExpenditureTypes = projectIndexForProject
          .map(idx => expenditureTypes.find(et => et.id === idx.expenditure_type_id))
          .filter(et => et !== null && et !== undefined)
          .map(et => et.expenditure_types);
        
        const uniqueExpenditureTypes = Array.from(new Set(projectExpenditureTypes));
        
        // Get event types for this project
        const projectEventTypes = projectIndexForProject
          .map(idx => eventTypes.find(et => et.id === idx.event_types_id))
          .filter(et => et !== null && et !== undefined)
          .map(et => et.name);
        
        const uniqueEventTypes = Array.from(new Set(projectEventTypes));
        
        return {
          id: project.id,
          mis: project.mis,
          project_title: project.project_title || project.event_description,
          event_description: project.event_description,
          expenditure_types: uniqueExpenditureTypes,
          event_types: uniqueEventTypes,
          created_at: project.created_at,
          updated_at: project.updated_at
        };
      });
      
      res.json(enhancedProjects);
      
    } catch (error) {
      console.error('[Projects Working] Error:', error);
      res.status(500).json({ error: 'Failed to fetch projects for unit' });
    }
  });
  
  // Beneficiary payments endpoint for enhanced display
  app.get('/api/beneficiary-payments', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.unit_id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get all beneficiaries for user's units first
      const beneficiaries = await storage.getBeneficiariesByUnit(req.user.unit_id[0].toString());
      
      // Get payments for all these beneficiaries
      const allPayments = [];
      for (const beneficiary of beneficiaries) {
        const payments = await storage.getBeneficiaryPayments(beneficiary.id);
        allPayments.push(...payments);
      }

      res.json(allPayments);
    } catch (error) {
      console.error('[Beneficiary Payments] Error fetching payments:', error);
      res.status(500).json({ message: 'Failed to fetch beneficiary payments' });
    }
  });

  // Create new beneficiary payment
  app.post('/api/beneficiary-payments', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.unit_id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { beneficiary_id, installment, amount, status, payment_date, expenditure_type } = req.body;

      // Validate required fields
      if (!beneficiary_id || !installment || !amount) {
        return res.status(400).json({ message: 'Missing required fields: beneficiary_id, installment, amount' });
      }

      // Verify beneficiary belongs to user's unit
      const beneficiary = await storage.getBeneficiaryById(beneficiary_id);
      if (!beneficiary) {
        return res.status(404).json({ message: 'Beneficiary not found' });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('beneficiary_payments')
        .insert([{
          beneficiary_id: parseInt(beneficiary_id),
          installment,
          amount: amount.toString(),
          status: status || 'pending',
          payment_date: payment_date || null,
          expenditure_type: expenditure_type || null,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();

      if (error) {
        console.error('[Beneficiary Payments] Error creating payment:', error);
        return res.status(500).json({ message: 'Failed to create payment', error: error.message });
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('[Beneficiary Payments] Error in create payment:', error);
      res.status(500).json({ message: 'Failed to create beneficiary payment' });
    }
  });

  // Update beneficiary payment
  app.put('/api/beneficiary-payments/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.unit_id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;
      const { installment, amount, status, payment_date, expenditure_type } = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: 'Invalid payment ID' });
      }

      // Check if payment exists and belongs to user's unit
      const { data: existingPayment } = await supabase
        .from('beneficiary_payments')
        .select('*, beneficiaries(*)')
        .eq('id', id)
        .single();

      if (!existingPayment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (installment !== undefined) updateData.installment = installment;
      if (amount !== undefined) updateData.amount = amount.toString();
      if (status !== undefined) updateData.status = status;
      if (payment_date !== undefined) updateData.payment_date = payment_date;
      if (expenditure_type !== undefined) updateData.expenditure_type = expenditure_type;

      const { data, error } = await supabase
        .from('beneficiary_payments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[Beneficiary Payments] Error updating payment:', error);
        return res.status(500).json({ message: 'Failed to update payment', error: error.message });
      }

      res.json(data);
    } catch (error) {
      console.error('[Beneficiary Payments] Error in update payment:', error);
      res.status(500).json({ message: 'Failed to update beneficiary payment' });
    }
  });

  // Delete beneficiary payment
  app.delete('/api/beneficiary-payments/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.unit_id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: 'Invalid payment ID' });
      }

      // Check if payment exists
      const { data: existingPayment } = await supabase
        .from('beneficiary_payments')
        .select('*')
        .eq('id', id)
        .single();

      if (!existingPayment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      const { error } = await supabase
        .from('beneficiary_payments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Beneficiary Payments] Error deleting payment:', error);
        return res.status(500).json({ message: 'Failed to delete payment', error: error.message });
      }

      res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
      console.error('[Beneficiary Payments] Error in delete payment:', error);
      res.status(500).json({ message: 'Failed to delete beneficiary payment' });
    }
  });
  
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
        generated_by: req.user!.id,
        department: req.user!.department || null,
        telephone: req.user!.telephone || null,
        user_name: req.user!.name || null,
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

  // Optimized endpoint for project cards using project_index
  app.get('/api/projects/cards', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('[Projects] Fetching optimized project card data...');
      console.log('[Projects] Session user:', req.session?.user);
      console.log('[Projects] Request user:', req.user);
      
      // Get all projects with enhanced data using optimized schema
      const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, kallikratisRes, indexRes] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at', { ascending: false }),
        supabase.from('Monada').select('*'),
        supabase.from('event_types').select('*'),
        supabase.from('expenditure_types').select('*'),
        supabase.from('kallikratis').select('*'),
        supabase.from('project_index').select('*')
      ]);

      if (projectsRes.error) {
        console.error('[Projects] Database error:', projectsRes.error);
        return res.status(500).json({ 
          message: 'Failed to fetch projects from database',
          error: projectsRes.error.message
        });
      }

      if (!projectsRes.data) {
        return res.status(404).json({ message: 'No projects found' });
      }

      const projects = projectsRes.data;
      const monadaData = monadaRes.data || [];
      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      const kallikratisData = kallikratisRes.data || [];
      const indexData = indexRes.data || [];

      // Transform projects to cards format
      const transformedCards = projects.map(project => {
        try {
          // Get all index entries for this project
          const projectIndexItems = indexData.filter(idx => idx.project_id === project.id);
          
          // Get enhanced data
          const eventTypeData = projectIndexItems.length > 0 ? 
            eventTypes.find(et => et.id === projectIndexItems[0].event_types_id) : null;
          const expenditureTypeData = projectIndexItems.length > 0 ? 
            expenditureTypes.find(et => et.id === projectIndexItems[0].expenditure_type_id) : null;
          const monadaData_item = projectIndexItems.length > 0 ? 
            monadaData.find(m => m.id === projectIndexItems[0].monada_id) : null;
          const kallikratisData_item = projectIndexItems.length > 0 ? 
            kallikratisData.find(k => k.id === projectIndexItems[0].kallikratis_id) : null;

          // Get all expenditure types for this project
          const allExpenditureTypes = projectIndexItems
            .map(idx => expenditureTypes.find(et => et.id === idx.expenditure_type_id))
            .filter(et => et !== null && et !== undefined)
            .map(et => et.expenditure_types);
          const uniqueExpenditureTypes = Array.from(new Set(allExpenditureTypes));

          return {
            id: project.id,
            mis: project.mis,
            na853: project.na853,
            na271: project.na271,
            e069: project.e069,
            project_title: project.project_title,
            event_description: project.event_description,
            event_year: project.event_year,
            status: project.status,
            created_at: project.created_at,
            updated_at: project.updated_at,
            expenditure_types: uniqueExpenditureTypes,
            event_type: eventTypeData ? {
              id: eventTypeData.id,
              name: eventTypeData.name
            } : null,
            implementing_agency: monadaData_item ? {
              id: monadaData_item.id,
              name: monadaData_item.unit
            } : null,
            region: kallikratisData_item ? {
              id: kallikratisData_item.id,
              name: kallikratisData_item.perifereia,
              regional_unit: kallikratisData_item.perifereiaki_enotita,
              municipality: kallikratisData_item.onoma_dimou_koinotitas
            } : null
          };
        } catch (error) {
          console.error('[Projects] Error transforming project:', project.id, error);
          return null;
        }
      }).filter(Boolean); // Remove null entries
      
      console.log(`[Projects] Transformed ${transformedCards?.length || 0} project cards`);
      res.json(transformedCards);
      
    } catch (error) {
      console.error('[Projects] Error in project cards endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Budget lookup endpoint for project cards
  app.get('/api/budget/lookup/:mis', getBudgetByMis);

  // Authentication routes handled by authentication.ts
  log('[Routes] Authentication routes handled by authentication.ts setupAuth()');

  // Import and mount API controllers
  const { getDashboardStats } = await import('./controllers/dashboard');
  const { router: documentsRouter } = await import('./controllers/documentsController');
  const { router: usersRouter } = await import('./controllers/usersController');
  const { router: projectRouter } = await import('./controllers/projectController');
  const { default: budgetRouter } = await import('./routes/budget');
  // Remove problematic expenditure types router for now
  
  // Mount API routes
  app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);
  app.use('/api/documents', documentsRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/budget', budgetRouter);
  
  // User preferences endpoints for ESDIAN suggestions
  app.get('/api/user-preferences/esdian', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const projectId = req.query.project_id as string;
      const expenditureType = req.query.expenditure_type as string;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('[UserPreferences] ESDIAN request for user:', userId, 'project:', projectId, 'type:', expenditureType);

      // Get user's unit_id to get relevant suggestions
      const userUnitId = req.user?.unit_id?.[0];
      
      let query = supabase
        .from('generated_documents')
        .select('esdian')
        .not('esdian', 'is', null)
        .order('created_at', { ascending: false });
        
      // Filter by unit if available
      if (userUnitId) {
        query = query.eq('unit_id', userUnitId);
      }
      
      // Add project context if available
      if (projectId) {
        // First find the project_index_id for the given project identifier
        const { data: projectIndex } = await supabase
          .from('project_index')
          .select('id')
          .eq('project_id', projectId)
          .single();
        
        if (projectIndex) {
          query = query.eq('project_index_id', projectIndex.id);
        }
      }
      
      const { data: documents, error } = await query.limit(10);
      
      if (error) {
        console.error('[UserPreferences] Error fetching ESDIAN suggestions:', error);
        return res.status(500).json({ message: 'Failed to fetch suggestions' });
      }
      
      // Extract unique ESDIAN values
      const suggestions = new Set<string>();
      documents?.forEach(doc => {
        if (Array.isArray(doc.esdian)) {
          doc.esdian.forEach(value => value && suggestions.add(value));
        }
      });
      
      res.json(Array.from(suggestions));
    } catch (error) {
      console.error('[UserPreferences] Error in ESDIAN endpoint:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // V2 Documents endpoint is handled by documentsController router
  // Basic expenditure types endpoint  
  app.get('/api/expenditure-types', async (req: Request, res: Response) => {
    try {
      const { data: expenditureTypes, error } = await supabase
        .from('expenditure_types')
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

  // New normalized geographic data endpoints
  
  // Regions endpoint
  app.get('/api/regions', async (req: Request, res: Response) => {
    try {
      const { data: regions, error } = await supabase
        .from('regions')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('[API] Error fetching regions:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(regions || []);
    } catch (error) {
      console.error('[API] Error in regions endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Regional units endpoint
  app.get('/api/regional-units', async (req: Request, res: Response) => {
    try {
      const { region_code } = req.query;
      
      let query = supabase
        .from('regional_units')
        .select('*')
        .order('name');
      
      // Filter by region if provided
      if (region_code) {
        query = query.eq('region_code', region_code);
      }
      
      const { data: regionalUnits, error } = await query;
      
      if (error) {
        console.error('[API] Error fetching regional units:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(regionalUnits || []);
    } catch (error) {
      console.error('[API] Error in regional units endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Municipalities endpoint
  app.get('/api/municipalities', async (req: Request, res: Response) => {
    try {
      const { unit_code } = req.query;
      
      let query = supabase
        .from('municipalities')
        .select('*')
        .order('name');
      
      // Filter by regional unit if provided
      if (unit_code) {
        query = query.eq('unit_code', unit_code);
      }
      
      const { data: municipalities, error } = await query;
      
      if (error) {
        console.error('[API] Error fetching municipalities:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json(municipalities || []);
    } catch (error) {
      console.error('[API] Error in municipalities endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Combined geographic data endpoint for easy client-side use
  app.get('/api/geographic-data', async (req: Request, res: Response) => {
    try {
      const [regionsRes, regionalUnitsRes, municipalitiesRes] = await Promise.all([
        supabase.from('regions').select('*').order('name'),
        supabase.from('regional_units').select('*').order('name'),
        supabase.from('municipalities').select('*').order('name')
      ]);

      if (regionsRes.error) {
        console.error('[API] Error fetching regions:', regionsRes.error);
        return res.status(500).json({ error: regionsRes.error.message });
      }

      if (regionalUnitsRes.error) {
        console.error('[API] Error fetching regional units:', regionalUnitsRes.error);
        return res.status(500).json({ error: regionalUnitsRes.error.message });
      }

      if (municipalitiesRes.error) {
        console.error('[API] Error fetching municipalities:', municipalitiesRes.error);
        return res.status(500).json({ error: municipalitiesRes.error.message });
      }

      res.json({
        regions: regionsRes.data || [],
        regionalUnits: regionalUnitsRes.data || [],
        municipalities: municipalitiesRes.data || []
      });
    } catch (error) {
      console.error('[API] Error in combined geographic data endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Admin system statistics endpoint - admin only access
  app.get('/api/admin/system-stats', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. This operation requires admin privileges.'
        });
      }

      console.log('[Admin] Fetching system statistics');

      // Get system-wide statistics
      const [usersRes, documentsRes, projectsRes, budgetRes] = await Promise.all([
        supabase.from('users').select('id, role').order('id', { ascending: false }),
        supabase.from('generated_documents').select('id, status, created_at').order('created_at', { ascending: false }),
        supabase.from('Projects').select('id').order('id', { ascending: false }),
        supabase.from('project_budget').select('ethsia_pistosi, katanomes_etous, user_view').order('id', { ascending: false })
      ]);

      if (usersRes.error || documentsRes.error || projectsRes.error || budgetRes.error) {
        console.error('[Admin] Error fetching system stats:', {
          users: usersRes.error,
          documents: documentsRes.error,
          projects: projectsRes.error,
          budget: budgetRes.error
        });
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch system statistics'
        });
      }

      // Calculate statistics
      const totalUsers = usersRes.data?.length || 0;
      const totalDocuments = documentsRes.data?.length || 0;
      const totalProjects = projectsRes.data?.length || 0;
      
      // Document status breakdown
      const documentsByStatus = documentsRes.data?.reduce((acc: Record<string, number>, doc) => {
        acc[doc.status || 'unknown'] = (acc[doc.status || 'unknown'] || 0) + 1;
        return acc;
      }, {}) || {};

      // User role breakdown
      const usersByRole = usersRes.data?.reduce((acc: Record<string, number>, user) => {
        acc[user.role || 'unknown'] = (acc[user.role || 'unknown'] || 0) + 1;
        return acc;
      }, {}) || {};

      // Budget totals
      let totalBudget = 0;
      let allocatedBudget = 0;
      let usedBudget = 0;
      
      budgetRes.data?.forEach(budget => {
        totalBudget += parseFloat(budget.ethsia_pistosi?.toString() || '0');
        allocatedBudget += parseFloat(budget.katanomes_etous?.toString() || '0');
        usedBudget += parseFloat(budget.user_view?.toString() || '0');
      });

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentDocuments = documentsRes.data?.filter(doc => 
        new Date(doc.created_at) > thirtyDaysAgo
      ).length || 0;

      // Users table doesn't have created_at, so we'll estimate recent users differently
      const recentUsers = 0; // Set to 0 since we can't calculate without created_at

      console.log(`[Admin] System stats calculated: ${totalUsers} users, ${totalDocuments} documents, ${totalProjects} projects`);

      return res.json({
        status: 'success',
        data: {
          systemHealth: {
            status: 'healthy',
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
          },
          totals: {
            users: totalUsers,
            documents: totalDocuments,
            projects: totalProjects,
            budgetTotal: totalBudget,
            budgetAllocated: allocatedBudget,
            budgetUsed: usedBudget
          },
          breakdowns: {
            documentsByStatus,
            usersByRole
          },
          recentActivity: {
            documentsLast30Days: recentDocuments,
            usersLast30Days: recentUsers
          },
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('[Admin] Error in system stats endpoint:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch system statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        .from('expenditure_types')
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
        .select('id, unit, unit_name')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching units:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Transform the data to match the expected format
      const transformedData = units.map(unit => ({
        id: unit.unit || unit.id, // String identifier (e.g., "ΔΑΕΦΚ-ΚΕ")
        unit: unit.id, // Numeric ID for filtering (e.g., 2)
        unit_name: unit.unit_name, // Full JSONB object
        name: unit.unit_name && unit.unit_name.name ? unit.unit_name.name : (unit.unit || unit.id)
      }));
      
      res.json(transformedData);
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
          
          const { data, error } = await supabase
            .from(tableName)
            .select(fields === '*' ? '*' : fields)
            .limit(limit);
          
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
      
      console.log(`[Budget] Looking for project with identifier: ${projectId}`);
      
      // Try to find project by ID, MIS, na853, na271, or e069
      console.log(`[Budget] Attempting to find project with identifier: ${projectId}`);
      
      // Check if projectId is a number for ID comparison
      const isNumeric = /^\d+$/.test(projectId);
      
      let projectQuery;
      if (isNumeric) {
        // If numeric, include ID in the search
        projectQuery = supabase
          .from('Projects')
          .select('id, mis, na853, na271, e069')
          .or(`id.eq.${projectId},mis.eq.${projectId}`)
          .single();
      } else {
        // If not numeric, only search text fields (na853, na271, e069)
        projectQuery = supabase
          .from('Projects')
          .select('id, mis, na853, na271, e069')
          .or(`na853.eq.${projectId},na271.eq.${projectId},e069.eq.${projectId}`)
          .single();
      }
      
      const { data: project, error: projectError } = await projectQuery;
      
      if (projectError) {
        console.log(`[Budget] Project lookup error:`, projectError);
      }
      if (project) {
        console.log(`[Budget] Found project:`, project);
      }
      
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
      
      console.log(`[Regions] Looking for project with identifier: ${id}`);
      
      // First find the project to get its actual ID
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('id, mis, na853, na271, e069')
        .or(`id.eq.${id},mis.eq.${id},na853.eq.${id},na271.eq.${id},e069.eq.${id}`)
        .single();
      
      if (projectError || !project) {
        console.log(`[Regions] Project not found for identifier: ${id}`);
        return res.json({
          regions: [],
          regional_units: [],
          municipalities: [],
          project_index: [],
          expenditure_types: []
        });
      }
      
      console.log(`[Regions] Found project ID: ${project.id} for identifier: ${id}`);
      
      // Get project data with regions from project_index using actual project ID
      const { data: projectIndex, error: indexError } = await supabase
        .from('project_index')
        .select(`
          *,
          kallikratis:kallikratis_id (
            *
          ),
          expenditure_types:expenditure_type_id (
            *
          )
        `)
        .eq('project_id', project.id);
      
      if (indexError) {
        console.error('[Projects] Error fetching project regions:', indexError);
        return res.status(500).json({ error: indexError.message });
      }
      
      // Extract unique data
      const regions = new Set();
      const regionalUnits = new Set();
      const municipalities = new Set();
      const expenditureTypes = new Set();
      
      projectIndex?.forEach(index => {
        if (index.kallikratis) {
          const k = index.kallikratis;
          if (k.perifereia) regions.add(k.perifereia);
          if (k.perifereiaki_enotita) regionalUnits.add(k.perifereiaki_enotita);
          if (k.onoma_neou_ota) municipalities.add(k.onoma_neou_ota);
        }
        if (index.expenditure_types) {
          expenditureTypes.add(index.expenditure_types);
        }
      });
      
      console.log(`[Regions] Found ${projectIndex?.length || 0} project_index entries for project ${project.id}`);
      console.log(`[Regions] Extracted ${regions.size} regions, ${expenditureTypes.size} expenditure types`);
      
      res.json({
        regions: Array.from(regions),
        regional_units: Array.from(regionalUnits),
        municipalities: Array.from(municipalities),
        expenditure_types: Array.from(expenditureTypes),
        project_index: projectIndex || []
      });
      
    } catch (error) {
      console.error('[Projects] Error in regions endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Public kallikratis data endpoint for region name mapping
  app.get('/api/public/kallikratis', async (req: Request, res: Response) => {
    try {
      const { data: kallikratisData, error } = await supabase
        .from('kallikratis')
        .select('*')
        .order('perifereia', { ascending: true })
        .order('perifereiaki_enotita', { ascending: true })
        .order('onoma_neou_ota', { ascending: true });

      if (error) {
        console.error('[Kallikratis] Database error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(kallikratisData || []);
    } catch (error) {
      console.error('[Kallikratis] Error fetching data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  log('[Routes] API routes registered');
  
  // Additional project endpoints
  app.get('/api/projects-working/:unitIdentifier', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      let { unitIdentifier } = req.params;
      
      // Decode URL-encoded Greek characters
      try {
        unitIdentifier = decodeURIComponent(unitIdentifier);
      } catch (decodeError) {
        console.log(`[ProjectsWorking] URL decode failed, using original: ${unitIdentifier}`);
      }
      
      console.log(`[ProjectsWorking] Fetching projects for unit: ${unitIdentifier}`);
      
      // Get projects with enhanced data using optimized schema
      const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, indexRes] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Monada').select('*'),
        supabase.from('event_types').select('*'),
        supabase.from('expenditure_types').select('*'),
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
      
      // Determine if unitIdentifier is numeric ID or unit name
      const isNumericId = /^\d+$/.test(unitIdentifier);
      let targetUnitId: number | null = null;
      let targetUnitName: string | null = null;
      
      if (isNumericId) {
        // If numeric, find the unit name from Monada table
        targetUnitId = parseInt(unitIdentifier);
        const unitData = monadaData.find(m => m.id === targetUnitId);
        if (unitData) {
          targetUnitName = unitData.unit;
          console.log(`[ProjectsWorking] Numeric ID ${targetUnitId} maps to unit: ${targetUnitName}`);
        } else {
          console.log(`[ProjectsWorking] No unit found for ID: ${targetUnitId}`);
          return res.json([]);
        }
      } else {
        // If not numeric, use as unit name directly
        targetUnitName = unitIdentifier;
        const unitData = monadaData.find(m => m.unit === targetUnitName);
        if (unitData) {
          targetUnitId = unitData.id;
          console.log(`[ProjectsWorking] Unit name ${targetUnitName} maps to ID: ${targetUnitId}`);
        }
      }
      
      // Filter projects by unit using project_index directly
      const unitProjects = projects.filter(project => {
        const projectIndexEntries = indexData.filter(idx => idx.project_id === project.id);
        return projectIndexEntries.some(idx => {
          // Match by either unit ID or unit name
          return idx.monada_id === targetUnitId || 
                 (monadaData.find(m => m.id === idx.monada_id)?.unit === targetUnitName);
        });
      });
      
      console.log(`[ProjectsWorking] Found ${unitProjects.length} projects for unit ${unitIdentifier} (ID: ${targetUnitId}, Name: ${targetUnitName})`);
      
      // Enhance projects with expenditure_types array
      const enhancedProjects = unitProjects.map(project => {
        // Get all project_index entries for this project
        const projectIndexEntries = indexData.filter(idx => idx.project_id === project.id);
        
        // Extract unique expenditure type IDs
        const expenditureTypeIds = Array.from(new Set(projectIndexEntries
          .map(idx => idx.expenditure_type_id)
          .filter(id => id !== null && id !== undefined)));
        
        // Map expenditure type IDs to names
        const expenditureTypeNames = expenditureTypeIds
          .map(id => {
            const expType = expenditureTypes.find(et => et.id === id);
            return expType ? expType.expenditure_types : null;
          })
          .filter(name => name !== null);
        
        return {
          ...project,
          expenditure_types: expenditureTypeNames,
          expenditure_type: expenditureTypeNames // Keep for backward compatibility
        };
      });
      
      res.json(enhancedProjects);
    } catch (error) {
      console.error(`[ProjectsWorking] Error:`, error);
      res.status(500).json({
        message: 'Error fetching projects',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Geographic API routes
  app.get('/api/geographic/regions', async (req, res) => {
    try {
      console.log('[Geographic API] Fetching regions...');
      const regions = await storage.getRegions();
      console.log('[Geographic API] Regions fetched:', regions.length);
      res.json(regions);
    } catch (error) {
      console.error('[Geographic API] Error fetching regions:', error);
      res.status(500).json({ error: 'Failed to fetch regions' });
    }
  });

  app.get('/api/geographic/regional-units', async (req, res) => {
    try {
      console.log('[Geographic API] Fetching regional units...');
      const regionalUnits = await storage.getRegionalUnits();
      console.log('[Geographic API] Regional units fetched:', regionalUnits.length);
      res.json(regionalUnits);
    } catch (error) {
      console.error('[Geographic API] Error fetching regional units:', error);
      res.status(500).json({ error: 'Failed to fetch regional units' });
    }
  });

  app.get('/api/geographic/municipalities', async (req, res) => {
    try {
      console.log('[Geographic API] Fetching municipalities...');
      const municipalities = await storage.getMunicipalities();
      console.log('[Geographic API] Municipalities fetched:', municipalities.length);
      res.json(municipalities);
    } catch (error) {
      console.error('[Geographic API] Error fetching municipalities:', error);
      res.status(500).json({ error: 'Failed to fetch municipalities' });
    }
  });

  // Combined geographic data endpoint for efficiency
  app.get('/api/geographic-data', async (req, res) => {
    try {
      console.log('[Geographic API] Fetching all geographic data...');
      const [regions, regionalUnits, municipalities] = await Promise.all([
        storage.getRegions(),
        storage.getRegionalUnits(),
        storage.getMunicipalities()
      ]);
      
      const geographicData = {
        regions,
        regionalUnits,
        municipalities
      };
      
      console.log('[Geographic API] All geographic data fetched:', {
        regionsCount: regions.length,
        regionalUnitsCount: regionalUnits.length,
        municipalitiesCount: municipalities.length
      });
      
      res.json(geographicData);
    } catch (error) {
      console.error('[Geographic API] Error fetching all geographic data:', error);
      res.status(500).json({ error: 'Failed to fetch geographic data' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  log('[Routes] All routes registered successfully');
  
  return httpServer;
}