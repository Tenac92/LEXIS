import { Request, Response } from 'express';
import { Document, Packer } from 'docx';
import { supabase } from '../config/db';
import path from 'path';

// Import the DocumentFormatter
const DocumentFormatter = require(path.join(__dirname, '../../attached_assets/documentFormatter.js'));

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Ensure recipients array is properly formatted
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create document using DocumentFormatter
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            ...DocumentFormatter.getDefaultMargins(),
            size: { width: 11906, height: 16838 },
            columns: { space: 708, count: 2 }
          }
        },
        children: [
          DocumentFormatter.createDocumentHeader(req),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          DocumentFormatter.createPaymentTable(recipients),
          DocumentFormatter.createDocumentFooter()
        ]
      }]
    });

    const buffer = await Packer.toBuffer(docx);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}