import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';
import { authenticateSession } from '../middleware/auth';

export const documentExportRouter = Router();

export async function exportDocument(req: Request, res: Response) {
  const startTime = Date.now();
  console.log(`[${startTime}] Starting document export process`);

  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      console.error('Invalid document ID:', id);
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const documentId = parseInt(id);
    console.log(`Processing document export for ID: ${documentId}`);

    // Fetch document data with recipients
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error('Database query error:', docError);
      return res.status(500).json({ 
        message: 'Error fetching document data',
        error: docError.message 
      });
    }

    if (!document) {
      console.log('Document not found:', documentId);
      return res.status(404).json({ message: 'Document not found' });
    }

    console.log('Document found:', {
      id: document.id,
      expenditure_type: document.expenditure_type,
      recipients: document.recipients?.length || 0
    });

    // Get appropriate template
    const template = await TemplateManager.getTemplateForExpenditure(document.expenditure_type);
    if (!template) {
      console.error('No template found for:', document.expenditure_type);
      return res.status(400).json({ message: 'No template found for this expenditure type' });
    }

    console.log('Template found:', {
      id: template.id,
      name: template.name
    });

    // Generate document buffer
    try {
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

      console.log(`Document buffer generated successfully, size: ${buffer.length} bytes`);

      // Set response headers for binary download
      const filename = `document-${documentId.toString().padStart(6, '0')}.docx`;
      console.log('Setting download headers for:', filename);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      // Send the document buffer
      console.log('Sending document buffer to client');
      res.write(buffer);
      res.end();

      const endTime = Date.now();
      console.log(`[${endTime}] Document export completed successfully. Duration: ${endTime - startTime}ms`);

    } catch (genError) {
      console.error('Document generation error:', genError);
      return res.status(500).json({
        message: 'Failed to generate document',
        error: genError instanceof Error ? genError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({
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

export default documentExportRouter;