import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { supabase } from '../config/db';

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

    // Recipients are stored in the document object
    const recipients = Array.isArray(document.recipients) ? document.recipients : [];

    // Create document sections with proper formatting
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            margin: {
              top: 850,
              right: 1000,
              bottom: 850,
              left: 1000
            },
            size: { width: 11906, height: 16838 },
            columns: { space: 708, count: 2 }
          }
        },
        children: [
          createDocumentHeader(req),
          new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
          createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          new Paragraph({ 
            children: [
              new TextRun({ text: `Μονάδα: ${document.unit || 'N/A'}`, bold: true }),
              new TextRun({ text: `    NA853: ${document.project_na853 || 'N/A'}`, bold: true })
            ],
            spacing: { before: 240, after: 240 }
          }),
          createPaymentTable(recipients),
          new Paragraph({ text: '', spacing: { before: 300 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ΣΥΝΟΛΟ: ', bold: true }),
              new TextRun({ text: `${calculateTotal(recipients).toFixed(2)}€` })
            ]
          }),
          new Paragraph({ text: '', spacing: { before: 300 } }),
          createDocumentFooter()
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

function createHeader(text: string, size = 24, bold = true): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size, bold })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 }
  });
}

function createDocumentHeader(req: Request) {
  const defaultEmail = 'daefkke@civilprotection.gr';

  const headerInfo = [
    { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
    { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
    { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
    { text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true },
    { text: '', bold: false },
    { text: 'Ταχ. Δ/νση: Κηφισίας 124 & Ιατρίδου 2', bold: false },
    { text: 'Ταχ. Κώδικας: 11526, Αθήνα', bold: false },
    { text: `Πληροφορίες: ${req?.user?.name || ''}`, bold: false },
    { text: 'Email: ' + defaultEmail, bold: false }
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
      right: { style: BorderStyle.NONE }
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
            children: [new TextRun({ text: (index + 1).toString() + '.' })],
            alignment: AlignmentType.CENTER
          })]
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ 
              text: `${recipient.lastname} ${recipient.firstname} ${recipient.fathername || ''}`.trim() 
            })],
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
            children: [new TextRun({ text: parseFloat(recipient.amount).toFixed(2) })],
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

function createDocumentFooter() {
  const attachments = [
    'Η σε ορθή επανάληψη έγκριση Σ.Σ για ανακατ. κτιρίου',
    'Οι εκδοθείσες άδειες επισκευής κτιρίου',
    'Οι εγκρίσεις Σ.Σ για ανακατασκευή άδειες επισκευής',
    'Υπεύθυνες δηλώσεις δικαιούχων',
    'Φωτοτυπίες των βιβλιαρίων',
    'Φωτοτυπίες ΑΔΤ των δικαιούχων',
    'Ένας συγκεντρωτικός πίνακας των δικαιούχων'
  ];

  const notifications = [
    'Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας',
    'Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής',
    'Γ.Δ.Α.Ε.Φ.Κ.'
  ];

  const internalDist = [
    'Χρονολογικό Αρχείο',
    'Τμήμα Β/20.51',
    'Αβραμόπουλο Ι.'
  ];

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
              new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
              new Paragraph({
                children: [new TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true })],
                spacing: { before: 240, after: 240 }
              }),
              ...attachments.map((item, index) => new Paragraph({
                children: [new TextRun({ text: `${index + 1}. ${item}` })],
                indent: { left: 240 },
                spacing: { before: 60, after: 60 }
              })),
              new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
              new Paragraph({
                children: [new TextRun({ text: 'ΚΟΙΝΟΠΟΙΗΣΗ', bold: true })],
                spacing: { before: 60, after: 240 }
              }),
              ...notifications.map((item, index) => new Paragraph({
                children: [new TextRun({ text: `${index + 1}. ${item}` })],
                indent: { left: 240 },
                spacing: { before: 60, after: 60 }
              })),
              new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
              new Paragraph({
                children: [new TextRun({ text: 'ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ', bold: true })],
                spacing: { before: 60, after: 60 }
              }),
              ...internalDist.map((item, index) => new Paragraph({
                children: [new TextRun({ text: `${index + 1}. ${item}` })],
                indent: { left: 240 },
                spacing: { before: 60, after: 60 }
              }))
            ],
            width: { size: 65, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [
              new Paragraph({ text: '', spacing: { before: 3000 } }),
              new Paragraph({
                children: [new TextRun({ text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.', bold: true })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                text: '',
                alignment: AlignmentType.CENTER,
                spacing: { before: 500 }
              }),
              new Paragraph({
                children: [new TextRun({ text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ', bold: true })],
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                children: [new TextRun({ text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ' })],
                alignment: AlignmentType.CENTER
              })
            ],
            width: { size: 35, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ]
  });
}