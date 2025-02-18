import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table } from 'docx';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { format, unit_details, contact_info, margins, include_attachments, include_signatures } = req.body;

    // Fetch document data from database
    const document = await db.query(`
      SELECT d.*, array_agg(json_build_object(
        'firstname', r.firstname,
        'lastname', r.lastname,
        'afm', r.afm,
        'amount', r.amount,
        'installment', r.installment
      )) as recipients
      FROM generated_documents d
      LEFT JOIN recipients r ON d.id = r.document_id
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);

    if (!document.rows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = document.rows[0];

    // Create document sections
    const headerTable = createDocumentHeader(unit_details, contact_info);
    const contentTable = createPaymentTable(doc.recipients);
    const footerTable = createDocumentFooter(unit_details);

    // Create document
    const docx = new Document({
      sections: [{
        properties: { page: { margin: margins } },
        children: [
          headerTable,
          ...createMainContent(doc),
          contentTable,
          footerTable
        ]
      }]
    });

    // Pack document
    const buffer = await Packer.toBuffer(docx);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${doc.document_number || doc.id}.docx`);
    
    // Send document
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export document' });
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
    { text: `Ταχ. Δ/νση: ${contactInfo.address}`, bold: false },
    { text: `Ταχ. Κώδικας: ${contactInfo.postal_code}, ${contactInfo.city}`, bold: false },
    { text: `Πληροφορίες: ${contactInfo.contact_person}`, bold: false },
    { text: `Email: ${unitDetails.email}`, bold: false }
  ];

  const rightColumnInfo = [
    { text: 'ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ', bold: true },
    { text: '', bold: false },
    { text: 'Αθήνα, ........................', bold: true },
    { text: 'Αρ. Πρωτ.: ......................', bold: true }
  ];

  return new Table({
    width: { size: 100, type: 'pct' },
    borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
    rows: [{
      children: [
        {
          children: headerInfo.map(item => new Paragraph({
            children: [new TextRun({ text: item.text, size: 20, bold: item.bold })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 0 }
          })),
          width: { size: 65, type: 'pct' }
        },
        {
          children: rightColumnInfo.map(item => new Paragraph({
            children: [new TextRun({ text: item.text, size: 20, bold: item.bold })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 0 }
          })),
          width: { size: 35, type: 'pct' }
        }
      ]
    }]
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
    width: { size: 100, type: 'pct' },
    borders: {
      top: { style: 'single', size: 1 },
      bottom: { style: 'single', size: 1 },
      left: { style: 'single', size: 1 },
      right: { style: 'single', size: 1 }
    },
    rows: [
      {
        children: ['Α/Α', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΑΦΜ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ'].map(
          header => ({
            children: [new Paragraph({
              children: [new TextRun({ text: header, bold: true })],
              alignment: AlignmentType.CENTER
            })]
          })
        )
      },
      ...recipients.map((recipient, index) => ({
        children: [
          { children: [new Paragraph({ text: (index + 1).toString() })] },
          { children: [new Paragraph({ text: `${recipient.lastname} ${recipient.firstname}` })] },
          { children: [new Paragraph({ text: recipient.afm })] },
          { children: [new Paragraph({ text: recipient.amount.toFixed(2) })] },
          { children: [new Paragraph({ text: recipient.installment.toString() })] }
        ]
      }))
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
    width: { size: 100, type: 'pct' },
    borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
    rows: [{
      children: [
        {
          children: [
            new Paragraph({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true }),
            ...attachments.map((text, index) => 
              new Paragraph({
                text: `${index + 1}. ${text}`,
                indent: { left: 240 }
              })
            ),
            new Paragraph({ text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.', bold: true, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: '', spacing: { before: 500 } }),
            new Paragraph({ text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ', bold: true, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ', alignment: AlignmentType.CENTER })
          ]
        }
      ]
    }]
  });
}
