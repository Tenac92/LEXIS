import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';
import { authenticateSession } from '../middleware/auth';

export const documentExportRouter = Router();

// Protect all export routes with authentication
documentExportRouter.use(authenticateSession);

export async function exportDocument(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`[${startTime}] Starting document export process`);

  try {
    const { id } = req.params;

    console.log(`Document export request for ID: ${id}`, {
      method: req.method,
      contentType: req.headers['content-type'],
      accept: req.headers['accept']
    });

    // Fetch document data
    console.log('Fetching document data from database');
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (docError) {
      console.error('Database query error:', docError);
      return res.status(500).json({ message: 'Error fetching document data' });
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

    // Generate document buffer
    console.log('Generating document buffer');
    const buffer = await DocumentFormatter.generateDocument(document, template, {
      margins: {
        top: convertInchesToTwip(1),
        right: convertInchesToTwip(1),
        bottom: convertInchesToTwip(1),
        left: convertInchesToTwip(1)
      }
    });

    if (!buffer || buffer.length === 0) {
      console.error('Generated document buffer is empty');
      return res.status(500).json({ message: 'Failed to generate document content' });
    }

    console.log(`Generated document buffer size: ${buffer.length} bytes`);

    // Set response headers for binary download
    const filename = `document-${DocumentFormatter.formatDocumentNumber(parseInt(id))}.docx`;
    console.log('Setting headers for download:', filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Send the document buffer using res.write and res.end for better streaming
    console.log(`Writing ${buffer.length} bytes to response`);
    res.write(buffer);
    res.end();

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

// Register only GET route for document export
documentExportRouter.get('/:id/export', exportDocument);

function convertInchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}