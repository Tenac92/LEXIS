import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';

export const documentExportRouter = Router();

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    console.log('[DocumentExport] Starting document export for ID:', id);

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      console.error('[DocumentExport] Invalid document ID:', id);
      return res.status(400).json({ 
        error: 'Failed to export document',
        details: 'Invalid document ID'
      });
    }

    // Fetch document with recipients
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (docError) {
      console.error('[DocumentExport] Database query error:', docError);
      return res.status(500).json({ 
        error: 'Failed to export document',
        details: docError.message
      });
    }

    if (!document) {
      console.error('[DocumentExport] Document not found:', id);
      return res.status(404).json({ 
        error: 'Failed to export document',
        details: 'Document not found'
      });
    }

    // Validate document data
    if (!document.unit || !document.recipients || !Array.isArray(document.recipients)) {
      console.error('[DocumentExport] Invalid document data:', {
        id: document.id,
        hasUnit: Boolean(document.unit),
        hasRecipients: Boolean(document.recipients),
        recipientsIsArray: Array.isArray(document.recipients)
      });
      return res.status(400).json({ 
        error: 'Failed to export document',
        details: 'Invalid document data structure'
      });
    }

    // Generate document buffer
    console.log('[DocumentExport] Generating document...');
    const buffer = await DocumentFormatter.generateDocument(document);

    if (!buffer || buffer.length === 0) {
      console.error('[DocumentExport] Generated empty buffer for document:', id);
      return res.status(500).json({ 
        error: 'Failed to export document',
        details: 'Failed to generate document content'
      });
    }

    // Set proper headers for Word document
    const documentId = document.id ? document.id.toString().padStart(6, '0') : id.toString().padStart(6, '0');
    const filename = `document-${documentId}.docx`;
    console.log('[DocumentExport] Sending document:', filename, 'Size:', buffer.length);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send buffer
    res.end(buffer);
    console.log('[DocumentExport] Document sent successfully');

  } catch (error) {
    console.error('[DocumentExport] Document export error:', error);
    res.status(500).json({
      error: 'Failed to export document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test endpoint
documentExportRouter.get('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('[DocumentExport] Testing document generation for ID:', id);

    const { data: document } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (!document) {
      return res.json({ 
        success: false, 
        message: 'Document not found' 
      });
    }

    // Validate document data
    const validation = {
      hasUnit: Boolean(document.unit),
      hasRecipients: Boolean(document.recipients),
      recipientsIsArray: Array.isArray(document.recipients),
      recipientCount: Array.isArray(document.recipients) ? document.recipients.length : 0
    };

    res.json({
      success: true,
      validation,
      document: {
        id: document.id,
        unit: document.unit,
        expenditureType: document.expenditure_type
      }
    });

  } catch (error) {
    console.error('[DocumentExport] Document test error:', error);
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export endpoint
documentExportRouter.get('/:id/export', exportDocument);

export default documentExportRouter;