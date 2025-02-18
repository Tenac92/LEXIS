import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { supabase } from '../config/db';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const config = req.method === 'POST' ? req.body : {};

    // Fetch document data from supabase - simplified query
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

    // Recipients are already stored in the document object
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create document with sections
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            margin: config.margins || {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000
            }
          } 
        },
        children: [
          createHeader(config.unit_details || {}, config.contact_info || {}),
          ...createMainContent(document),
          createPaymentTable(recipients),
          createFooter()
        ]
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(docx);

    // Set headers and send response
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

function createHeader(unitDetails: any, contactInfo: any) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { 
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true, size: 24 })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                children: [new TextRun({ text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true, size: 24 })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                children: [new TextRun({ text: unitDetails?.unit_name || '', bold: true })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 240 }
              }),
              new Paragraph({
                children: [new TextRun({ text: `Email: ${unitDetails?.email || 'daefkke@civilprotection.gr'}` })],
                alignment: AlignmentType.LEFT
              })
            ]
          })
        ]
      })
    ]
  });
}

function createMainContent(doc: any) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'ΘΕΜΑ:', bold: true }),
        new TextRun({ text: ' Έγκριση χορήγησης Στεγαστικής Συνδρομής' })
      ],
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Πρωτόκολλο: ${doc.protocol_number || ''}` })
      ],
      spacing: { before: 200, after: 400 }
    })
  ];
}

function createPaymentTable(recipients: any[]) {
  const headerRow = new TableRow({
    children: ['Α/Α', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΑΦΜ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ'].map(header =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: header, bold: true })],
          alignment: AlignmentType.CENTER
        })]
      })
    )
  });

  const recipientRows = recipients.map((recipient, index) => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: (index + 1).toString() })],
            alignment: AlignmentType.CENTER
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: `${recipient.lastname} ${recipient.firstname}` })],
            alignment: AlignmentType.LEFT
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: recipient.afm })],
            alignment: AlignmentType.CENTER
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: recipient.amount.toString() })],
            alignment: AlignmentType.RIGHT
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: recipient.installment.toString() })],
            alignment: AlignmentType.CENTER
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

function createFooter() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { 
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ text: '', spacing: { before: 500 } }),
              new Paragraph({
                children: [new TextRun({ text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.', bold: true })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({ text: '', spacing: { before: 500 } }),
              new Paragraph({
                children: [new TextRun({ text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ', bold: true })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                children: [new TextRun({ text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ' })],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        ]
      })
    ]
  });
}