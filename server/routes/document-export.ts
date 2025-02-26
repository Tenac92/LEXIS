import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';
import { authenticateSession } from '../middleware/auth';

export const documentExportRouter = Router();

// Protect all export routes with authentication
documentExportRouter.use(authenticateSession);

interface ExportConfig {
  format?: string;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  unit_details?: {
    unit_name: string;
    email: string;
    parts: any[];
  };
  contact_info?: {
    address: string;
    postal_code: string;
    city: string;
    contact_person: string;
  };
  include_attachments?: boolean;
  include_signatures?: boolean;
}

export async function exportDocument(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`[${startTime}] Starting document export process`);

  try {
    const { id } = req.params;
    const exportConfig: ExportConfig = req.body;

    console.log(`Document export request for ID: ${id}`, {
      config: exportConfig,
      method: req.method,
      contentType: req.headers['content-type']
    });

    // Verify user session
    if (!req.session?.user) {
      console.log('Export attempt without authentication');
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Fetch document data
    console.log('Fetching document data');
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (docError) {
      console.error('Database query error:', docError);
      return res.status(500).json({ 
        message: 'Error fetching document data',
        error: docError.message 
      });
    }

    if (!document) {
      console.log('Document not found:', id);
      return res.status(404).json({ message: 'Document not found' });
    }

    // Get appropriate template
    console.log('Fetching template for document');
    const template = await TemplateManager.getTemplateForExpenditure(document.expenditure_type);
    if (!template) {
      console.error('No template found for:', document.expenditure_type);
      return res.status(400).json({ message: 'No template found for this expenditure type' });
    }

    // Prepare format configuration
    console.log('Preparing document format configuration');
    const formatConfig = {
      format: exportConfig.format || 'docx',
      margins: exportConfig.margins || DocumentFormatter.getDefaultMargins(),
      unit_details: exportConfig.unit_details,
      contact_info: exportConfig.contact_info,
      include_attachments: exportConfig.include_attachments !== false,
      include_signatures: exportConfig.include_signatures !== false
    };

    // Generate document
    console.log('Generating document buffer');
    const buffer = await DocumentFormatter.generateDocument(document, template, formatConfig);

    if (!buffer || buffer.length === 0) {
      console.error('Generated document buffer is empty');
      return res.status(500).json({ message: 'Failed to generate document content' });
    }

    // Set response headers
    console.log('Setting response headers for document download');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=document-${DocumentFormatter.formatDocumentNumber(parseInt(id))}.docx`
    );
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the document
    console.log('Sending document response');
    res.send(buffer);

    const endTime = Date.now();
    console.log(`[${endTime}] Document export completed successfully. Duration: ${endTime - startTime}ms`);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Register routes for document export
documentExportRouter.post('/:id/export', exportDocument);
documentExportRouter.get('/:id/export', exportDocument);

function convertInchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}