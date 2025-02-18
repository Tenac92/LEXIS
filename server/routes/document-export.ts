import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { supabase } from '../config/db';
import path from 'path';

// Import the correct DocumentFormatter
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

    // Ensure recipients array
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create document with full formatting
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
          new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          new Paragraph({ 
            children: [
              new TextRun({ text: `Μονάδα: ${document.unit || 'N/A'}`, bold: true }),
              new TextRun({ text: `    NA853: ${document.project_na853 || 'N/A'}`, bold: true })
            ],
            spacing: { before: 240, after: 240 }
          }),
          DocumentFormatter.createPaymentTable(recipients),
          new Paragraph({ text: '', spacing: { before: 300 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ΣΥΝΟΛΟ: ', bold: true }),
              new TextRun({ 
                text: `${recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0).toFixed(2)}€` 
              })
            ]
          }),
          new Paragraph({ text: '', spacing: { before: 300 } }),
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

function calculateTotal(recipients: any[]): number {
  return recipients.reduce((sum, recipient) => sum + parseFloat(recipient.amount), 0);
}