import { Request, Response, Router } from 'express';
import { supabase } from '../db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';
import { authenticateSession } from '../middleware/auth';

export const documentExportRouter = Router();

// Protect all export routes with authentication
documentExportRouter.use(authenticateSession);

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const exportConfig = req.body;
    console.log(`Starting document export for ID: ${id} with config:`, exportConfig);

    // Verify user session
    if (!req.session?.user) {
      console.log('Export attempt without authentication');
      return res.status(401).json({ message: 'Authentication required' });
    }

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
    const template = await TemplateManager.getTemplateForExpenditure(document.expenditure_type);
    if (!template) {
      console.error('No template found for expenditure type:', document.expenditure_type);
      return res.status(400).json({ message: 'No template found for this expenditure type' });
    }

    console.log('Generating document using template...');
    const formatConfig = {
      format: exportConfig.format || 'docx',
      margins: exportConfig.margins || {
        top: convertInchesToTwip(1),
        right: convertInchesToTwip(1),
        bottom: convertInchesToTwip(1),
        left: convertInchesToTwip(1)
      },
      unit_details: exportConfig.unit_details,
      contact_info: exportConfig.contact_info,
      include_attachments: exportConfig.include_attachments !== false,
      include_signatures: exportConfig.include_signatures !== false
    };

    const buffer = await DocumentFormatter.generateDocument(document, template, formatConfig);

    // Set proper headers for DOCX file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    console.log('Sending document response');
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Register routes for document export
documentExportRouter.get('/:id/export', exportDocument);
documentExportRouter.post('/:id/export', exportDocument);

function convertInchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}