import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign } from 'docx';

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
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  static formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static formatDocumentNumber(number: string | number): string {
    return number.toString().padStart(6, '0');
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
        children: [new TextRun({ text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 }
      })
    ];
  }

  static createPaymentTable(recipients: any[]): Table {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Α/Α" })], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ΕΠΩΝΥΜΟ" })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ΟΝΟΜΑ" })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ΠΑΤΡΩΝΥΜΟ" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ΑΦΜ" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ΠΟΣΟ (€)" })], width: { size: 20, type: WidthType.PERCENTAGE } })
        ]
      }),
      ...recipients.map((recipient, index) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: (index + 1).toString() })], width: { size: 10, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: recipient.lastname })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: recipient.firstname })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: recipient.fathername || '' })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: recipient.afm })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: this.formatCurrency(recipient.amount) })], width: { size: 20, type: WidthType.PERCENTAGE } })
          ]
        })
      )
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      }
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
          new TextRun({ text: 'Αθήνα, ', size: 24 }),
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
  
  static createListItems(items: string[]): Paragraph[] {
    return items.map((item, index) => new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${item}` })],
      indent: { left: 240 },
      spacing: { before: 60, after: 60 }
    }));
  }
}