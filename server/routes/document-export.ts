import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { supabase } from '../config/db';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Fetch document data from supabase
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

    // Recipients are stored in the document object
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create simple document with just the table
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000
            }
          }
        },
        children: [
          new Paragraph({ 
            children: [new TextRun({ text: 'Document Export', bold: true })],
            alignment: AlignmentType.LEFT
          }),
          new Paragraph({ text: '' }),
          createSimpleTable(recipients)
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

function createSimpleTable(recipients: any[]) {
  // Create header row
  const headerRow = new TableRow({
    children: ['Name', 'AFM', 'Amount'].map(header =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: header, bold: true })],
          alignment: AlignmentType.LEFT
        })]
      })
    )
  });

  // Create recipient rows
  const recipientRows = recipients.map(recipient => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ 
              text: `${recipient.lastname} ${recipient.firstname}` 
            })],
            alignment: AlignmentType.LEFT
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: recipient.afm })],
            alignment: AlignmentType.LEFT
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: `${recipient.amount}€` })],
            alignment: AlignmentType.LEFT
          })]
        })
      ]
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 }
    },
    rows: [headerRow, ...recipientRows]
  });
}