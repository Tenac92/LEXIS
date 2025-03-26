import { Router, Request, Response, NextFunction } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import { DocumentManager } from '../utils/DocumentManager';

// Additional CORS middleware specifically for document routes
// This ensures proper cross-domain functionality with sdegdaefk.gr
function documentsCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  const sdegdaefkDomain = 'sdegdaefk.gr';
  
  // Check if the request is from sdegdaefk.gr or any subdomain
  const isFromSdegdaefkDomain = 
    origin && (
      origin.includes(sdegdaefkDomain) || 
      // Also handle IP-based access during testing
      req.hostname === sdegdaefkDomain || 
      req.get('host')?.includes(sdegdaefkDomain)
    );
  
  if (isFromSdegdaefkDomain) {
    console.log(`[DocumentsRoute] Detected request from sdegdaefk.gr domain: ${origin}`);
    
    // Set CORS headers specifically for sdegdaefk.gr
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Log CORS headers for debugging
    console.log('[DocumentsRoute] Set CORS headers for sdegdaefk.gr request');
  }
  
  next();
}

// Create the router
export const router = Router();
const documentManager = new DocumentManager();

// Apply our specific CORS middleware to all document routes
router.use(documentsCorsMiddleware);

// Handle OPTIONS requests with special handling for sdegdaefk.gr domain
router.options('*', (req: Request, res: Response) => {
  const origin = req.get('origin');
  const sdegdaefkDomain = 'sdegdaefk.gr';
  
  // Check if the request is from sdegdaefk.gr or any subdomain
  const isFromSdegdaefkDomain = 
    origin && (
      origin.includes(sdegdaefkDomain) || 
      req.hostname === sdegdaefkDomain || 
      req.get('host')?.includes(sdegdaefkDomain)
    );
  
  if (isFromSdegdaefkDomain) {
    console.log(`[DocumentsRoute] Handling OPTIONS request from sdegdaefk.gr domain: ${origin}`);
    
    // Set comprehensive CORS headers for OPTIONS requests from sdegdaefk.gr
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Referrer, X-API-Key, Cache-Control, Pragma, Set-Cookie, Cookie, withcredentials');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-Requested-With, Set-Cookie, ETag, Date');
    
    // End preflight request successfully
    return res.status(204).end();
  }
  
  // For other domains, just end successfully but without special headers
  res.status(204).end();
});

// Special middleware to handle direct browser requests to /documents
router.use('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if this is a direct browser request rather than an API call
    const acceptHeader = req.get('accept') || '';
    const isBrowserRequest = acceptHeader.includes('text/html') || 
      req.get('sec-fetch-dest') === 'document';
      
    const origin = req.get('origin');
    const host = req.get('host') || '';
    const sdegdaefkDomain = 'sdegdaefk.gr';
    
    // Check if request is from sdegdaefk.gr domain
    const isFromSdegdaefkDomain = 
      (origin && origin.includes(sdegdaefkDomain)) || 
      host.includes(sdegdaefkDomain) ||
      req.hostname === sdegdaefkDomain;
    
    // Log detailed information about this request
    console.log(`[DocumentsRoute] Request received: method=${req.method}, path=${req.path}`);
    console.log(`[DocumentsRoute] Browser request: ${isBrowserRequest}, sdegdaefk.gr domain: ${isFromSdegdaefkDomain}`);
    console.log(`[DocumentsRoute] Headers: accept=${acceptHeader}, host=${host}, origin=${origin || 'none'}`);
    
    // If it's a browser request and especially from sdegdaefk.gr, handle it specifically
    if (isBrowserRequest || isFromSdegdaefkDomain) {
      console.log('[DocumentsRoute] Browser or sdegdaefk.gr request detected, redirecting to HTML handler');
      
      // Create HTML with a redirect
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="0;url=/">
            <title>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</title>
            <script>window.location.href = "/";</script>
          </head>
          <body>
            <h1>Ανακατεύθυνση...</h1>
            <p>Παρακαλώ περιμένετε καθώς ανακατευθύνεστε στην αρχική σελίδα της εφαρμογής.</p>
            <p>Εάν δεν ανακατευθυνθείτε αυτόματα, <a href="/">πατήστε εδώ</a>.</p>
          </body>
        </html>
      `;
      
      return res
        .status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        })
        .send(html);
    }
    
    // Continue with API processing for non-browser requests
    next();
  } catch (error) {
    console.error('[DocumentsRoute] Error in request processing middleware:', error);
    // Ensure we don't throw an unhandled exception
    next();
  }
});

// List documents with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log(`[DocumentsRoute] Processing GET request from ${req.ip} with origin ${req.get('origin')}`);
    console.log(`[DocumentsRoute] Filters:`, req.query);
    
    // Add a timeout to prevent hanging requests
    const TIMEOUT = 8000; // 8 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), TIMEOUT);
    });
    
    // Extract and validate filters with better error handling
    const filters = {
      unit: req.query.unit as string,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      amountFrom: req.query.amountFrom ? parseFloat(req.query.amountFrom as string) : undefined,
      amountTo: req.query.amountTo ? parseFloat(req.query.amountTo as string) : undefined,
      recipient: req.query.recipient as string,
      afm: req.query.afm as string
    };

    // Validate numeric values to prevent errors
    if (req.query.amountFrom && isNaN(filters.amountFrom as number)) {
      console.warn(`[DocumentsRoute] Invalid amountFrom value: ${req.query.amountFrom}`);
      filters.amountFrom = undefined;
    }
    
    if (req.query.amountTo && isNaN(filters.amountTo as number)) {
      console.warn(`[DocumentsRoute] Invalid amountTo value: ${req.query.amountTo}`);
      filters.amountTo = undefined;
    }

    // Race the document loading against the timeout
    const documents = await Promise.race([
      documentManager.loadDocuments(filters),
      timeoutPromise
    ]) as any[];
    
    // Log the successful retrieval
    console.log(`[DocumentsRoute] Successfully retrieved ${documents.length} documents`);
    
    // Send the response with proper headers
    res
      .status(200)
      .set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      })
      .json(documents || []);
  } catch (error: any) {
    console.error('[DocumentsRoute] Error fetching documents:', error);
    
    // Distinguish between different types of errors for better debugging
    if (error.message === 'Request timeout') {
      console.error('[DocumentsRoute] Request timed out');
      return res.status(504).json({ 
        message: 'Request timed out while fetching documents',
        error: 'timeout'
      });
    }
    
    // Handle database connection errors gracefully
    if (error.code === '57P01') {
      console.error('[DocumentsRoute] Database connection terminated by administrator');
      return res.status(503).json({ 
        message: 'Database connection issue, please try again later',
        error: 'db_connection'
      });
    }
    
    // Return a graceful error response with minimal details for security
    res.status(500).json({ 
      message: 'Error fetching documents', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get single document by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Fetching single document by ID
    
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Document not found' });
    
    // Document retrieved successfully
    res.json(data);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update document
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    // Updating existing document
    
    const { protocol_number, protocol_date, status } = req.body;
    
    const { data, error } = await supabase
      .from('generated_documents')
      .update({ 
        protocol_number, 
        protocol_date, 
        status,
        updated_at: new Date().toISOString() 
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Document updates applied successfully
    res.json(data);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Error updating document', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create new document
router.post('/', async (req: Request, res: Response) => {
  try {
    // Creating new document with user-submitted data

    const { unit, project_id, expenditure_type, recipients, total_amount, attachments } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

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
      return res.status(404).json({ message: 'Project not found' });
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

    // Insert into database
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([documentPayload])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return res.status(500).json({ 
        message: 'Error creating document', 
        error: error.message,
        details: error.details
      });
    }

    // Document created successfully with ID
    res.status(201).json({ id: data.id });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ 
      message: 'Error creating document', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Add a direct html response route for direct browser access to /documents
// This is to handle direct browser navigation to https://sdegdaefk.gr/documents
router.get('/html', (req: Request, res: Response) => {
  const origin = req.get('origin');
  const sdegdaefkDomain = 'sdegdaefk.gr';
  const isFromSdegdaefkDomain = 
    origin && (
      origin.includes(sdegdaefkDomain) || 
      req.hostname === sdegdaefkDomain || 
      req.get('host')?.includes(sdegdaefkDomain)
    );
    
  // If it's a request directly to /documents from sdegdaefk.gr, serve a redirect
  if (isFromSdegdaefkDomain || req.get('sec-fetch-dest') === 'document') {
    console.log('[DocumentsRoute] Browser request detected, redirecting to client application');
    
    // Create HTML with a redirect
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=/">
          <title>ΣΔΕΓΔΑΕΦΚ - Ανακατεύθυνση</title>
          <script>window.location.href = "/";</script>
        </head>
        <body>
          <h1>Ανακατεύθυνση...</h1>
          <p>Παρακαλώ περιμένετε καθώς ανακατευθύνεστε στην αρχική σελίδα της εφαρμογής.</p>
          <p>Εάν δεν ανακατευθυνθείτε αυτόματα, <a href="/">πατήστε εδώ</a>.</p>
        </body>
      </html>
    `;
    
    return res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      })
      .send(html);
  }
  
  // Otherwise proceed with JSON response
  return res.status(200).json({
    message: 'Documents API endpoint - Please use the client application to access this resource'
  });
});

export default router;