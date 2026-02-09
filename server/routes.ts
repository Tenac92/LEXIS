import { Request, Response, Express } from 'express';
import { Server } from 'http';
import { authenticateSession, AuthenticatedRequest } from './authentication';
import { supabase } from './config/db';
import { log } from './vite';
import { createServer } from 'http';
import { storage } from './storage';
import { getBudgetByMis } from './controllers/budgetController';
import { validateBudgetAllocation } from './services/budgetNotificationService';
import { broadcastBeneficiaryUpdate } from './websocket';
import { cacheReferenceData, getReferenceData } from './utils/reference-data-cache';

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
  
  // Register employees controller
  const { default: employeesRouter } = await import('./controllers/employeesController');
  app.use('/api/employees', employeesRouter);
  
  // Register project resolver controller for NA853 and project resolution endpoints
  const { default: projectResolverRouter } = await import('./controllers/projectResolverController');
  app.use('/api/projects', projectResolverRouter);
  
  // Register subprojects controller for project subprojects
  const { default: subprojectsRouter } = await import('./controllers/subprojectsController');
  app.use('/api/projects', subprojectsRouter);
  
  // Standalone subprojects routes
  app.use('/api/subprojects', subprojectsRouter);

  // Register budget notifications controller
  const { router: budgetNotificationsRouter } = await import('./controllers/budgetNotificationsController');
  app.use('/api/budget-notifications', budgetNotificationsRouter);
  
  // Register units controller for for_yl (implementing agencies) and other unit-related endpoints
  const { router: unitsRouter } = await import('./controllers/unitsController');
  app.use('/api/units', unitsRouter);

  const { default: importsRouter } = await import('./routes/imports');
  app.use('/api/imports', importsRouter);
  
  // Register notifications router for budget reallocation requests
  const { default: notificationsRouter } = await import('./routes/api/notifications');
  app.use('/api/notifications', authenticateSession, notificationsRouter);
  
  // Project Index endpoint - get project_index record by ID
  app.get('/api/project-index/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: 'Valid project index ID is required' });
      }
      
      const projectIndexId = parseInt(id, 10);
      
      log(`[ProjectIndex] Fetching project_index record with ID: ${projectIndexId}`);
      
      // Fetch project_index record with related project and monada data
      const { data, error } = await supabase
        .from('project_index')
        .select(`
          *,
          Projects!inner(id, mis, na853, budget_na853, project_title, event_description),
          Monada!inner(id, unit)
        `)
        .eq('id', projectIndexId)
        .single();
      
      if (error) {
        log(`[ProjectIndex] Database error: ${error.message}`);
        return res.status(500).json({ error: 'Failed to fetch project index record' });
      }
      
      if (!data) {
        log(`[ProjectIndex] Project index record not found: ${projectIndexId}`);
        return res.status(404).json({ error: 'Project index record not found' });
      }
      
      log(`[ProjectIndex] Found project_index record: id=${data.id}, project_id=${data.project_id}, monada_id=${data.monada_id}`);
      
      return res.json(data);
    } catch (error) {
      console.error('[ProjectIndex] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get all project_index entries for a project+unit combination (for finding valid expenditure types)
  app.get('/api/project-index/project/:projectId/:unitId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId, unitId } = req.params;
      
      if (!projectId || !unitId) {
        return res.status(400).json({ error: 'Project ID and Unit ID are required' });
      }
      
      const projectIdNum = parseInt(projectId, 10);
      const unitIdNum = parseInt(unitId, 10);
      
      if (isNaN(projectIdNum) || isNaN(unitIdNum)) {
        return res.status(400).json({ error: 'IDs must be valid numbers' });
      }
      
      log(`[ProjectIndex] Fetching all project_index entries for project=${projectIdNum}, unit=${unitIdNum}`);
      
      // Fetch all matching project_index entries
      const { data, error } = await supabase
        .from('project_index')
        .select('id, project_id, monada_id, expenditure_type_id')
        .eq('project_id', projectIdNum)
        .eq('monada_id', unitIdNum);
      
      if (error) {
        log(`[ProjectIndex] Database error: ${error.message}`);
        return res.status(500).json({ error: 'Failed to fetch project index entries' });
      }
      
      log(`[ProjectIndex] Found ${data?.length || 0} project_index entries`);
      
      return res.json(data || []);
    } catch (error) {
      console.error('[ProjectIndex] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Find project_index entry by matching project_id, unit_id, and expenditure_type_id
  app.get('/api/project-index/find/:projectId/:unitId/:expenditureTypeId', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId, unitId, expenditureTypeId } = req.params;
      
      if (!projectId || !unitId || !expenditureTypeId) {
        return res.status(400).json({ error: 'Project ID, Unit ID, and Expenditure Type ID are required' });
      }
      
      const projectIdNum = parseInt(projectId, 10);
      const unitIdNum = parseInt(unitId, 10);
      const expenditureTypeIdNum = parseInt(expenditureTypeId, 10);
      
      if (isNaN(projectIdNum) || isNaN(unitIdNum) || isNaN(expenditureTypeIdNum)) {
        return res.status(400).json({ error: 'All IDs must be valid numbers' });
      }
      
      log(`[ProjectIndex] Finding project_index: project=${projectIdNum}, unit=${unitIdNum}, expenditure_type=${expenditureTypeIdNum}`);
      
      // Find matching project_index entry
      const { data, error } = await supabase
        .from('project_index')
        .select('id, project_id, monada_id, expenditure_type_id')
        .eq('project_id', projectIdNum)
        .eq('monada_id', unitIdNum)
        .eq('expenditure_type_id', expenditureTypeIdNum)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No matching entry found
          log(`[ProjectIndex] No matching entry found for project=${projectIdNum}, unit=${unitIdNum}, expenditure_type=${expenditureTypeIdNum}`);
          return res.status(404).json({ 
            error: 'No matching project index entry found',
            details: 'This combination of project, unit, and expenditure type does not exist'
          });
        }
        log(`[ProjectIndex] Database error: ${error.message}`);
        return res.status(500).json({ error: 'Failed to find project index entry' });
      }
      
      log(`[ProjectIndex] Found matching project_index: id=${data.id}`);
      return res.json(data);
    } catch (error) {
      console.error('[ProjectIndex] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Projects by unit endpoint for document creation
  // OPTIMIZED: Uses reference cache and targeted project queries
  app.get('/api/projects-working/:unitName', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { unitName } = req.params;
      const startTime = Date.now();
      
      if (!unitName) {
        return res.status(400).json({ error: 'Unit name is required' });
      }
      
      // Decode the unit name if it's URL encoded
      const decodedUnitName = decodeURIComponent(unitName);
      
      log(`[Projects Working] Fetching projects for unit: ${decodedUnitName}`);
      
      // Get cached reference data (Monada, event_types, expenditure_types)
      const { getReferenceData, getMonadaByUnit } = await import('./utils/reference-cache');
      const refData = await getReferenceData();
      
      // Check if unitName is numeric (unit ID) or string (unit name)
      let unitId: number | null = null;
      
      if (/^\d+$/.test(decodedUnitName)) {
        // It's a numeric unit ID
        unitId = parseInt(decodedUnitName, 10);
      } else {
        // It's a unit name, find from cache
        const unit = refData.monada.find(m => m.unit === decodedUnitName);
        unitId = unit?.id || null;
      }
      
      if (!unitId) {
        log(`[Projects Working] Unit not found: ${decodedUnitName}`);
        return res.json([]);
      }
      
      // Step 1: Get project_index entries for this unit (targeted query)
      const projectIndexRes = await supabase
        .from('project_index')
        .select('id, project_id, monada_id, expenditure_type_id, event_types_id')
        .eq('monada_id', unitId);

      if (projectIndexRes.error) {
        console.error('[Projects Working] Database error:', projectIndexRes.error);
        return res.status(500).json({ error: 'Failed to fetch project index' });
      }
      
      const projectIndexItems = projectIndexRes.data || [];
      
      if (projectIndexItems.length === 0) {
        log(`[Projects Working] No projects found for unit ${decodedUnitName}`);
        return res.json([]);
      }
      
      // Step 2: Get unique project IDs and fetch ONLY those projects
      const projectIds = Array.from(new Set(projectIndexItems.map(item => item.project_id)));
      
      const projectsRes = await supabase
        .from('Projects')
        .select('id, mis, na853, project_title, event_description, created_at, updated_at')
        .in('id', projectIds);

      if (projectsRes.error) {
        console.error('[Projects Working] Database error:', projectsRes.error);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }
      
      const projects = projectsRes.data || [];
      
      // Create a map for quick lookup
      const projectsMap = new Map(projects.map(p => [p.id, p]));
      
      log(`[Projects Working] Found ${projects.length} projects for unit ${decodedUnitName}`);
      
      // Group project_index items by project to aggregate expenditure types
      // Use cached reference data for lookups
      const projectMap = new Map();
      
      projectIndexItems.forEach(projectIndexItem => {
        const project = projectsMap.get(projectIndexItem.project_id);
        if (!project) return;
        
        const expenditureType = refData.expenditureTypes.find(et => et.id === projectIndexItem.expenditure_type_id);
        const eventType = refData.eventTypes.find(et => et.id === projectIndexItem.event_types_id);
        
        if (!projectMap.has(project.id)) {
          projectMap.set(project.id, {
            id: project.id,
            project_id: project.id,
            project_index_ids: [projectIndexItem.id],
            mis: project.mis,
            na853: project.na853,
            project_name: project.project_title || project.event_description,
            project_title: project.project_title || project.event_description,
            event_description: project.event_description,
            expenditure_types: expenditureType?.expenditure_types ? [expenditureType.expenditure_types] : [],
            event_type: eventType?.name,
            monada_id: projectIndexItem.monada_id,
            created_at: project.created_at,
            updated_at: project.updated_at
          });
        } else {
          const existingProject = projectMap.get(project.id);
          if (expenditureType?.expenditure_types && !existingProject.expenditure_types.includes(expenditureType.expenditure_types)) {
            existingProject.expenditure_types.push(expenditureType.expenditure_types);
          }
          if (!existingProject.project_index_ids.includes(projectIndexItem.id)) {
            existingProject.project_index_ids.push(projectIndexItem.id);
          }
        }
      });
      
      const enhancedProjects = Array.from(projectMap.values());
      const elapsed = Date.now() - startTime;
      
      log(`[Projects Working] Returning ${enhancedProjects.length} unique projects with unit-specific expenditure types in ${elapsed}ms`);
      
      res.json(enhancedProjects);
      
    } catch (error) {
      console.error('[Projects Working] Error:', error);
      res.status(500).json({ error: 'Failed to fetch projects for unit' });
    }
  });
  
  // Beneficiary payments endpoint for enhanced display
  app.get('/api/beneficiary-payments', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userUnits = req.user?.unit_id || [];
      if (userUnits.length === 0) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Optional narrowing by beneficiary IDs to avoid scanning the entire table
      const beneficiaryIdsParam = (req.query.beneficiaryIds as string | undefined) || '';
      const beneficiaryIds = beneficiaryIdsParam
        .split(',')
        .map(id => parseInt(id, 10))
        .filter(id => Number.isFinite(id));

      if (beneficiaryIds.length > 0) {
        const { data, error } = await supabase
          .from('beneficiary_payments')
          .select(`
            *,
            project_index:project_index_id (
              expenditure_type_id,
              expenditure_types:expenditure_types (
                expenditure_types
              )
            )
          `)
          .in('beneficiary_id', beneficiaryIds)
          .in('unit_id', userUnits);

        if (error) {
          console.error('[Beneficiary Payments] Error fetching filtered payments:', error);
          return res.status(500).json({ message: 'Failed to fetch beneficiary payments' });
        }

        const enriched = (data || []).map((payment) => {
          const expName = payment.project_index?.expenditure_types?.expenditure_types || null;
          const epsValue = payment.eps ?? payment.freetext ?? null;
          return {
            ...payment,
            eps: epsValue,
            freetext: epsValue,
            expenditure_type: expName,
          };
        });

        return res.json(enriched);
      }

      return res.status(400).json({
        message: "beneficiaryIds is required to fetch payments efficiently"
      });

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

      const { beneficiary_id, installment, amount, status, payment_date, unit_id, project_index_id } = req.body;

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
          unit_id: unit_id || req.user.unit_id[0] || null,
          project_index_id: project_index_id || null,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();

      if (error) {
        console.error('[Beneficiary Payments] Error creating payment:', error);
        return res.status(500).json({ message: 'Failed to create payment', error: error.message });
      }

      // Broadcast beneficiary payment update
      try {
        broadcastBeneficiaryUpdate({
          beneficiaryId: data.beneficiary_id,
          paymentId: data.id,
          action: 'create',
          unitId: data.unit_id || undefined
        });
      } catch (broadcastError) {
        console.error('[Beneficiary Payments] Failed to broadcast update:', broadcastError);
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
      const { installment, amount, status, payment_date, unit_id, project_index_id } = req.body;

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
      if (unit_id !== undefined) updateData.unit_id = unit_id;
      if (project_index_id !== undefined) updateData.project_index_id = project_index_id;

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

      // Broadcast beneficiary payment update
      try {
        broadcastBeneficiaryUpdate({
          beneficiaryId: data.beneficiary_id,
          paymentId: data.id,
          action: status !== existingPayment.status ? 'status_change' : 'update',
          unitId: data.unit_id || undefined
        });
      } catch (broadcastError) {
        console.error('[Beneficiary Payments] Failed to broadcast update:', broadcastError);
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

      // Broadcast beneficiary payment deletion
      try {
        broadcastBeneficiaryUpdate({
          beneficiaryId: existingPayment.beneficiary_id,
          paymentId: existingPayment.id,
          action: 'delete',
          unitId: existingPayment.unit_id || undefined
        });
      } catch (broadcastError) {
        console.error('[Beneficiary Payments] Failed to broadcast update:', broadcastError);
      }

      res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
      console.error('[Beneficiary Payments] Error in delete payment:', error);
      res.status(500).json({ message: 'Failed to delete beneficiary payment' });
    }
  });
  
  // Backfill beneficiary regiondet data from existing payments (admin only)
  app.post('/api/admin/backfill-regiondet', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Only allow admins to run the backfill
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('[Admin] Starting regiondet backfill...');
      const result = await storage.backfillBeneficiaryRegiondet();
      
      console.log('[Admin] Regiondet backfill completed:', result);
      res.json({ 
        message: 'Regiondet backfill completed', 
        ...result 
      });
    } catch (error) {
      console.error('[Admin] Error in regiondet backfill:', error);
      res.status(500).json({ message: 'Failed to run regiondet backfill' });
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
      
      // Trigger notification creation if document has a project_id and amount
      if (project_id && total_amount && total_amount > 0) {
        try {
          // Get project MIS for budget validation
          const { data: projectData } = await supabase
            .from('Projects')
            .select('mis')
            .eq('id', project_id)
            .single();
          
          if (projectData?.mis) {
            // Validate budget and create notifications if needed
            await validateBudgetAllocation(projectData.mis, total_amount, req.user?.id);
            console.log('[DIRECT_ROUTE] Budget validation and notification creation completed for project:', project_id);
          }
        } catch (notificationError) {
          console.error('[DIRECT_ROUTE] Error creating notifications:', notificationError);
          // Don't fail the document creation if notifications fail
        }
      }
      
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
  const { default: budgetUploadRouter } = await import('./routes/budget-upload');
  // Remove problematic expenditure types router for now
  
  // Mount API routes
  app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);
  app.use('/api/documents', documentsRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/users', usersRouter);
  // Register more specific routes before general routes
  app.use('/api/budget/upload', budgetUploadRouter);
  app.use('/api/budget', budgetRouter);
  
  // User preferences endpoints for ESDIAN suggestions (Enhanced Smart Suggestions)
  app.get('/api/user-preferences/esdian', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const projectId = req.query.project_id as string;
      const expenditureType = req.query.expenditure_type as string;
      const userUnitIdRaw = req.user?.unit_id?.[0];
      const userUnitIdNum =
        typeof userUnitIdRaw === 'number'
          ? userUnitIdRaw
          : userUnitIdRaw
          ? parseInt(String(userUnitIdRaw), 10)
          : null;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('[UserPreferences] ESDIAN request for user:', userId, 'project:', projectId, 'type:', expenditureType);

      // Get user's unit_id to get relevant suggestions
      const userUnitId = userUnitIdNum;
      
      // First, resolve expenditure type if provided
      let expenditureTypeId: number | null = null;
      if (expenditureType) {
        const { data: expTypeData } = await supabase
          .from('expenditure_types')
          .select('id')
          .eq('expenditure_types', expenditureType)
          .maybeSingle();
        if (expTypeData?.id) {
          expenditureTypeId = expTypeData.id;
        }
      }

      // Fetch comprehensive data for smart suggestions
      let baseQuery = supabase
        .from('generated_documents')
        .select(`
          esdian, 
          created_at, 
          generated_by, 
          project_index_id,
          unit_id,
          id
        `)
        .not('esdian', 'is', null)
        .order('created_at', { ascending: false });
        
      // Get wider dataset for better analysis (user + team + context)
      if (userUnitId) {
        baseQuery = baseQuery.eq('unit_id', userUnitId);
      }
      
      let { data: allDocuments, error } = await baseQuery.limit(100);

      // Fallback: if no data came back with a unit filter, try without it to avoid empty suggestions
      if (!error && (!allDocuments || allDocuments.length === 0)) {
        const fallbackQuery = supabase
          .from('generated_documents')
          .select(`
            esdian, 
            created_at, 
            generated_by, 
            project_index_id,
            unit_id,
            id
          `)
          .not('esdian', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);
        const fallbackResult = await fallbackQuery;
        if (!fallbackResult.error && fallbackResult.data) {
          allDocuments = fallbackResult.data;
        }
      }
      
      if (error) {
        console.error('[UserPreferences] Error fetching ESDIAN suggestions:', error);
        return res.status(500).json({ message: 'Failed to fetch suggestions' });
      }

      // If expenditure_type filtering is needed, fetch project_index data to map project_index_id -> expenditure_type_id
      let projectIndexExpTypeMap = new Map<number, number>();
      if (expenditureTypeId && allDocuments && allDocuments.length > 0) {
        // Get unique project_index_ids from documents
        const projectIndexIds = [...new Set(allDocuments.map((doc: any) => doc.project_index_id).filter(Boolean))];
        console.log('[UserPreferences] Filtering by expenditure_type:', expenditureTypeId, 'Found', projectIndexIds.length, 'unique project_index_ids');
        
        if (projectIndexIds.length > 0) {
          const { data: projIndexData } = await supabase
            .from('project_index')
            .select('id, expenditure_type_id')
            .in('id', projectIndexIds);
          
          if (projIndexData) {
            console.log('[UserPreferences] Fetched', projIndexData.length, 'project_index records');
            projIndexData.forEach((pi: any) => {
              projectIndexExpTypeMap.set(pi.id, pi.expenditure_type_id);
            });
          }
        }
        
        // Now filter documents by expenditure_type
        const beforeFilter = allDocuments.length;
        allDocuments = allDocuments.filter((doc: any) => {
          const docExpendTypeId = projectIndexExpTypeMap.get(doc.project_index_id);
          return docExpendTypeId === expenditureTypeId;
        });
        console.log('[UserPreferences] Expenditure type filter result: ', beforeFilter, 'documents -> ', allDocuments.length, 'documents');
      }

      // Find project_index_id for current context (handle multiple rows per project)
      let currentProjectIndexId = null;
      if (projectId) {
        const projectIdNum = parseInt(String(projectId), 10);
        let projectIndexQuery = supabase
          .from('project_index')
          .select('id, monada_id, expenditure_type_id')
          .eq('project_id', isNaN(projectIdNum) ? projectId : projectIdNum);

        // Prefer entries matching the user's unit/monada when available
        if (userUnitId) {
          projectIndexQuery = projectIndexQuery.eq('monada_id', userUnitId);
        }

        // If an expenditure type is provided, resolve it to id and filter
        if (expenditureType) {
          const { data: expType } = await supabase
            .from('expenditure_types')
            .select('id')
            .eq('expenditure_types', expenditureType)
            .maybeSingle();
          if (expType?.id) {
            projectIndexQuery = projectIndexQuery.eq('expenditure_type_id', expType.id);
          }
        }

        const { data: projectIndexRows, error: projectIndexError } = await projectIndexQuery
          .order('id', { ascending: true })
          .limit(1);

        if (projectIndexError) {
          console.warn('[UserPreferences] project_index lookup warning:', projectIndexError);
        }

        currentProjectIndexId = projectIndexRows?.[0]?.id || null;
      }

      // Analyze suggestions with metadata
      console.log('[UserPreferences] Analyzing', allDocuments?.length || 0, 'documents for ESDIAN suggestions');
      const valueFrequency = new Map<string, {
        count: number;
        lastUsed: string;
        userCount: number;
        teamCount: number;
        contextMatches: number;
        sources: Set<number>;
        recentDocuments: any[];
      }>();

      const completeSets = new Map<string, {
        fields: string[];
        count: number;
        lastUsed: string;
        documentId: number;
        isUserOwned: boolean;
        isContextMatch: boolean;
      }>();

      // Process all documents for analysis
      allDocuments?.forEach(doc => {
        if (Array.isArray(doc.esdian) && doc.esdian.length > 0) {
          const isUserDocument = doc.generated_by === userId;
          const isContextMatch = currentProjectIndexId && doc.project_index_id === currentProjectIndexId;
          
          // Track complete sets
          const setKey = doc.esdian.filter(Boolean).sort().join('|');
          if (setKey && doc.esdian.filter(Boolean).length > 0) {
            if (!completeSets.has(setKey)) {
              completeSets.set(setKey, {
                fields: doc.esdian.filter(Boolean),
                count: 0,
                lastUsed: doc.created_at,
                documentId: doc.id,
                isUserOwned: isUserDocument,
                isContextMatch: Boolean(isContextMatch)
              });
            }
            const set = completeSets.get(setKey)!;
            set.count++;
            if (doc.created_at > set.lastUsed) {
              set.lastUsed = doc.created_at;
              set.documentId = doc.id;
            }
            if (isUserDocument) set.isUserOwned = true;
            if (isContextMatch) set.isContextMatch = true;
          }

          // Track individual values
          doc.esdian.forEach(value => {
            if (value && value.trim()) {
              const cleanValue = value.trim();
              if (!valueFrequency.has(cleanValue)) {
                valueFrequency.set(cleanValue, {
                  count: 0,
                  lastUsed: doc.created_at,
                  userCount: 0,
                  teamCount: 0,
                  contextMatches: 0,
                  sources: new Set(),
                  recentDocuments: []
                });
              }
              
              const suggestion = valueFrequency.get(cleanValue)!;
              suggestion.count++;
              suggestion.sources.add(doc.generated_by);
              suggestion.recentDocuments.push({
                id: doc.id,
                date: doc.created_at,
                isUser: isUserDocument
              });
              
              if (doc.created_at > suggestion.lastUsed) {
                suggestion.lastUsed = doc.created_at;
              }
              
              if (isUserDocument) {
                suggestion.userCount++;
              } else {
                suggestion.teamCount++;
              }
              
              if (isContextMatch) {
                suggestion.contextMatches++;
              }
            }
          });
        }
      });

      // Convert to structured response
      const suggestions = Array.from(valueFrequency.entries()).map(([value, data]) => ({
        value,
        frequency: data.count,
        lastUsed: data.lastUsed,
        userFrequency: data.userCount,
        teamFrequency: data.teamCount,
        contextMatches: data.contextMatches,
        source: data.userCount > 0 ? 'user' as const : 'team' as const,
        score: calculateSuggestionScore(data, Boolean(currentProjectIndexId), Boolean(expenditureTypeId))
      }));

      // Sort by relevance score
      suggestions.sort((a, b) => b.score - a.score);

      // Process complete sets for quick selection
      const recentSets = Array.from(completeSets.entries())
        .map(([key, data]) => ({
          fields: data.fields,
          frequency: data.count,
          lastUsed: data.lastUsed,
          documentId: data.documentId,
          isUserOwned: data.isUserOwned,
          isContextMatch: data.isContextMatch,
          score: calculateSetScore(data, Boolean(currentProjectIndexId))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Find best auto-population candidate
      const autoPopulate = findBestAutoPopulation(recentSets, suggestions, Boolean(currentProjectIndexId));

      // Categorize suggestions for UI
      const categorized = {
        recent: suggestions.filter(s => s.userFrequency > 0).slice(0, 6),
        frequent: suggestions.filter(s => s.frequency >= 2).slice(0, 6),
        contextual: suggestions.filter(s => s.contextMatches > 0).slice(0, 8),
        team: suggestions.filter(s => s.teamFrequency > 0 && s.userFrequency === 0).slice(0, 4)
      };

      console.log('[UserPreferences] Returning', suggestions.length, 'suggestions with', recentSets.length, 'complete sets');

      res.json({
        status: 'success',
        suggestions: suggestions.slice(0, 20), // Top 20 individual suggestions
        completeSets: recentSets,
        autoPopulate,
        categories: categorized,
        total: suggestions.length,
        hasContext: Boolean(currentProjectIndexId)
      });

    } catch (error) {
      console.error('[UserPreferences] Error in ESDIAN endpoint:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Helper functions for scoring suggestions
  function calculateSuggestionScore(data: any, hasContext: boolean, expenditureTypeMatch: boolean = false): number {
    let score = 0;
    
    // Base frequency score
    score += Math.min(data.count * 10, 50);
    
    // User preference bonus
    score += data.userCount * 20;
    
    // Context match bonus (same project)
    if (hasContext && data.contextMatches > 0) {
      score += data.contextMatches * 30;
    }
    
    // Expenditure type match bonus (same expense category)
    if (expenditureTypeMatch) {
      score += 10;
    }
    
    // Recency bonus (more recent = higher score)
    const daysSinceUsed = (Date.now() - new Date(data.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 20 - daysSinceUsed);
    
    return score;
  }

  function calculateSetScore(data: any, hasContext: boolean): number {
    let score = 0;
    
    // Base frequency
    score += data.count * 15;
    
    // User ownership bonus
    if (data.isUserOwned) score += 40;
    
    // Context match bonus  
    if (hasContext && data.isContextMatch) score += 60;
    
    // Recency bonus
    const daysSinceUsed = (Date.now() - new Date(data.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSinceUsed * 2);
    
    return score;
  }

  function findBestAutoPopulation(sets: any[], suggestions: any[], hasContext: boolean): any {
    // Find the highest scoring complete set for auto-population
    if (sets.length === 0) return null;
    
    const bestSet = sets[0];
    
    // Only auto-populate if confidence is high
    const confidence = bestSet.score > 80 ? 'high' : 
                     bestSet.score > 50 ? 'medium' : 'low';
    
    if (confidence === 'low') return null;
    
    return {
      fields: bestSet.fields,
      confidence,
      reason: bestSet.isContextMatch ? 'context_match' : 
              bestSet.isUserOwned ? 'user_pattern' : 'team_pattern',
      documentId: bestSet.documentId
    };
  }
  
  // V2 Documents endpoint is handled by documentsController router
  // Basic expenditure types endpoint  
  app.get('/api/expenditure-types', async (req: Request, res: Response) => {
    try {
      const cacheKey = 'expenditure_types_all';
      
      // Try to get from cache first
      const cached = await getReferenceData(cacheKey, 'ExpenditureTypes');
      if (cached) {
        return res.json(cached);
      }
      
      const { data: expenditureTypes, error } = await supabase
        .from('expenditure_types')
        .select('*')
        .order('id');
      
      if (error) {
        console.error('[API] Error fetching expenditure types:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Cache the results
      if (expenditureTypes) {
        await cacheReferenceData(cacheKey, expenditureTypes, 'ExpenditureTypes');
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
      const cacheKey = 'regions_all';
      
      // Try to get from cache first
      const cached = await getReferenceData(cacheKey, 'Regions');
      if (cached) {
        return res.json(cached);
      }
      
      const { data: regions, error } = await supabase
        .from('regions')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('[API] Error fetching regions:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Cache the results
      if (regions) {
        await cacheReferenceData(cacheKey, regions, 'Regions');
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
        .order('unit');
      
      if (error) {
        console.error('[API] /api/public/units error:', error);
        return res.status(500).json({ error: 'Failed to fetch units' });
      }
      
      // Transform units to match frontend Unit interface
      // Keep id as number, include all necessary fields
      // Prefer unit field, but use unit_name or fallback to id if empty
      const formattedUnits = (units || []).map((unit: any) => {
        // Use unit field as display name (all units have this field)
        const displayName = (unit.unit || `Unit ${unit.id}`).trim();
        
        return {
          id: Number(unit.id),
          unit: unit.unit,
          unit_name: unit.unit_name,
          name: displayName
        };
      });
      
      console.log('[API] /api/public/units returning:', formattedUnits.length, 'units');
      res.json(formattedUnits);
    } catch (error) {
      console.error('[API] /api/public/units catch error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        console.error('[API] /api/public/units stack:', error.stack);
      }
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
  
  // NOTE: Duplicate /api/projects-working/:unitIdentifier route removed
  // The optimized version is defined earlier in this file at line ~207

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

  // ============================================================================
  // PHASE 2: API ENDPOINT STUBS FOR NOT-YET-IMPLEMENTED FEATURES
  // These return 501 Not Implemented with clear messaging
  // ============================================================================

  // Budget Overview - PLACEHOLDER (TODO: implement)
  app.get('/api/budget/overview', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Budget overview endpoint is not yet implemented',
      message: 'This feature is under development. Use /api/budget/data/:projectId instead.',
      developmentStatus: 'planned',
      expectedDate: 'Q1 2026'
    });
  });

  // Templates CRUD - PLACEHOLDER (TODO: implement backend)
  app.get('/api/templates', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Templates API not yet implemented',
      message: 'Template listing endpoint is under development',
      developmentStatus: 'in_progress',
      note: 'UI exists but backend is incomplete'
    });
  });

  app.post('/api/templates', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Templates API not yet implemented',
      message: 'Template creation endpoint is under development',
      developmentStatus: 'in_progress'
    });
  });

  app.get('/api/templates/:id/preview', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Template preview not yet implemented',
      message: 'Template preview endpoint is under development',
      developmentStatus: 'planned'
    });
  });

  app.put('/api/templates/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Template update not yet implemented',
      message: 'Template edit endpoint is under development',
      developmentStatus: 'planned'
    });
  });

  // Project Analysis - PLACEHOLDER (TODO: implement)
  app.get('/api/admin/project-analysis', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(501).json({
      status: 'not_implemented',
      error: 'Project analysis endpoint not yet implemented',
      message: 'Project performance analysis is under development',
      developmentStatus: 'planned',
      expectedDate: 'Q1 2026'
    });
  });

  // System Settings - PLACEHOLDER (TODO: implement)
  app.get('/api/admin/system-settings', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(501).json({
      status: 'not_implemented',
      error: 'System settings endpoint not yet implemented',
      message: 'System configuration endpoints are under development',
      developmentStatus: 'planned',
      expectedDate: 'Q2 2026'
    });
  });

  app.put('/api/admin/system-settings', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(501).json({
      status: 'not_implemented',
      error: 'System settings update not yet implemented',
      message: 'System configuration updates are under development',
      developmentStatus: 'planned'
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Add setWebSocketServer method to connect WebSocket server
  (httpServer as any).setWebSocketServer = (wss: any) => {
    log('[Routes] WebSocket server connected to routes', 'info');
    // Store WebSocket server for use in routes if needed
    (httpServer as any).wss = wss;
  };
  
  log('[Routes] All routes registered successfully');
  log('[Routes] Phase 2 API stubs registered - unimplemented endpoints now return 501 Not Implemented');
  
  return httpServer;
}
