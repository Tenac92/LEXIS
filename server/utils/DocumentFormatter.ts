import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign, IBorderOptions } from 'docx';
import { Request } from 'express';

interface DocumentMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Recipient {
  lastname: string;
  firstname: string;
  fathername?: string;
  amount: number;
  installment: number;
  afm: string;
}

export class DocumentFormatter {
  private static readonly DEFAULT_EMAIL = 'daefkke@civilprotection.gr';
  private static readonly DEFAULT_ADDRESS = 'Κηφισίας 124 & Ιατρίδου 2';
  private static readonly DEFAULT_POSTAL_CODE = '11526';
  private static readonly DEFAULT_CITY = 'Αθήνα';

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  static formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static formatDocumentNumber(number: string): string {
    return String(number).padStart(6, '0');
  }

  static getDefaultMargins(): DocumentMargins {
    return {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440
    };
  }

  static createDocumentHeader(): Paragraph[] {
    return [
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
          new TextRun({ text: this.DEFAULT_EMAIL, size: 24 })
        ],
        spacing: { before: 120, after: 120 }
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
          this.createTableCell(this.formatCurrency(recipient.amount), AlignmentType.RIGHT),
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

  static createDistributionSection(): Paragraph[] {
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

    return [
      new Paragraph({
        children: [new TextRun({ text: 'ΚΟΙΝΟΠΟΙΗΣΗ', bold: true, size: 24 })],
        spacing: { before: 360, after: 120 }
      }),
      ...notifications.map((item, index) => new Paragraph({
        children: [new TextRun({ text: `${index + 1}. ${item}`, size: 24 })],
        spacing: { before: 60, after: 60 }
      })),
      new Paragraph({
        children: [new TextRun({ text: 'ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ', bold: true, size: 24 })],
        spacing: { before: 240, after: 120 }
      }),
      ...internalDist.map((item, index) => new Paragraph({
        children: [new TextRun({ text: `${index + 1}. ${item}`, size: 24 })],
        spacing: { before: 60, after: 60 }
      }))
    ];
  }

  static createMetadataSection(protocolNumber?: string, protocolDate?: string): Paragraph[] {
    const formattedDate = protocolDate ? this.formatDate(protocolDate) : this.formatDate(new Date());

    return [
      new Paragraph({
        children: [
          new TextRun({ text: this.DEFAULT_CITY + ', ', size: 24 }),
          new TextRun({ text: formattedDate, size: 24 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Αρ. Πρωτ.: ', size: 24 }),
          new TextRun({ text: protocolNumber || '', size: 24 })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120, after: 240 }
      })
    ];
  }

  static createDocumentFooter(): Paragraph[] {
    return [
      new Paragraph({
        children: [new TextRun({ text: 'ΤΜΗΜΑ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ ΑΠΟΚΑΤΑΣΤΑΣΗΣ & ΕΚΠΑΙΔΕΥΣΗΣ (Π.Α.Ε.)', bold: true, size: 24 })],
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