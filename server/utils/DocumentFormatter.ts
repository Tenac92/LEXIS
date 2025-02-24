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

export class DocumentFormatter {
  private static readonly DEFAULT_EMAIL = 'daefkke@civilprotection.gr';

  static getDefaultMargins(): DocumentMargins {
    return {
      top: 850,
      right: 1000,
      bottom: 850,
      left: 1000
    };
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
        this.createTableHeader(['Α.Α.', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ', 'ΑΦΜ']),
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
          this.createTableCell((index + 1).toString() + '.', AlignmentType.CENTER),
          this.createTableCell(
            `${recipient.lastname} ${recipient.firstname} ${recipient.fathername || ''}`.trim(), 
            AlignmentType.LEFT
          ),
          this.createTableCell(
            recipient.amount.toFixed(2), 
            AlignmentType.RIGHT
          ),
          this.createTableCell(
            recipient.installment.toString(), 
            AlignmentType.CENTER
          ),
          this.createTableCell(
            recipient.afm, 
            AlignmentType.CENTER
          )
        ]
      })
    );
  }

  private static createTableCell(text: string, alignment: AlignmentType): TableCell {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: 24 })],
        alignment
      })]
    });
  }

  static createDocumentHeader(req: Request, unitDetails: UnitDetails = {}): Table {
    const defaultEmail = unitDetails?.email || this.DEFAULT_EMAIL;

    const headerInfo = [
      { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
      { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
      { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
      { text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true },
      { text: unitDetails?.unit_name || '', bold: true },
      ...(unitDetails?.parts || []).map(part => ({ text: part, bold: true })),
      { text: '', bold: false },
      { text: 'Ταχ. Δ/νση: Κηφισίας 124 & Ιατρίδου 2', bold: false },
      { text: 'Ταχ. Κώδικας: 11526, Αθήνα', bold: false },
      { text: `Πληροφορίες: ${req?.user?.name || ''}`, bold: false },
      { text: 'Email: ' + defaultEmail, bold: false }
    ];

    const rightColumnInfo = [
      { text: 'Αθήνα, ........................', bold: true },
      { text: 'Αρ. Πρωτ.: ......................', bold: true }
    ];

    return this.createHeaderTable(headerInfo, rightColumnInfo);
  }

  private static createHeaderTable(
    headerInfo: Array<{ text: string; bold: boolean }>,
    rightColumnInfo: Array<{ text: string; bold: boolean }>
  ): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { 
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [this.createHeaderRow(headerInfo, rightColumnInfo)]
    });
  }

  private static createHeaderRow(
    headerInfo: Array<{ text: string; bold: boolean }>,
    rightColumnInfo: Array<{ text: string; bold: boolean }>
  ): TableRow {
    return new TableRow({
      children: [
        this.createHeaderColumn(headerInfo, 65),
        this.createHeaderColumn(rightColumnInfo, 35)
      ]
    });
  }

  private static createHeaderColumn(
    info: Array<{ text: string; bold: boolean }>,
    width: number
  ): TableCell {
    return new TableCell({
      children: info.map(item => new Paragraph({
        children: [new TextRun({ text: item.text, size: 20, bold: item.bold })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0 }
      })),
      width: { size: width, type: WidthType.PERCENTAGE }
    });
  }

  static createDocumentFooter(): Table {
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
        right: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
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
                ...this.createListItems(attachments),
                new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
                new Paragraph({
                  children: [new TextRun({ text: 'ΚΟΙΝΟΠΟΙΗΣΗ', bold: true })],
                  spacing: { before: 60, after: 240 }
                }),
                ...this.createListItems(notifications),
                new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
                new Paragraph({
                  children: [new TextRun({ text: 'ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ', bold: true })],
                  spacing: { before: 60, after: 60 }
                }),
                ...this.createListItems(internalDist)
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

  private static createListItems(items: string[]): Paragraph[] {
    return items.map((item, index) => new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${item}` })],
      indent: { left: 240 },
      spacing: { before: 60, after: 60 }
    }));
  }
}