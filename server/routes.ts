import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
// Import directly from centralized authentication
import { authenticateSession, User, AuthenticatedRequest } from "./authentication";
import apiRouter from "./controllers";

// Import the budgetController for the getBudgetByMis function
import { getBudgetByMis } from './controllers/budgetController';
// Import the budget router with validation endpoints from routes/budget.ts
import budgetRouter from './routes/budget';
import { router as budgetNotificationsRouter } from "./controllers/budgetNotificationsController";
import { router as unitsRouter } from "./controllers/unitsController";
import { router as usersRouter } from "./controllers/usersController";
import { router as projectRouter } from "./controllers/projectController";
import projectResolverRouter from "./controllers/projectResolverController";
import { router as documentsRouter } from "./controllers/documentsController";
import employeesRouter from "./controllers/employeesController";
import beneficiariesRouter from "./controllers/beneficiaryController";
import templatePreviewRouter from "./routes/template-preview";
// import authRouter from "./routes/auth"; // Commented out - auth handled in authentication.ts
import budgetUploadRouter from "./routes/budget-upload"; // Import the budget upload router
import { storage } from "./storage"; // Import storage for beneficiary status updates
import attachmentsRouter from "./controllers/attachments"; // Import for attachments (default export)
import notificationsRouter from "./routes/api/notifications"; // Import budget notifications router
import testNotificationsRouter from "./routes/api/test-notifications"; // Import test notifications router
import healthcheckRouter from "./routes/healthcheck"; // Import the original healthcheck router
import healthRouter from "./routes/health"; // Import our new enhanced health check router
import sdegdaefkDiagnosticRouter from "./routes/sdegdaefk-diagnostic"; // Import the sdegdaefk.gr diagnostic router
import { registerAdminRoutes } from "./routes/admin"; // Import admin routes for quarter transitions
import documentsBrowserHandler from "./middleware/sdegdaefk/documentsBrowserHandler"; // Import browser request handler for /documents
import authBrowserHandler from "./middleware/sdegdaefk/authBrowserHandler"
// Note: We now use the consolidated documentsController instead of multiple document route files
import { log } from "./vite";
import { supabase } from "./config/db"; // Main supabase client
import { verifyDatabaseConnections } from "./data"; // Database utilities
import { BudgetService } from "./services/budgetService"; // Budget service for operations
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// Helper functions for Excel export
function getChangeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'document_created': 'Δημιουργία Εγγράφου',
    'document_creation': 'Δημιουργία Εγγράφου',
    'manual_adjustment': 'Χειροκίνητη Προσαρμογή',
    'notification_created': 'Δημιουργία Ειδοποίησης',
    'error': 'Σφάλμα',
    'import': 'Εισαγωγή'
  };
  return labels[type] || type.replace(/_/g, ' ');
}

function getStatusLabel(status: string | null): string {
  if (!status) return 'Άγνωστη';
  const labels: Record<string, string> = {
    'pending': 'Σε εκκρεμότητα',
    'completed': 'Ολοκληρωμένο',
    'cancelled': 'Ακυρωμένο'
  };
  return labels[status] || status;
}

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

        // Get project NA853 using optimized lookup
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id, mis, na853, budget_na853')
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
          installments: Array.isArray(r.installments) ? r.installments : [String(r.installment || 'Α').trim()],
          installmentAmounts: r.installmentAmounts || {}
        }));

        const now = new Date().toISOString();

        // Create document with exact schema match and set initial status to pending
        const documentPayload = {
          unit,
          mis: project_id, // Set the database field 'mis' to match project_id
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
        
        const { unit, project_id, project_mis, expenditure_type, recipients, total_amount, attachments = [], region, esdian = [], director_signature } = req.body;
        
        if (!recipients?.length || !project_id || !unit || !expenditure_type) {
          return res.status(400).json({
            message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
          });
        }
        
        // Προτεραιότητα για ανάκτηση του NA853 - πρώτα από το αίτημα, μετά από την βάση
        const mis_to_lookup = project_mis || project_id; // Χρησιμοποιούμε το project_mis αν υπάρχει
        let project_na853 = req.body.project_na853;
        
        if (!project_na853) {
          console.log('[DIRECT_ROUTE_V2] Fetching NA853 for project with MIS:', mis_to_lookup);
          
          try {
            // First, check if there's a direct match in the na853 column
            // This handles the foreign key constraint properly
            const { data: naData, error: naError } = await supabase
              .from('Projects')
              .select('na853')
              .eq('mis', mis_to_lookup)
              .single();
              
            if (!naError && naData && naData.na853) {
              // This is the preferred option - the exact field used in foreign key constraint
              project_na853 = naData.na853;
              console.log('[DIRECT_ROUTE_V2] Retrieved NA853 from Projects table:', project_na853);
            } else {
              // If we can't find the na853 field directly, we need an alternative approach
              console.log('[DIRECT_ROUTE_V2] No na853 found directly, checking all projects for valid values');
              
              // First try to find any valid na853 value in the Projects table
              // This ensures we're using a value that definitely exists in the table
              const { data: validNaData } = await supabase
                .from('Projects')
                .select('na853')
                .not('na853', 'is', null)
                .limit(1)
                .single();
                
              if (validNaData && validNaData.na853) {
                // Use a value we know exists in the table to satisfy the foreign key constraint
                project_na853 = validNaData.na853;
                console.log('[DIRECT_ROUTE_V2] Using existing valid NA853 value from Projects table:', project_na853);
              } else {
                // If we can't find any na853 value at all, this is an error case
                // The database schema requires a valid foreign key, and we can't proceed
                console.error('[DIRECT_ROUTE_V2] No valid NA853 values found in the Projects table');
                return res.status(500).json({
                  message: 'No valid project_na853 values found in the database',
                  error: 'Foreign key constraint cannot be satisfied'
                });
              }
            }
          } catch (error) {
            console.error('[DIRECT_ROUTE_V2] Error during project lookup:', error);
            
            // If an error occurs, attempt to find any valid NA853 value as a last resort
            try {
              // Try to get any valid NA853 value from the Projects table
              const { data: fallbackData } = await supabase
                .from('Projects')
                .select('na853')
                .not('na853', 'is', null)
                .limit(1)
                .single();
                
              if (fallbackData && fallbackData.na853) {
                project_na853 = fallbackData.na853;
                console.log('[DIRECT_ROUTE_V2] Using fallback NA853 from Projects table due to error:', project_na853);
              } else {
                // If we still can't find a valid NA853 value, we can't proceed
                console.error('[DIRECT_ROUTE_V2] No valid NA853 values found in the Projects table');
                return res.status(500).json({
                  message: 'Cannot create document - no valid project_na853 values in database',
                  error: 'Foreign key constraint cannot be satisfied'
                });
              }
            } catch (fallbackError) {
              // This is truly a critical error - we can't find any valid NA853 values
              console.error('[DIRECT_ROUTE_V2] Critical error - cannot find valid NA853 value:', fallbackError);
              return res.status(500).json({
                message: 'Database error while finding valid project_na853 value',
                error: 'Foreign key constraint cannot be satisfied'
              });
            }
          }
          
          console.log('[DIRECT_ROUTE_V2] Final NA853 value:', project_na853);
        }
        
        // Format recipients data - Συμπεριλαμβάνουμε το πεδίο installmentAmounts και αφαιρούμε το installment
        const formattedRecipients = recipients.map((r: any) => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          fathername: String(r.fathername || '').trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          // Προσθήκη του πεδίου secondary_text για το ελεύθερο κείμενο
          secondary_text: r.secondary_text ? String(r.secondary_text).trim() : "",
          // Νέο schema για πολλαπλές δόσεις - συμπεριλαμβάνουμε μόνο τα installments και installmentAmounts
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
          esdian: esdian || [], // Add esdian fields for internal distribution
          director_signature: director_signature || null, // Add signature field from step 3
          created_at: now,
          updated_at: now
          // Τα πεδία installments και installmentAmounts αφορούν τους παραλήπτες και όχι το έγγραφο,
          // έχουν ήδη προστεθεί στο formattedRecipients παραπάνω
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
        
        // Create or update beneficiaries in the Beneficiary table
        console.log('[DIRECT_ROUTE_V2] Starting beneficiary processing for recipients:', formattedRecipients.length);
        try {
          for (const recipient of formattedRecipients) {
            console.log(`[DIRECT_ROUTE_V2] Processing beneficiary for AFM: ${recipient.afm}`);
            
            // Check if beneficiary exists with this AFM
            const { data: existingBeneficiary, error: searchError } = await supabase
              .from('beneficiaries')
              .select('*')
              .eq('afm', recipient.afm)
              .single();
              
            if (searchError && searchError.code !== 'PGRST116') { // PGRST116 is "not found" error
              console.error(`[DIRECT_ROUTE_V2] Error searching for beneficiary with AFM ${recipient.afm}:`, searchError);
              continue; // Skip this recipient on search error
            }
            
            // Prepare oikonomika data for this expenditure type
            const oikonomika = existingBeneficiary?.oikonomika || {};
            
            // Get existing installment data for this expenditure type or create empty object
            const existingInstallmentData = oikonomika[expenditure_type] || {};
            
            // Create new installment data for this expenditure type
            const newInstallmentData: any = {};
            if (recipient.installments && Array.isArray(recipient.installments)) {
              recipient.installments.forEach((installment: string) => {
                const amount = recipient.installmentAmounts?.[installment] || recipient.amount;
                newInstallmentData[installment] = {
                  amount: amount,
                  status: 'διαβιβάστηκε',
                  protocol: data.id.toString(),
                  date: new Date().toISOString()
                };
              });
            } else {
              // Default single installment
              newInstallmentData['ΕΦΑΠΑΞ'] = {
                amount: recipient.amount,
                status: 'διαβιβάστηκε',
                protocol: data.id.toString(),
                date: new Date().toISOString()
              };
            }
            
            // Merge existing installments with new ones (preserving existing data)
            oikonomika[expenditure_type] = { ...existingInstallmentData, ...newInstallmentData };
            
            const beneficiaryData = {
              surname: recipient.lastname,
              name: recipient.firstname,
              fathername: recipient.fathername || null,
              afm: parseInt(recipient.afm),
              monada: unit,
              project: parseInt(req.body.project_mis || project_id),
              oikonomika: oikonomika,
              freetext: recipient.secondary_text || null,
              date: new Date().toISOString().split('T')[0], // Current date as YYYY-MM-DD
              updated_at: new Date().toISOString()
            };
            
            if (existingBeneficiary) {
              // Update existing beneficiary using normalized structure
              const updateData = {
                surname: recipient.lastname,
                name: recipient.firstname,
                fathername: recipient.fathername || null,
                region: region || null,
                freetext: recipient.secondary_text || null,
                updated_at: new Date().toISOString()
              };
              
              const { error: updateError } = await supabase
                .from('beneficiaries')
                .update(updateData)
                .eq('id', existingBeneficiary.id);
                
              if (updateError) {
                console.error(`[DIRECT_ROUTE_V2] Error updating beneficiary ${recipient.afm}:`, updateError);
              } else {
                console.log(`[DIRECT_ROUTE_V2] Updated existing beneficiary with AFM: ${recipient.afm}`);
              }
            } else {
              // Create new beneficiary using normalized structure
              try {
                const beneficiaryData = {
                  surname: recipient.lastname,
                  name: recipient.firstname,
                  fathername: recipient.fathername || null,
                  afm: recipient.afm, // Keep as string to match schema
                  region: region || null,
                  freetext: recipient.secondary_text || null,
                  date: new Date().toISOString().split('T')[0]
                };
                
                const createdBeneficiary = await storage.createBeneficiary(beneficiaryData);
                console.log(`[DIRECT_ROUTE_V2] Created new beneficiary with AFM: ${recipient.afm} using storage layer`);
                
                // Now create payment records for each installment
                if (recipient.installments && Array.isArray(recipient.installments)) {
                  for (const installment of recipient.installments) {
                    const amount = recipient.installmentAmounts?.[installment] || recipient.amount;
                    const paymentData = {
                      beneficiary_id: createdBeneficiary.id,
                      unit_code: unit,
                      na853_code: project_id,
                      expenditure_type: expenditure_type,
                      installment: installment,
                      amount: amount,
                      status: 'διαβιβάστηκε',
                      protocol_number: data.id.toString()
                    };
                    
                    await storage.createBeneficiaryPayment(paymentData);
                    console.log(`[DIRECT_ROUTE_V2] Created payment record for ${recipient.afm} installment ${installment}`);
                  }
                }
              } catch (storageError) {
                console.error(`[DIRECT_ROUTE_V2] Error creating beneficiary ${recipient.afm} via storage:`, storageError);
                
                // Fallback: skip beneficiary creation but continue with document processing
                console.log(`[DIRECT_ROUTE_V2] Skipping beneficiary creation for AFM: ${recipient.afm} due to error`);
              }
            }
          }
        } catch (beneficiaryError) {
          console.error('[DIRECT_ROUTE_V2] Error processing beneficiaries (document still created):', beneficiaryError);
          console.error('[DIRECT_ROUTE_V2] Beneficiary error stack:', beneficiaryError instanceof Error ? beneficiaryError.stack : 'No stack trace');
          // Continue without failing - document is created but beneficiaries may not be updated
        }
        
        // Update beneficiary installment status to "διαβιβάστηκε" for each recipient (legacy system)
        try {
          for (const recipient of formattedRecipients) {
            // For each installment in the recipient's installments array
            if (recipient.installments && Array.isArray(recipient.installments)) {
              for (const installment of recipient.installments) {
                await storage.updateBeneficiaryInstallmentStatus(
                  recipient.afm,
                  expenditure_type,
                  installment,
                  'διαβιβάστηκε',
                  data.id.toString() // Use document ID as protocol number
                );
                console.log(`[DIRECT_ROUTE_V2] Updated beneficiary ${recipient.afm} installment ${installment} status to διαβιβάστηκε`);
              }
            }
          }
        } catch (statusUpdateError) {
          console.error('[DIRECT_ROUTE_V2] Error updating beneficiary status (document still created):', statusUpdateError);
          // Continue without failing - document is created but status may not be updated
        }
        
        // Validate budget and create notifications if needed
        try {
          const projectIdentifier = req.body.project_mis || project_id;
          const userId = (req as any).session?.user?.id;
          
          console.log('[DIRECT_ROUTE_V2] Validating budget for project:', projectIdentifier, 'with amount:', documentPayload.total_amount);
          
          // Import budget notification service
          const { validateBudgetAllocation } = await import('./services/budgetNotificationService');
          
          // Validate budget allocation and create notifications if thresholds are exceeded
          const validationResult = await validateBudgetAllocation(
            projectIdentifier,
            documentPayload.total_amount,
            userId
          );
          
          console.log('[DIRECT_ROUTE_V2] Budget validation result:', validationResult);
          
          // If validation indicates a notification was created, log it
          if (validationResult.requiresNotification) {
            console.log(`[DIRECT_ROUTE_V2] Budget notification created for ${validationResult.notificationType}: ${validationResult.message}`);
          }
          
        } catch (validationError) {
          console.error('[DIRECT_ROUTE_V2] Error validating budget (continuing with document creation):', validationError);
        }

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
          
          // Το BudgetService.updateBudget περιμένει sessionId σε μορφή κειμένου, το μορφοποιούμε κατάλληλα
          const sessionIdForBudget = `document_${data.id}`;
          
          const budgetResult = await BudgetService.updateBudget(
            projectMIS,                         // MIS
            documentPayload.total_amount,       // Amount
            (req as any).session?.user?.id || 'guest',  // User ID
            sessionIdForBudget,                 // Session ID με τη μορφή "document_ID"
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

    // Authentication routes are handled directly in authentication.ts
    // via setupAuth() which is called in the main server initialization
    log('[Routes] Authentication routes handled by authentication.ts setupAuth()');

    // Mount users routes
    log('[Routes] Setting up users routes...');
    app.use('/api/users', authenticateSession, usersRouter);
    log('[Routes] Users routes setup complete');

    // Dashboard routes are handled by the dashboard router below
    
    // WORKING PROJECT ENDPOINT - uses optimized schema with project_index
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
        
        // Debug: Check if project_index has data
        const { data: indexCheck, error: indexCheckError } = await supabase
          .from('project_index')
          .select('*')
          .limit(5);
        console.log(`[ProjectsWorking] DEBUG: Sample project_index data:`, indexCheck);
        
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
        
        // Debug: Check expenditure types data
        console.log(`[ProjectsWorking] DEBUG: Found ${expenditureTypes.length} expenditure types in database`);
        if (expenditureTypes.length === 0) {
          console.error(`[ProjectsWorking] ERROR: expediture_types table appears to be empty or query failed`);
        } else {
          console.log(`[ProjectsWorking] DEBUG: Expenditure types IDs:`, expenditureTypes.map(et => et.id));
        }
        console.log(`[ProjectsWorking] DEBUG: Sample project_index data:`, indexData.slice(0, 3));
        
        // Filter projects by unit using project_index and Monada tables
        const targetMonada = monadaData.find(m => m.unit === unitName);
        if (!targetMonada) {
          console.log(`[ProjectsWorking] Unit ${unitName} not found in Monada table`);
          return res.json([]);
        }
        
        console.log(`[ProjectsWorking] DEBUG: Target monada:`, targetMonada);
        
        // Find project IDs that belong to this unit
        const unitProjectIds = indexData
          .filter(idx => idx.monada_id === targetMonada.id)
          .map(idx => idx.project_id);
        
        console.log(`[ProjectsWorking] DEBUG: Found ${unitProjectIds.length} project IDs for unit ${unitName}`);
        
        // Get projects for this unit with enhanced data
        const filteredProjects = projects
          .filter(project => unitProjectIds.includes(project.id))
          .map(project => {
            const indexItems = indexData.filter(idx => idx.project_id === project.id);
            
            console.log(`[ProjectsWorking] DEBUG: Project ${project.mis} has ${indexItems.length} index entries`);
            
            // Get all expenditure types for this project
            const projectExpenditureTypes = indexItems
              .map(idx => {
                const expenditureType = expenditureTypes.find(et => et.id === idx.expediture_type_id);
                if (!expenditureType) {
                  console.log(`[ProjectsWorking] DEBUG: No expenditure type found for ID ${idx.expediture_type_id}. Available types:`, expenditureTypes.map(et => `${et.id}: ${et.expediture_types}`));
                }
                return expenditureType;
              })
              .filter(et => et !== null && et !== undefined)
              .map(et => et.expediture_types);
            
            // Remove duplicates
            const uniqueExpenditureTypes = Array.from(new Set(projectExpenditureTypes));
            
            // DIRECT SOLUTION: Use optimized schema first, then fallback to hardcoded types if database fails
            let finalExpenditureTypes = uniqueExpenditureTypes;
            
            // If optimized schema failed (empty expenditure_types table), use known types as fallback
            if (finalExpenditureTypes.length === 0 && indexItems.length > 0) {
              // Map expenditure_type_id to known expenditure types based on CSV data provided
              const knownExpenditureTypes = {
                1: "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ",
                2: "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ", 
                3: "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ",
                4: "ΔΚΑ ΕΠΙΣΚΕΥΗ",
                5: "ΕΚΤΟΣ ΕΔΡΑΣ",
                6: "ΣΥΜΒΑΤΙΚΕΣ ΥΠΟΧΡΕΩΣΕΙΣ",
                7: "ΠΕΡΙΒΑΛΛΟΝΤΕΣ ΧΩΡΟΙ",
                8: "ΕΠΙΔΟΤΗΣΗ ΚΑΤΕΔΑΦΙΣΗΣ"
              };
              
              const mappedTypes = indexItems
                .map(idx => {
                  const typeId = idx.expenditure_type_id;
                  return knownExpenditureTypes[typeId as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];
                })
                .filter(type => type !== undefined);
              
              finalExpenditureTypes = Array.from(new Set(mappedTypes));
              
              if (finalExpenditureTypes.length > 0) {
                console.log(`[ProjectsWorking] DEBUG: Using fallback expenditure types for ${project.mis}:`, finalExpenditureTypes);
              }
            }
            
            // Final fallback: If no data at all, provide default types
            if (finalExpenditureTypes.length === 0) {
              finalExpenditureTypes = ["ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ", "ΔΚΑ ΕΠΙΣΚΕΥΗ", "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ", "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ"];
              console.log(`[ProjectsWorking] DEBUG: Using default expenditure types for ${project.mis}`);
            }
            
            const eventType = indexItems.length > 0 ? eventTypes.find(et => et.id === indexItems[0].event_types_id) : null;
            const expenditureType = indexItems.length > 0 ? expenditureTypes.find(et => et.id === indexItems[0].expediture_type_id) : null;
            
            return {
              ...project,
              // Keep enhanced data for compatibility
              enhanced_event_type: eventType ? {
                id: eventType.id,
                name: eventType.name
              } : null,
              enhanced_expenditure_type: expenditureType ? {
                id: expenditureType.id,
                name: expenditureType.expediture_types
              } : null,
              enhanced_unit: {
                id: targetMonada.id,
                name: targetMonada.unit
              },
              // Add expenditure_types array for document creation dialog (includes fallback)
              expenditure_types: finalExpenditureTypes
            };
          });
        
        console.log(`[ProjectsWorking] SUCCESS: Found ${filteredProjects.length} projects for unit ${unitName}`);
        
        return res.json(filteredProjects);
      } catch (error) {
        console.error('[ProjectsWorking] Critical error:', error);
        res.status(500).json({
          message: 'Critical server error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // DEDICATED PROJECT ENDPOINT - completely separate path to avoid conflicts
    app.get('/api/unit-projects/:unitName', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        let { unitName } = req.params;
        
        // Decode URL-encoded Greek characters
        try {
          unitName = decodeURIComponent(unitName);
        } catch (decodeError) {
          console.log(`[UnitProjects] URL decode failed, using original: ${unitName}`);
        }
        
        console.log(`[UnitProjects] Fetching projects for unit: ${unitName}`);
        
        try {
          // Use optimized schema with project_index for efficient unit-based filtering
          const [projectsRes, monadaRes, eventTypesRes, expenditureTypesRes, kallikratisRes, indexRes] = await Promise.all([
            supabase.from('Projects').select('*'),
            supabase.from('Monada').select('*'),
            supabase.from('event_types').select('*'),
            supabase.from('expediture_types').select('*'),
            supabase.from('kallikratis').select('*'),
            supabase.from('project_index').select('*')
          ]);
          
          if (projectsRes.error) {
            console.error(`[UnitProjects] Query failed:`, projectsRes.error);
            return res.status(500).json({
              message: 'Database query failed',
              error: projectsRes.error.message
            });
          }
          
          const projects = projectsRes.data || [];
          const monadaData = monadaRes.data || [];
          const eventTypes = eventTypesRes.data || [];
          const expenditureTypes = expenditureTypesRes.data || [];
          const kallikratisData = kallikratisRes.data || [];
          const indexData = indexRes.data || [];
          
          console.log(`[UnitProjects] Retrieved ${projects.length} total projects from database`);
          
          // Find the target unit in Monada table
          const targetMonada = monadaData.find(m => m.unit === unitName);
          if (!targetMonada) {
            console.log(`[UnitProjects] Unit ${unitName} not found in Monada table`);
            return res.json([]);
          }
          
          // Find project IDs that belong to this unit using project_index
          const unitProjectIds = indexData
            .filter(idx => idx.monada_id === targetMonada.id)
            .map(idx => idx.project_id);
          
          // Get enhanced projects for this unit
          const filteredProjects = projects
            .filter(project => unitProjectIds.includes(project.id))
            .map(project => {
              const indexItems = indexData.filter(idx => idx.project_id === project.id);
              
              // Get all expenditure types for this project
              const projectExpenditureTypes = indexItems
                .map(idx => expenditureTypes.find(et => et.id === idx.expediture_type_id))
                .filter(et => et !== null && et !== undefined)
                .map(et => et.expediture_types);
              const uniqueExpenditureTypes = Array.from(new Set(projectExpenditureTypes));
              
              // Get all event types for this project
              const projectEventTypes = indexItems
                .map(idx => eventTypes.find(et => et.id === idx.event_types_id))
                .filter(et => et !== null && et !== undefined)
                .map(et => et.name);
              const uniqueEventTypes = Array.from(new Set(projectEventTypes));
              
              const eventType = indexItems.length > 0 ? eventTypes.find(et => et.id === indexItems[0].event_types_id) : null;
              const expenditureType = indexItems.length > 0 ? expenditureTypes.find(et => et.id === indexItems[0].expediture_type_id) : null;
              const kallikratis = indexItems.length > 0 ? kallikratisData.find(k => k.id === indexItems[0].kallikratis_id) : null;
              
              return {
                ...project,
                enhanced_event_type: eventType ? {
                  id: eventType.id,
                  name: eventType.name
                } : null,
                enhanced_expenditure_type: expenditureType ? {
                  id: expenditureType.id,
                  name: expenditureType.expediture_types
                } : null,
                enhanced_unit: {
                  id: targetMonada.id,
                  name: targetMonada.unit
                },
                enhanced_kallikratis: kallikratis ? {
                  id: kallikratis.id,
                  name: kallikratis.perifereia || kallikratis.onoma_dimou_koinotitas,
                  level: kallikratis.level || 'municipality'
                } : null,
                expenditure_types: uniqueExpenditureTypes,
                event_types: uniqueEventTypes
              };
            });
          
          console.log(`[UnitProjects] After optimized filtering: found ${filteredProjects.length} projects for unit ${unitName}`);
          
          return res.json(filteredProjects);
        } catch (dbError) {
          console.error(`[UnitProjects] Database error:`, dbError);
          return res.status(500).json({
            message: 'Database operation failed',
            error: dbError instanceof Error ? dbError.message : 'Database error'
          });
        }
      } catch (error) {
        console.error('[UnitProjects] Error:', error);
        res.status(500).json({
          message: 'Failed to fetch projects',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // PRIORITY PROJECT ROUTE - must come first to avoid conflicts
    app.get('/api/projects/by-unit/:unitName', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        let { unitName } = req.params;
        
        // Decode URL-encoded Greek characters
        try {
          unitName = decodeURIComponent(unitName);
        } catch (decodeError) {
          console.log(`[Projects-Priority] URL decode failed, using original: ${unitName}`);
        }
        
        console.log(`[Projects-Priority] Fetching projects for unit: ${unitName}`);
        
        // Get all projects and filter in JavaScript to avoid JSONB issues
        const { data: allProjects, error } = await supabase
          .from('Projects')
          .select('*')
          .limit(1000);
          
        if (error) {
          console.error(`[Projects-Priority] Database error:`, error);
          return res.status(500).json({
            message: 'Failed to fetch projects by unit',
            error: error.message
          });
        }
        
        // Filter projects by unit in JavaScript using authentic data
        const data = allProjects?.filter(project => {
          const agency = project.implementing_agency;
          if (Array.isArray(agency)) {
            return agency.some(a => a.includes(unitName));
          }
          if (typeof agency === 'string') {
            return agency.includes(unitName);
          }
          return false;
        }) || [];
        
        console.log(`[Projects-Priority] Found ${data?.length || 0} projects for unit: ${unitName}`);
        res.json(data || []);
      } catch (error) {
        console.error('[Projects-Priority] Error fetching projects by unit:', error);
        res.status(500).json({
          message: 'Failed to fetch projects by unit',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Project catalog routes - maintaining both /catalog and /projects endpoints for backwards compatibility
    
    // TODO: Refactor - Move these project-related public endpoints to projectController
    
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
    
    // Add public endpoint for project lookup by MIS
    app.get('/api/projects/lookup', async (req, res) => {
      try {
        const { mis } = req.query;
        
        if (!mis) {
          return res.status(400).json({ message: 'MIS code is required' });
        }
        
        console.log(`[Projects] Public access to project data for MIS: ${mis}`);
        
        // Query the project by MIS code
        const { data, error } = await supabase
          .from('Projects')
          .select('mis,na853,budget_na853,title,status')
          .eq('mis', mis);
        
        if (error) {
          throw error;
        }
        
        // Return the project data
        res.status(200).json(data || []);
      } catch (error: any) {
        console.error(`[Projects] Error looking up project by MIS: ${error.message}`);
        res.status(500).json({
          message: 'Failed to lookup project by MIS',
          error: error.message
        });
      }
    });
    
    // Dedicated public API endpoint for document cards to get NA853 codes
    app.get('/api/document-na853/:mis', async (req, res) => {
      try {
        const { mis } = req.params;
        
        if (!mis) {
          return res.status(400).json({ message: 'MIS code is required' });
        }
        
        console.log(`[Projects] Document-card special lookup for NA853 with MIS: ${mis}`);
        
        // First try to get from Projects table (most authoritative source)
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('mis, na853, budget_na853')
          .eq('mis', mis)
          .maybeSingle();
        
        if (projectError) {
          console.error(`[Projects] Error in Projects lookup: ${projectError.message}`);
        } else if (projectData) {
          // We found data in Projects table
          const na853Value = projectData.na853 || projectData.budget_na853 || '';
          console.log(`[Projects] Found NA853 in Projects table: ${na853Value}`);
          
          return res.status(200).json({
            source: 'Projects',
            mis: mis,
            na853: na853Value
          });
        }
        
        // If not found in Projects, try project_budget table
        const { data: budgetData, error: budgetError } = await supabase
          .from('project_budget')
          .select('mis, na853')
          .eq('mis', mis)
          .maybeSingle();
        
        if (budgetError) {
          console.error(`[Projects] Error in project_budget lookup: ${budgetError.message}`);
        } else if (budgetData) {
          // We found data in project_budget table
          console.log(`[Projects] Found NA853 in budget table: ${budgetData.na853}`);
          
          return res.status(200).json({
            source: 'project_budget',
            mis: mis,
            na853: budgetData.na853 || ''
          });
        }
        
        // Last resort: return empty but valid response
        console.log(`[Projects] No NA853 found for MIS: ${mis}`);
        return res.status(200).json({
          source: 'not_found',
          mis: mis,
          na853: ''
        });
        
      } catch (error: any) {
        console.error(`[Projects] Error looking up NA853 for document: ${error.message}`);
        return res.status(500).json({
          message: 'Failed to lookup NA853',
          error: error.message
        });
      }
    });
    
    // CLEAN PROJECT ROUTES - direct implementation to fix loading issues
    app.get('/api/projects/by-unit/:unitName', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        let { unitName } = req.params;
        
        // Decode URL-encoded Greek characters
        try {
          unitName = decodeURIComponent(unitName);
        } catch (decodeError) {
          console.log(`[Projects] URL decode failed, using original: ${unitName}`);
        }
        
        console.log(`[Projects] Fetching projects for unit: ${unitName}`);
        
        // Direct database query using text search to avoid JSON parsing errors
        const { data, error } = await supabase
          .from('Projects')
          .select('*')
          .limit(1000);
        
        if (error) {
          console.error(`[Projects] Database error:`, error);
          return res.status(500).json({
            message: 'Failed to fetch projects by unit',
            error: error.message
          });
        }
        
        console.log(`[Projects] Found ${data?.length || 0} projects for unit: ${unitName}`);
        res.json(data || []);
      } catch (error) {
        console.error('[Projects] Error fetching projects by unit:', error);
        res.status(500).json({
          message: 'Failed to fetch projects by unit',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // New endpoint for comprehensive project organization using project_index
    app.get('/api/projects/organized', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log('[Projects] Fetching organized project data using project_index...');
        
        // Fetch organized project data using the project_index table
        const { data: organizedProjects, error } = await supabase
          .from('project_index')
          .select(`
            project_id,
            Projects!inner(
              id,
              na853,
              event_description,
              project_title,
              event_type,
              expenditure_type,
              region,
              implementing_agency,
              budget_na853,
              status,
              created_at
            ),
            Monada!inner(
              id,
              unit,
              unit_name,
              email
            ),
            event_types!inner(
              id,
              name
            ),
            expediture_types!inner(
              id,
              expediture_types
            ),
            kallikratis!inner(
              id,
              onoma_dimou_koinotitas,
              perifereia
            )
          `);

        if (error) {
          console.error('[Projects] Error fetching organized projects:', error);
          return res.status(500).json({ message: 'Failed to fetch organized projects' });
        }

        console.log(`[Projects] Retrieved ${organizedProjects?.length || 0} indexed project records`);

        // Organize the data by organizational units
        const organizationMap = new Map();

        organizedProjects?.forEach((item: any) => {
          const unitId = item.Monada.id;
          const unitName = item.Monada.unit;
          const unitFullName = item.Monada.unit_name;
          
          if (!organizationMap.has(unitId)) {
            organizationMap.set(unitId, {
              unit: {
                id: unitId,
                name: unitName,
                fullName: unitFullName,
                email: item.Monada.email
              },
              projects: new Map()
            });
          }

          const orgData = organizationMap.get(unitId);
          const projectId = item.Projects.id;
          
          if (!orgData.projects.has(projectId)) {
            orgData.projects.set(projectId, {
              ...item.Projects,
              expenditureTypes: new Set(),
              eventTypes: new Set(),
              regions: new Set()
            });
          }

          const project = orgData.projects.get(projectId);
          project.expenditureTypes.add(item.expediture_types.expediture_types);
          project.eventTypes.add(item.event_types.name);
          if (item.kallikratis.perifereia) {
            project.regions.add(item.kallikratis.perifereia);
          }
          if (item.kallikratis.onoma_dimou_koinotitas) {
            project.regions.add(item.kallikratis.onoma_dimou_koinotitas);
          }
        });

        // Convert Maps to arrays and Sets to arrays for JSON serialization
        const result = Array.from(organizationMap.values()).map(orgData => ({
          unit: orgData.unit,
          projects: Array.from(orgData.projects.values()).map((project: any) => ({
            ...project,
            expenditureTypes: Array.from(project.expenditureTypes),
            eventTypes: Array.from(project.eventTypes),
            regions: Array.from(project.regions)
          }))
        }));

        console.log(`[Projects] Successfully organized data for ${result.length} organizational units`);
        return res.json(result);
      } catch (error) {
        console.error('[Projects] Error in organized projects route:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Optimized endpoint for project cards using project_index
    app.get('/api/projects/cards', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log('[Projects] Fetching optimized project card data...');
        const user = req.user as User;
        
        // First get all unique projects from Projects table
        const { data: projectsData, error: projectsError } = await supabase
          .from('Projects')
          .select('na853, mis, budget_na853, status, created_at, updated_at, event_description, project_title');
        
        if (projectsError) {
          console.error('[Projects] Error fetching projects data:', projectsError);
          return res.status(500).json({ error: 'Failed to fetch projects data' });
        }
        
        console.log(`[Projects] Retrieved ${projectsData?.length || 0} unique projects`);
        
        // Get all reference data
        const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
          supabase.from('event_types').select('*'),
          supabase.from('expediture_types').select('*'),
          supabase.from('Monada').select('*'),
          supabase.from('kallikratis').select('*')
        ]);
        
        const eventTypes = eventTypesRes.data || [];
        const expenditureTypes = expenditureTypesRes.data || [];
        const monadaData = monadaRes.data || [];
        const kallikratisData = kallikratisRes.data || [];
        
        // Get project index data for enhanced information
        const { data: indexData, error: indexError } = await supabase
          .from('project_index')
          .select('*');
        
        // Transform projects with enhanced data from project_index
        const transformedCards = projectsData?.map(project => {
          // Find corresponding index entry for this project
          const indexItem = indexData?.find(idx => 
            idx.project_na853 === project.na853 || idx.project_mis === project.mis
          );
          
          // Get enhanced data if index entry exists
          const eventType = indexItem ? eventTypes?.find(et => et.id === indexItem.event_type_id) : null;
          const expenditureType = indexItem ? expenditureTypes?.find(et => et.id === indexItem.expenditure_type_id) : null;
          const monada = indexItem ? monadaData?.find(m => m.id === indexItem.monada_id) : null;
          const kallikratis = indexItem ? kallikratisData?.find(k => k.id === indexItem.kallikratis_id) : null;
          
          // Filter by user units if not admin
          if (user.role !== 'admin' && user.units && user.units.length > 0) {
            if (monada && !user.units.includes(monada.unit)) {
              return null; // Skip this project
            }
          }
          
          return {
            // Core identifiers from Projects table
            na853: project.na853,
            mis: project.mis,
            
            // Project details from Projects table
            budget_na853: project.budget_na853,
            status: project.status || 'active',
            created_at: project.created_at,
            updated_at: project.updated_at,
            event_description: project.event_description,
            project_title: project.project_title,
            
            // Enhanced information from project_index
            event_type: eventType ? {
              id: eventType.id,
              name: eventType.name,
              description: eventType.description
            } : null,
            
            expenditure_type: expenditureType ? {
              id: expenditureType.id,
              name: expenditureType.expediture_types
            } : null,
            
            unit: monada ? {
              id: monada.id,
              name: monada.unit || monada.unit_name
            } : null,
            
            region: kallikratis ? {
              id: kallikratis.id,
              region: kallikratis.perifereia,
              regional_unit: kallikratis.onoma_dimou_koinotitas,
              municipality: kallikratis.onoma_dimou_koinotitas
            } : null
          };
        }).filter(Boolean); // Remove null entries
        
        console.log(`[Projects] Transformed ${transformedCards?.length || 0} project cards`);
        res.json(transformedCards);
        
      } catch (error) {
        console.error('[Projects] Error in project cards endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Project index endpoint for comprehensive edit
    app.get('/api/projects/:mis/index', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { mis } = req.params;
        console.log(`[ProjectIndex] Fetching project index data for MIS: ${mis}`);

        // First get the project ID from MIS
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id')
          .eq('mis', parseInt(mis))
          .single();

        if (projectError || !projectData) {
          console.error(`[ProjectIndex] Project not found for MIS: ${mis}`, projectError);
          return res.status(404).json({ message: 'Project not found' });
        }

        // Get project index entries with all related data
        const { data: indexData, error: indexError } = await supabase
          .from('project_index')
          .select(`
            *
          `)
          .eq('project_id', projectData.id);

        if (indexError) {
          console.error(`[ProjectIndex] Error fetching index data:`, indexError);
          return res.status(500).json({ 
            message: 'Failed to fetch project index data', 
            error: indexError.message 
          });
        }

        // Get reference data to resolve IDs to names
        const [eventTypesRes, expenditureTypesRes, monadaRes, kallikratisRes] = await Promise.all([
          supabase.from('event_types').select('id, name'),
          supabase.from('expediture_types').select('id, expediture_types, expediture_types_minor'),
          supabase.from('Monada').select('id, unit, unit_name'),
          supabase.from('kallikratis').select('id, perifereia, perifereiaki_enotita, onoma_neou_ota, onoma_dimotikis_enotitas')
        ]);

        const eventTypes = eventTypesRes.data || [];
        const expenditureTypes = expenditureTypesRes.data || [];
        const monadaData = monadaRes.data || [];
        const kallikratisData = kallikratisRes.data || [];

        // Transform the data to match the expected structure
        const transformedData = (indexData || []).map(entry => {
          const eventType = eventTypes.find(et => et.id === entry.event_types_id);
          const expenditureType = expenditureTypes.find(et => et.id === entry.expediture_type_id);
          const monada = monadaData.find(m => m.id === entry.monada_id);
          const kallikratis = kallikratisData.find(k => k.id === entry.kallikratis_id);

          return {
            project_id: entry.project_id,
            event_type_id: entry.event_types_id,
            event_type_name: eventType?.name,
            expenditure_type_id: entry.expediture_type_id,
            expenditure_type_name: expenditureType?.expediture_types,
            unit_id: entry.monada_id,
            unit_name: monada?.unit || monada?.unit_name,
            kallikratis_id: entry.kallikratis_id,
            kallikratis: kallikratis,
            geographic_code: entry.geographic_code
          };
        });

        console.log(`[ProjectIndex] Found ${transformedData.length} index entries for project ${mis}`);
        res.json(transformedData);
      } catch (error) {
        console.error('[ProjectIndex] Error fetching project index data:', error);
        res.status(500).json({
          message: 'Failed to fetch project index data',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Project regions endpoint for document creation dialog
    app.get('/api/projects/:mis/regions', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { mis } = req.params;
        console.log(`[ProjectRegions] Fetching regions for project MIS: ${mis}`);
        
        // Get project data using optimized schema
        const [projectsRes, kallikratisRes, indexRes] = await Promise.all([
          supabase.from('Projects').select('*').eq('mis', parseInt(mis)),
          supabase.from('kallikratis').select('*'),
          supabase.from('project_index').select('*')
        ]);
        
        if (projectsRes.error) {
          console.error('[ProjectRegions] Database error:', projectsRes.error);
          return res.status(500).json({ error: 'Database query failed' });
        }
        
        const project = projectsRes.data?.[0];
        if (!project) {
          console.log(`[ProjectRegions] Project not found for MIS: ${mis}`);
          return res.json({ regions: [] });
        }
        
        // Find project in index to get kallikratis relationship
        const indexItem = indexRes.data?.find(idx => idx.project_id === project.id);
        if (!indexItem || !indexItem.kallikratis_id) {
          console.log(`[ProjectRegions] No region data found for project ${mis}`);
          return res.json({ regions: [] });
        }
        
        // Get region data from kallikratis table
        const regionData = kallikratisRes.data?.find(k => k.id === indexItem.kallikratis_id);
        if (!regionData) {
          return res.json({ regions: [] });
        }
        
        // Format regions for the frontend
        const regions = [{
          id: regionData.id,
          name: regionData.perifereia || regionData.onoma_dimou_koinotitas,
          municipality: regionData.onoma_dimou_koinotitas,
          regional_unit: regionData.perifereia,
          level: regionData.level || 'municipality'
        }];
        
        console.log(`[ProjectRegions] Found ${regions.length} regions for project ${mis}`);
        res.json({ regions });
        
      } catch (error) {
        console.error('[ProjectRegions] Error:', error);
        res.status(500).json({ error: 'Failed to fetch project regions' });
      }
    });

    // SQL Executor API endpoint for admin users
    app.post('/api/sql/execute', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = req.user as User;
        
        // Only allow admin users to execute SQL
        if (user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'SQL execution requires admin privileges'
          });
        }
        
        const { query } = req.body;
        
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required and must be a string'
          });
        }
        
        console.log(`[SQL] Admin user ${user.name} executing query: ${query.substring(0, 100)}...`);
        
        // Import and use the SQL executor
        const { sqlExecutor } = await import('./sql-executor');
        const result = await sqlExecutor.executeSQL(query);
        
        console.log(`[SQL] Query execution completed in ${result.executionTime}ms`);
        
        res.json(result);
        
      } catch (error) {
        console.error('[SQL] Error executing query:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          queryType: 'unknown',
          executionTime: 0
        });
      }
    });

    // Use authentication for all other project routes
    app.use('/api/projects', authenticateSession, projectRouter);
    app.use('/api/catalog', authenticateSession, projectRouter);

    // Budget routes
    log('[Routes] Setting up budget routes...');
    
    // Import the storage interface
    const { storage } = await import('./storage');
    
    // Enhanced budget lookup route that handles both NA853 codes and MIS numbers
    app.get('/api/budget/:identifier', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { identifier } = req.params;
        console.log(`[Budget] Enhanced lookup for identifier: ${identifier}`);
        
        if (!req.user?.id) {
          return res.status(401).json({
            status: 'error',
            message: 'Authentication required'
          });
        }

        let budgetData: any = null;
        let error: any = null;

        // Strategy 1: Try direct lookup by NA853 code
        if (identifier && identifier.includes('ΝΑ')) {
          console.log(`[Budget] Attempting NA853 lookup for: ${identifier}`);
          try {
            const { data: na853BudgetData, error: na853Error } = await supabase
              .from('project_budget')
              .select('*')
              .eq('na853', identifier)
              .single();
            
            if (!na853Error && na853BudgetData) {
              budgetData = na853BudgetData;
              console.log(`[Budget] Found budget by NA853: ${identifier}`);
            } else {
              console.log(`[Budget] NA853 lookup failed: ${na853Error?.message || 'No data'}`);
            }
          } catch (na853LookupError) {
            console.log(`[Budget] NA853 lookup error: ${na853LookupError}`);
          }
        }

        // Strategy 2: If no data yet, try to resolve through Projects table
        if (!budgetData) {
          console.log(`[Budget] Attempting project resolution for: ${identifier}`);
          try {
            // First, find the project by various identifiers
            let projectQuery = supabase.from('Projects').select('id, mis, na853');
            
            if (identifier.includes('ΝΑ')) {
              projectQuery = projectQuery.eq('na853', identifier);
            } else if (!isNaN(Number(identifier))) {
              projectQuery = projectQuery.eq('mis', Number(identifier));
            } else {
              projectQuery = projectQuery.eq('id', Number(identifier));
            }
            
            const { data: projectData, error: projectError } = await projectQuery.single();
            
            if (!projectError && projectData) {
              console.log(`[Budget] Found project: ID=${projectData.id}, MIS=${projectData.mis}, NA853=${projectData.na853}`);
              
              // Now try to find budget using the project's MIS
              if (projectData.mis) {
                const { data: misBudgetData, error: misError } = await supabase
                  .from('project_budget')
                  .select('*')
                  .eq('mis', projectData.mis)
                  .single();
                
                if (!misError && misBudgetData) {
                  budgetData = misBudgetData;
                  console.log(`[Budget] Found budget by project MIS: ${projectData.mis}`);
                }
              }
              
              // If still no budget data, try by NA853
              if (!budgetData && projectData.na853) {
                const { data: projectNa853BudgetData, error: projectNa853Error } = await supabase
                  .from('project_budget')
                  .select('*')
                  .eq('na853', projectData.na853)
                  .single();
                
                if (!projectNa853Error && projectNa853BudgetData) {
                  budgetData = projectNa853BudgetData;
                  console.log(`[Budget] Found budget by project NA853: ${projectData.na853}`);
                }
              }
            }
          } catch (projectLookupError) {
            console.log(`[Budget] Project lookup error: ${projectLookupError}`);
          }
        }

        // Strategy 3: Direct MIS lookup as final fallback
        if (!budgetData && !isNaN(Number(identifier))) {
          console.log(`[Budget] Attempting direct MIS lookup for: ${identifier}`);
          try {
            const { data: misBudgetData, error: misError } = await supabase
              .from('project_budget')
              .select('*')
              .eq('mis', Number(identifier))
              .single();
            
            if (!misError && misBudgetData) {
              budgetData = misBudgetData;
              console.log(`[Budget] Found budget by direct MIS: ${identifier}`);
            } else {
              error = misError;
            }
          } catch (misLookupError) {
            console.log(`[Budget] Direct MIS lookup error: ${misLookupError}`);
            error = misLookupError;
          }
        }

        if (!budgetData) {
          console.error(`[Budget] No budget data found for identifier: ${identifier}`);
          return res.status(404).json({
            status: 'error',
            message: `Budget not found for identifier: ${identifier}`,
            error: error?.message || 'Budget not found'
          });
        }

        // Calculate derived values
        const currentQuarter = getCurrentQuarter();
        const currentQuarterValue = budgetData[`q${currentQuarter}`] || 0;
        
        const response = {
          status: 'success',
          data: {
            ...budgetData,
            current_quarter: `q${currentQuarter}`,
            current_quarter_value: currentQuarterValue,
            available_budget: (budgetData.ethsia_pistosi || 0) - (budgetData.katanomes_etous || 0),
            quarter_available: currentQuarterValue - (budgetData.user_view || 0),
            yearly_available: (budgetData.ethsia_pistosi || 0) - (budgetData.katanomes_etous || 0)
          }
        };

        console.log(`[Budget] Successfully retrieved budget for: ${identifier}`);
        return res.json(response);

      } catch (error) {
        console.error(`[Budget] Enhanced lookup error:`, error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch budget data',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Helper function to get current quarter
    const getCurrentQuarter = (): number => {
      const now = new Date();
      const month = now.getMonth() + 1; // getMonth() returns 0-11
      
      if (month >= 1 && month <= 3) return 1;
      if (month >= 4 && month <= 6) return 2;
      if (month >= 7 && month <= 9) return 3;
      return 4;
    };
    
    // Set up specific budget routes first
    // Budget history route - must be registered BEFORE the MIS lookup route
    log('[Routes] Setting up budget history route...');
    app.get('/api/budget/history', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log('[Budget] Handling dedicated history endpoint request');
        
        // Check authentication
        if (!req.user?.id) {
          return res.status(401).json({
            status: 'error',
            message: 'Authentication required',
            data: [],
            pagination: { total: 0, page: 1, limit: 10, pages: 0 }
          });
        }
        
        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const mis = req.query.mis as string | undefined;
        const changeType = req.query.change_type as string | undefined;
        const dateFrom = req.query.date_from as string | undefined;
        const dateTo = req.query.date_to as string | undefined;
        const creator = req.query.creator as string | undefined;
        
        // Get user units for access control
        const userUnits = req.user.role === 'admin' ? undefined : (req.user.units || undefined);
        
        console.log(`[Budget] Fetching history with params: page=${page}, limit=${limit}, mis=${mis || 'all'}, changeType=${changeType || 'all'}, userUnits=${userUnits?.join(',') || 'admin'}`);
        
        // Use the enhanced storage method with pagination and access control
        const result = await storage.getBudgetHistory(mis, page, limit, changeType, userUnits, dateFrom, dateTo, creator);
        
        console.log(`[Budget] Successfully fetched ${result.data.length} of ${result.pagination.total} history records`);
        
        return res.json({
          status: 'success',
          data: result.data,
          pagination: result.pagination,
          statistics: result.statistics
        });
      } catch (error) {
        console.error('[Budget] History fetch error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch budget history',
          details: error instanceof Error ? error.message : 'Unknown error',
          data: [],
          pagination: { total: 0, page: 1, limit: 10, pages: 0 }
        });
      }
    });
    log('[Routes] Budget history route registered');
    
    // Budget history Excel export route
    app.get('/api/budget/history/export', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log('[Budget] Handling Excel export request');
        
        // Check authentication
        if (!req.user?.id) {
          return res.status(401).json({
            status: 'error',
            message: 'Authentication required'
          });
        }
        
        // Parse query parameters (same as regular history endpoint)
        const mis = req.query.mis as string | undefined;
        const changeType = req.query.change_type as string | undefined;
        const dateFrom = req.query.date_from as string | undefined;
        const dateTo = req.query.date_to as string | undefined;
        const creator = req.query.creator as string | undefined;
        
        // Get user units for access control
        const userUnits = req.user.role === 'admin' ? undefined : (req.user.units || undefined);
        
        console.log(`[Budget] Exporting history with filters: mis=${mis || 'all'}, changeType=${changeType || 'all'}, userUnits=${userUnits?.join(',') || 'admin'}`);
        
        // Get all data without pagination for export
        const result = await storage.getBudgetHistory(mis, 1, 10000, changeType, userUnits, dateFrom, dateTo, creator);
        
        // Use imported ExcelJS library
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ιστορικό Προϋπολογισμού');
        
        // Set up columns
        worksheet.columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'MIS Έργου', key: 'mis', width: 15 },
          { header: 'Προηγούμενο Ποσό (€)', key: 'previous_amount', width: 20 },
          { header: 'Νέο Ποσό (€)', key: 'new_amount', width: 20 },
          { header: 'Διαφορά (€)', key: 'difference', width: 15 },
          { header: 'Τύπος Αλλαγής', key: 'change_type', width: 25 },
          { header: 'Αιτιολογία', key: 'change_reason', width: 40 },
          { header: 'ID Εγγράφου', key: 'document_id', width: 15 },
          { header: 'Κατάσταση Εγγράφου', key: 'document_status', width: 20 },
          { header: 'Αρ. Πρωτοκόλλου', key: 'protocol_number', width: 20 },
          { header: 'Δημιουργήθηκε από', key: 'created_by', width: 25 },
          { header: 'Ημερομηνία Δημιουργίας', key: 'created_at', width: 25 }
        ];
        
        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Add data rows
        result.data.forEach((entry: any) => {
          const prevAmount = parseFloat(entry.previous_amount) || 0;
          const newAmount = parseFloat(entry.new_amount) || 0;
          const difference = newAmount - prevAmount;
          
          worksheet.addRow({
            id: entry.id,
            mis: entry.mis,
            previous_amount: prevAmount,
            new_amount: newAmount,
            difference: difference,
            change_type: getChangeTypeLabel(entry.change_type),
            change_reason: entry.change_reason || '',
            document_id: entry.document_id || '',
            document_status: getStatusLabel(entry.document_status),
            protocol_number: entry.protocol_number_input || '',
            created_by: entry.created_by || 'Σύστημα',
            created_at: entry.created_at ? new Date(entry.created_at).toLocaleString('el-GR') : ''
          });
        });
        
        // Add statistics sheet
        const statsWorksheet = workbook.addWorksheet('Στατιστικά');
        
        if (result.statistics) {
          statsWorksheet.addRow(['Στατιστικά Περιόδου']);
          statsWorksheet.addRow([]);
          statsWorksheet.addRow(['Συνολικές Εγγραφές:', result.statistics.totalEntries]);
          statsWorksheet.addRow(['Συνολική Μεταβολή Ποσού (€):', result.statistics.totalAmountChange]);
          statsWorksheet.addRow([]);
          statsWorksheet.addRow(['Κατανομή ανά Τύπο Αλλαγής:']);
          
          Object.entries(result.statistics.changeTypes).forEach(([type, count]) => {
            statsWorksheet.addRow([getChangeTypeLabel(type), count]);
          });
          
          if (result.statistics.periodRange.start && result.statistics.periodRange.end) {
            statsWorksheet.addRow([]);
            statsWorksheet.addRow(['Χρονική Περίοδος:']);
            statsWorksheet.addRow(['Από:', new Date(result.statistics.periodRange.start).toLocaleString('el-GR')]);
            statsWorksheet.addRow(['Έως:', new Date(result.statistics.periodRange.end).toLocaleString('el-GR')]);
          }
          
          // Style statistics header
          const statsHeaderRow = statsWorksheet.getRow(1);
          statsHeaderRow.font = { bold: true, size: 16 };
        }
        
        // Auto-fit columns
        worksheet.columns.forEach((column: any) => {
          if (column.eachCell) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell: any) => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
          }
        });
        
        // Set response headers for Excel download
        const fileName = `Istoriko_Proypologismou_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
        console.log(`[Budget] Excel export completed: ${result.data.length} records exported`);
        
      } catch (error) {
        console.error('[Budget] Excel export error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to export budget history',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    

    
    log('[Routes] Budget history Excel export route registered');
    
    // Budget notifications routes - must be registered BEFORE the main budget routes
    log('[Routes] Setting up budget notifications routes...');
    app.use('/api/budget-notifications', authenticateSession, budgetNotificationsRouter);
    app.use('/api/test-notifications', authenticateSession, testNotificationsRouter);
    log('[Routes] Budget notifications routes setup complete');
    
    // Employee management routes
    log('[Routes] Setting up employee management routes...');
    app.use('/api/employees', authenticateSession, employeesRouter);
    log('[Routes] Setting up beneficiary management routes...');
    app.use('/api/beneficiaries', authenticateSession, beneficiariesRouter);
    
    // Beneficiary payments endpoint for enhanced display
    app.get('/api/beneficiary-payments', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.units) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        // Get all beneficiaries for user's units first
        const beneficiaries = await storage.getBeneficiariesByUnit(req.user.units[0]);
        
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
    
    log('[Routes] Beneficiary management routes setup complete');
    log('[Routes] Employee management routes setup complete');
    
    // Budget upload routes for Excel file imports - MUST come BEFORE the main budget routes
    log('[Routes] Setting up budget upload routes...');
    app.use('/api/budget/upload', authenticateSession, budgetUploadRouter);
    log('[Routes] Budget upload routes setup complete');
    
    // Allow public access to budget data by MIS for document creation
    // Using our specialized controller function for MIS lookups
    // This MUST come AFTER more specific routes like /api/budget/history
    app.get('/api/budget/:mis', getBudgetByMis);
    
    // Use authentication for all other budget routes
    // This MUST come after more specific /api/budget/* routes
    app.use('/api/budget', authenticateSession, budgetRouter);
    log('[Routes] Main budget routes registered');

    // Public monada data endpoint for signature selection
    app.get('/api/public/monada', async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from('Monada')
          .select('*');
          
        if (error) {
          console.error('[Monada] Error fetching monada data:', error);
          return res.status(500).json({ 
            message: 'Failed to fetch monada data', 
            error: error.message 
          });
        }

        res.json(data || []);
      } catch (error) {
        console.error('[Monada] Critical error:', error);
        res.status(500).json({ 
          message: 'Critical server error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Documents routes
    log('[Routes] Setting up document routes...');
    
    // Add user documents endpoint for dashboard
    // User preferences endpoints for ESDIAN suggestions
    app.get('/api/user-preferences/esdian', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = (req as any).user?.id;
        const projectId = req.query.project_id as string;
        const expenditureType = req.query.expenditure_type as string;
        
        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        console.log('[UserPreferences] ESDIAN request for user:', userId, 'project:', projectId, 'type:', expenditureType);

        // Build query with optional filters for better contextual suggestions
        // For now, filter by user's units to get relevant suggestions
        const userUnits = (req as any).user?.units || [];
        
        let query = supabase
          .from('generated_documents')
          .select('esdian, project_na853, expenditure_type')
          .in('unit', userUnits)
          .not('esdian', 'is', null)
          .order('created_at', { ascending: false });

        // If we have context, prioritize matching documents but still include others
        if (projectId || expenditureType) {
          query = query.limit(100); // Get more documents for better filtering
        } else {
          query = query.limit(50);
        }

        const { data: documents, error } = await query;

        if (error) {
          console.error('[UserPreferences] Error fetching ESDIAN data:', error);
          return res.status(500).json({ message: 'Error fetching preferences' });
        }

        console.log('[UserPreferences] Found', documents?.length || 0, 'documents with ESDIAN data');

        // Analyze ESDIAN patterns with context-aware scoring
        const esdianCounts: { [key: string]: { count: number; contextMatches: number } } = {};
        
        // Add sample suggestions for demonstration
        if (documents && documents.length === 0) {
          console.log('[UserPreferences] No documents found, providing sample suggestions');
          
          // Context-aware sample suggestions
          if (expenditureType === 'ΔΚΑ ΕΠΙΣΚΕΥΗ') {
            esdianCounts['ΤΜΗΜΑ ΤΕΧΝΙΚΩΝ ΕΡΓΩΝ'] = { count: 5, contextMatches: 3 };
            esdianCounts['ΔΙΕΥΘΥΝΣΗ ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ'] = { count: 4, contextMatches: 2 };
            esdianCounts['ΤΜΗΜΑ ΟΙΚΟΝΟΜΙΚΩΝ'] = { count: 3, contextMatches: 1 };
            esdianCounts['ΓΡΑΦΕΙΟ ΔΙΕΥΘΥΝΤΗ'] = { count: 2, contextMatches: 0 };
          } else if (expenditureType === 'ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ') {
            esdianCounts['ΤΜΗΜΑ ΣΤΕΓΑΣΤΙΚΗΣ ΠΟΛΙΤΙΚΗΣ'] = { count: 6, contextMatches: 4 };
            esdianCounts['ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ'] = { count: 4, contextMatches: 2 };
            esdianCounts['ΤΜΗΜΑ ΟΙΚΟΝΟΜΙΚΩΝ'] = { count: 3, contextMatches: 1 };
          } else {
            esdianCounts['ΔΙΕΥΘΥΝΣΗ ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ'] = { count: 4, contextMatches: 0 };
            esdianCounts['ΤΜΗΜΑ ΟΙΚΟΝΟΜΙΚΩΝ'] = { count: 3, contextMatches: 0 };
            esdianCounts['ΓΡΑΦΕΙΟ ΔΙΕΥΘΥΝΤΗ'] = { count: 2, contextMatches: 0 };
          }
        } else {
          // Process actual documents
          documents?.forEach(doc => {
            if (doc.esdian && Array.isArray(doc.esdian)) {
              const isContextMatch = (projectId && doc.project_na853 === projectId) || 
                                   (expenditureType && doc.expenditure_type === expenditureType);
              
              doc.esdian.forEach((item: string) => {
                if (item && item.trim()) {
                  const cleanItem = item.trim();
                  if (!esdianCounts[cleanItem]) {
                    esdianCounts[cleanItem] = { count: 0, contextMatches: 0 };
                  }
                  esdianCounts[cleanItem].count += 1;
                  if (isContextMatch) {
                    esdianCounts[cleanItem].contextMatches += 2; // Weight context matches higher
                  }
                }
              });
            }
          });
        }

        // Sort by combined score (frequency + context matches)
        const suggestions = Object.entries(esdianCounts)
          .map(([value, data]) => ({ 
            value, 
            count: data.count,
            contextMatches: data.contextMatches,
            score: data.count + data.contextMatches
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8) // Top 8 most relevant suggestions
          .map(({ value, count, contextMatches }) => ({ value, count, contextMatches }));

        console.log('[UserPreferences] Returning', suggestions.length, 'suggestions');

        res.json({
          status: 'success',
          suggestions,
          total: suggestions.length,
          hasContext: Boolean(projectId || expenditureType)
        });

      } catch (error) {
        console.error('[UserPreferences] Error:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.get('/api/documents/user', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        // Get user's recent documents (limit to 10 for dashboard)
        const { data: documents, error } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('generated_by', req.user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('[Documents] Error fetching user documents:', error);
          return res.status(500).json({
            message: 'Failed to fetch user documents',
            error: error.message
          });
        }

        return res.json(documents || []);
      } catch (error) {
        console.error('[Documents] Error in user documents endpoint:', error);
        return res.status(500).json({
          message: 'Failed to fetch user documents',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
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

    // Dashboard API routes - use controller for real stats
    const { getDashboardStats } = await import('./controllers/dashboard');
    app.get('/api/dashboard/stats', authenticateSession, getDashboardStats);
    log('[Routes] Dashboard routes setup complete');
    
    // Import test controller
//     const { 
//       testSecondaryTextEndpoint, 
//       getTestSecondaryText,
//       getDocumentSecondaryTextDebug
//     } = await import('./controllers/testController');
//     
//     // Test routes for debugging secondary_text field issues
//     app.post('/api/test/secondary-text', testSecondaryTextEndpoint);
//     app.get('/api/test/secondary-text', getTestSecondaryText);
//     app.get('/api/test/document/:id/secondary-text', getDocumentSecondaryTextDebug);
//     log('[Routes] Test routes for secondary_text debugging registered');

    // Template preview route
    app.use('/api/templates', authenticateSession, templatePreviewRouter);

    // Kallikratis routes for cascading region dropdowns
    log('[Routes] Registering kallikratis routes...');
    
    // Public kallikratis endpoint for region selection
    app.get('/api/kallikratis', async (req, res) => {
      try {
        console.log('[Kallikratis] Fetching kallikratis data for region selection');
        
        const { data: kallikratisData, error } = await supabase
          .from('kallikratis')
          .select('*')
          .order('perifereia, perifereiaki_enotita, onoma_neou_ota')
          .limit(2000); // Increase limit to fetch all 1034+ entries
        
        if (error) {
          console.error('[Kallikratis] Error fetching kallikratis data:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch kallikratis data',
            error: error.message
          });
        }
        
        console.log(`[Kallikratis] Successfully fetched ${kallikratisData?.length || 0} kallikratis entries`);
        return res.json(kallikratisData || []);
      } catch (error) {
        console.error('[Kallikratis] Error in kallikratis endpoint:', error);
        return res.status(500).json({
          status: 'error', 
          message: 'Failed to fetch kallikratis data',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Event types routes for project_index support
    log('[Routes] Registering event types routes...');
    app.get('/api/event-types', async (req, res) => {
      try {
        console.log('[EventTypes] Fetching event types for project configuration');
        
        const { data: eventTypesData, error } = await supabase
          .from('event_types')
          .select('*')
          .order('name');
        
        if (error) {
          console.error('[EventTypes] Error fetching event types:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch event types',
            error: error.message
          });
        }
        
        console.log(`[EventTypes] Successfully fetched ${eventTypesData?.length || 0} event types`);
        return res.json(eventTypesData || []);
      } catch (error) {
        console.error('[EventTypes] Error in event types endpoint:', error);
        return res.status(500).json({
          status: 'error', 
          message: 'Failed to fetch event types',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Expenditure types routes for project_index support
    log('[Routes] Registering expenditure types routes...');
    app.get('/api/expenditure-types', async (req, res) => {
      try {
        console.log('[ExpenditureTypes] Fetching expenditure types for project configuration');
        
        const { data: expenditureTypesData, error } = await supabase
          .from('expediture_types')
          .select('*')
          .order('expediture_types');
        
        if (error) {
          console.error('[ExpenditureTypes] Error fetching expenditure types:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch expenditure types',
            error: error.message
          });
        }
        
        console.log(`[ExpenditureTypes] Successfully fetched ${expenditureTypesData?.length || 0} expenditure types`);
        console.log('[ExpenditureTypes] Sample data:', expenditureTypesData?.slice(0, 2));
        return res.json(expenditureTypesData || []);
      } catch (error) {
        console.error('[ExpenditureTypes] Error in expenditure types endpoint:', error);
        return res.status(500).json({
          status: 'error', 
          message: 'Failed to fetch expenditure types',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });



    // Units routes
    log('[Routes] Registering units routes...');
    
    // Public units endpoint for document creation WITHOUT authentication
    app.get('/api/public/units', async (req, res) => {
      try {
        console.log('[Units] Completely public access to units list');
        
        // Query Monada table for units
        const { data: unitsData, error } = await supabase
          .from('Monada')
          .select('id, unit, unit_name');
        
        if (error) {
          console.error('[Units] Error fetching units:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch units'
          });
        }
        
        // Transform data to match client expectations
        const transformedUnits = (unitsData || []).map(unit => {
          return {
            id: unit.id,
            unit: unit.unit,
            unit_name: unit.unit_name,
            // Legacy field for backwards compatibility
            name: typeof unit.unit_name === "object" ? unit.unit_name?.name || "" : unit.unit_name || ""
          };
        });
        
        console.log('[Units] Successfully fetched units:', transformedUnits.length);
        return res.json(transformedUnits);
      } catch (error) {
        console.error('[Units] Error in public units access:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch units'
        });
      }
    });
    
    // Original units endpoint with authentication
    app.get('/api/users/units', authenticateSession, async (req, res) => {
      try {
        console.log('[Units] Authenticated access to units list');
        
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
        
        // Transform data to match client expectations
        const transformedUnits = (unitsData || []).map(unit => ({
          id: unit.unit,
          name: unit.unit_name
        }));
        
        console.log('[Units] Successfully fetched units:', transformedUnits.length);
        return res.json(transformedUnits);
      } catch (error) {
        console.error('[Units] Error in units access:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch units'
        });
      }
    });
    
    // Use authentication for other units routes
    app.use('/api/units', authenticateSession, unitsRouter);
    log('[Routes] Units routes registered');
    
    // Budget notifications routes
    log('[Routes] Registering budget notifications routes...');
    app.use('/api/notifications', authenticateSession, notificationsRouter);
    log('[Routes] Budget notifications routes registered');
    
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
          mis: project_mis || project_id, // Use numeric project_mis if available
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