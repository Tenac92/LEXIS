import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign, IBorderOptions } from 'docx';
import { Request } from 'express';

interface DocumentMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface UnitDetails {
  unit_name?: string;
  email?: string;
  parts?: string[];
}

interface Recipient {
  lastname: string;
  firstname: string;
  fathername?: string;
  amount: number;
  installment: number;
  afm: string;
}

interface MetadataSection {
  protocol_number?: string;
  protocol_date?: string;
  document_number?: string;
}

interface FooterDetails {
  signatory?: string;
  department?: string;
  contact_person?: string;
}

export class DocumentFormatter {
  private static readonly DEFAULT_EMAIL = 'daefkke@civilprotection.gr';
  private static readonly DEFAULT_ADDRESS = 'Κηφισίας 124 & Ιατρίδου 2';
  private static readonly DEFAULT_POSTAL_CODE = '11526';
  private static readonly DEFAULT_CITY = 'Αθήνα';

  static getDefaultMargins(): DocumentMargins {
    return {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440
    };
  }

  static createDocumentHeader(req: Request, unitDetails: UnitDetails = {}): Paragraph[] {
    const defaultEmail = unitDetails?.email || this.DEFAULT_EMAIL;

    const headerInfo = [
      new Paragraph({
        children: [new TextRun({ text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: '& ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Δ/ΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Ταχ. Δ/νση    : ', size: 24 }),
          new TextRun({ text: this.DEFAULT_ADDRESS, size: 24 })
        ],
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Ταχ. Κώδικας : ', size: 24 }),
          new TextRun({ text: this.DEFAULT_POSTAL_CODE + ', ' + this.DEFAULT_CITY, size: 24 })
        ],
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Email               : ', size: 24 }),
          new TextRun({ text: defaultEmail, size: 24 })
        ],
        spacing: { before: 120, after: 120 }
      })
    ];

    return headerInfo;
  }

  static createMetadataSection(metadata: MetadataSection): Paragraph[] {
    const today = new Date().toLocaleDateString('el-GR');

    return [
      new Paragraph({
        children: [
          new TextRun({ text: this.DEFAULT_CITY + ', ', size: 24 }),
          new TextRun({ text: metadata.protocol_date || today, size: 24 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Αρ. Πρωτ.: ', size: 24 }),
          new TextRun({ text: metadata.protocol_number || '', size: 24 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120, after: 240 }
      })
    ];
  }

  static createPaymentTable(recipients: Recipient[]): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      } as { [key: string]: IBorderOptions },
      rows: [
        this.createTableHeader(['Α/Α', 'ΕΠΩΝΥΜΟ', 'ΟΝΟΜΑ', 'ΠΑΤΡΩΝΥΜΟ', 'ΑΦΜ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ']),
        ...this.createTableRows(recipients)
      ]
    });
  }

  static createTotalSection(total: number): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: 'ΣΥΝΟΛΙΚΟ ΠΟΣΟ: ', bold: true, size: 24 }),
        new TextRun({
          text: total.toLocaleString('el-GR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
          }),
          size: 24
        })
      ],
      spacing: { before: 360, after: 360 },
      alignment: AlignmentType.RIGHT
    });
  }

  static createAttachmentSection(attachments: string[]): Paragraph[] {
    return [
      new Paragraph({
        children: [new TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true, size: 24 })],
        spacing: { before: 360, after: 120 }
      }),
      ...attachments.map((attachment, index) =>
        new Paragraph({
          children: [new TextRun({
            text: `${index + 1}. ${attachment}`,
            size: 24
          })],
          spacing: { before: 120, after: 120 },
          indent: { left: 720 }
        })
      ),
      this.createDistributionSection()
    ];
  }

  private static createDistributionSection(): Paragraph {
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

    return new Paragraph({
      children: [
        new TextRun({ text: '\nΚΟΙΝΟΠΟΙΗΣΗ\n', bold: true, size: 24 }),
        ...notifications.map((item, index) => 
          new TextRun({ text: `${index + 1}. ${item}\n`, size: 24 })),
        new TextRun({ text: '\nΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ\n', bold: true, size: 24 }),
        ...internalDist.map((item, index) => 
          new TextRun({ text: `${index + 1}. ${item}\n`, size: 24 }))
      ],
      spacing: { before: 360, after: 360 }
    });
  }

  static createDocumentFooter(details: FooterDetails): Paragraph[] {
    return [
      new Paragraph({
        children: [new TextRun({ text: details.department || '', bold: true, size: 24 })],
        spacing: { before: 360, after: 120 },
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ text: '', spacing: { before: 360 } }),
      new Paragraph({
        children: [new TextRun({ text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 }
      }),
      new Paragraph({ text: '', spacing: { before: 720 } }),
      new Paragraph({
        children: [new TextRun({ text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ', size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      })
    ];
  }

  private static createTableHeader(headers: string[]): TableRow {
    return new TableRow({
      tableHeader: true,
      children: headers.map(header =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: header, bold: true, size: 24 })],
            alignment: AlignmentType.CENTER
          })],
          verticalAlign: VerticalAlign.CENTER
        })
      )
    });
  }

  private static createTableRows(recipients: Recipient[]): TableRow[] {
    return recipients.map((recipient, index) =>
      new TableRow({
        children: [
          this.createTableCell((index + 1).toString(), AlignmentType.CENTER),
          this.createTableCell(recipient.lastname, AlignmentType.LEFT),
          this.createTableCell(recipient.firstname, AlignmentType.LEFT),
          this.createTableCell(recipient.fathername || '', AlignmentType.LEFT),
          this.createTableCell(recipient.afm, AlignmentType.CENTER),
          this.createTableCell(
            recipient.amount.toLocaleString('el-GR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }),
            AlignmentType.RIGHT
          ),
          this.createTableCell(recipient.installment.toString(), AlignmentType.CENTER)
        ]
      })
    );
  }

  private static createTableCell(text: string, alignment: AlignmentType): TableCell {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: 24 })],
        alignment
      })],
      verticalAlign: VerticalAlign.CENTER
    });
  }
  static createHeader(text: string, size: number = 24, bold: boolean = true): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, size, bold })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 }
    });
  }

  static createContactField(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: label, size: 24 }),
        new TextRun({ text: '\t:\t', size: 24 }),
        new TextRun({ text: value, size: 24 })
      ],
      spacing: { before: 120, after: 120 },
      indent: { left: 720 }
    });
  }

  private static createListItems(items: string[]): Paragraph[] {
    return items.map((item, index) => new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${item}` })],
      indent: { left: 240 },
      spacing: { before: 60, after: 60 }
    }));
  }
}