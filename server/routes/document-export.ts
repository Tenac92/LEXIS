import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';

export const documentExportRouter = Router();

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    console.log('Starting document export for ID:', id);

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (docError) {
      console.error('Database query error:', docError);
      return res.status(500).json({ message: 'Error fetching document' });
    }

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log document data for debugging
    console.log('Document data:', {
      id: document.id,
      hasRecipients: Boolean(document.recipients),
      recipientCount: document.recipients?.length,
      unit: document.unit,
      expenditureType: document.expenditure_type
    });

    // Get template
    const template = await TemplateManager.getTemplateForExpenditure(document.expenditure_type);

    if (!template) {
      return res.status(400).json({ message: 'Template not found' });
    }

    // Generate document buffer
    console.log('Generating document...');
    const buffer = await DocumentFormatter.generateDocument(document, template);

    // Set headers and send response
    const filename = `document-${document.id.toString().padStart(6, '0')}.docx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send buffer
    res.send(buffer);

  } catch (error) {
    console.error('Document export error:', error);
    res.status(500).json({
      message: 'Failed to generate document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test endpoint
documentExportRouter.get('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Testing document generation for ID:', id);

    const { data: document } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (!document) {
      return res.json({ success: false, message: 'Document not found' });
    }

    res.json({
      success: true,
      document: {
        id: document.id,
        hasRecipients: Boolean(document.recipients),
        recipientCount: document.recipients?.length,
        unit: document.unit,
        expenditureType: document.expenditure_type
      }
    });

  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export endpoint
documentExportRouter.get('/:id/export', exportDocument);

function convertInchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}

export default documentExportRouter;