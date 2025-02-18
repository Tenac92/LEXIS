import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { supabase } from '../config/db';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { format, unit_details, contact_info, margins, include_attachments, include_signatures } = req.body;

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

    // Parse recipients from JSON array
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create document sections
    const headerTable = createDocumentHeader(unit_details, contact_info);
    const contentTable = createPaymentTable(recipients);
    const footerTable = createDocumentFooter(unit_details);

    // Create document
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            margin: margins || {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000
            }
          } 
        },
        children: [
          headerTable,
          ...createMainContent(document),
          contentTable,
          footerTable
        ]
      }]
    });

    // Pack document
    const buffer = await Packer.toBuffer(docx);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);

    // Send document
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function createDocumentHeader(unitDetails: any, contactInfo: any) {
  const headerInfo = [
    { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
    { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
    { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
    { text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true },
    { text: unitDetails?.unit_name || '', bold: true },
    { text: '', bold: false },
    { text: `Ταχ. Δ/νση: ${contactInfo?.address || 'Κηφισίας 124 & Ιατρίδου 2'}`, bold: false },
    { text: `Ταχ. Κώδικας: ${contactInfo?.postal_code || '11526'}, ${contactInfo?.city || 'Αθήνα'}`, bold: false },
    { text: `Πληροφορίες: ${contactInfo?.contact_person || ''}`, bold: false },
    { text: `Email: ${unitDetails?.email || 'daefkke@civilprotection.gr'}`, bold: false }
  ];

  const rightColumnInfo = [
    { text: 'ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ', bold: true },
    { text: '', bold: false },
    { text: 'Αθήνα, ........................', bold: true },
    { text: 'Αρ. Πρωτ.: ......................', bold: true }
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { 
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            children: headerInfo.map(item => 
              new Paragraph({
                children: [new TextRun({ text: item.text, bold: item.bold, size: 20 })],
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0 }
              })
            )
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: rightColumnInfo.map(item =>
              new Paragraph({
                children: [new TextRun({ text: item.text, bold: item.bold, size: 20 })],
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0 }
              })
            )
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
        new TextRun({ text: ' Έγκριση χορήγησης Στεγαστικής Συνδρομής για την αποκατάσταση της πληγείσας κατοικίας' })
      ],
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Έχοντας υπόψη:' })],
      spacing: { before: 200, after: 200 }
    })
  ];
}

function createPaymentTable(recipients: any[]) {
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
    rows: [
      new TableRow({
        children: ['Α/Α', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΑΦΜ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ'].map(header =>
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: header, bold: true })],
              alignment: AlignmentType.CENTER
            })]
          })
        )
      }),
      ...recipients.map((recipient, index) => 
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
                children: [new TextRun({ text: recipient.amount.toFixed(2) })],
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
      )
    ]
  });
}

function createDocumentFooter(unitDetails: any) {
  const attachments = [
    'Η σε ορθή επανάληψη έγκριση Σ.Σ για ανακατ. κτιρίου',
    'Οι εκδοθείσες άδειες επισκευής κτιρίου',
    'Οι εγκρίσεις Σ.Σ για ανακατασκευή άδειες επισκευής',
    'Υπεύθυνες δηλώσεις δικαιούχων',
    'Φωτοτυπίες των βιβλιαρίων',
    'Φωτοτυπίες ΑΔΤ των δικαιούχων',
    'Ένας συγκεντρωτικός πίνακας των δικαιούχων'
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { 
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true })],
                spacing: { before: 240, after: 240 }
              }),
              ...attachments.map((text, index) => 
                new Paragraph({
                  children: [new TextRun({ text: `${index + 1}. ${text}` })],
                  indent: { left: 240 },
                  spacing: { before: 60, after: 60 }
                })
              ),
              new Paragraph({ text: '', spacing: { before: 3000 } }),
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