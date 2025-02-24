import { Request, Response, Router } from 'express';
import { Document, Packer } from 'docx';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { authenticateSession } from '../middleware/auth';

export const documentExportRouter = Router();

// Protect the export route with authentication
documentExportRouter.use(authenticateSession);

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Verify user session
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Create document with proper structure
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            ...DocumentFormatter.getDefaultMargins(),
            size: { width: 11906, height: 16838 }
          }
        },
        children: [
          DocumentFormatter.createDocumentHeader(req, {
            unit_name: document.unit,
            email: document.contact_email,
            parts: document.unit_parts || []
          }),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ'),
          DocumentFormatter.createPaymentTable(document.recipients || []),
          await DocumentFormatter.createDocumentFooter(document)
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

documentExportRouter.get('/:id/export', exportDocument);