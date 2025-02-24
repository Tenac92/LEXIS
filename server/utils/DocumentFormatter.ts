import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign } from 'docx';
import { supabase } from '../config/db';

export class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 850,
      right: 1000,
      bottom: 850,
      left: 1000
    };
  }

  static createHeader(text: string, size = 24, bold = true) {
    return new Paragraph({
      children: [new TextRun({ text, size, bold })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 }
    });
  }

  static createContactField(label: string, value: string) {
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

  static createPaymentTable(documents: any[]) {
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
        this.createTableHeader(['Α.Α.', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ', 'ΑΦΜ']),
        ...this.createTableRows(documents)
      ]
    });
  }

  static createTableHeader(headers: string[]) {
    return new TableRow({
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

  static createTableRows(documents: any[]) {
    return documents.map((doc, index) => 
      new TableRow({
        children: [
          this.createTableCell((index + 1).toString() + '.', AlignmentType.CENTER),
          this.createTableCell(`${doc.lastname} ${doc.firstname} ${doc.fathername || ''}`.trim(), AlignmentType.LEFT),
          this.createTableCell(parseFloat(doc.amount).toFixed(2), AlignmentType.RIGHT),
          this.createTableCell(doc.installment.toString(), AlignmentType.CENTER),
          this.createTableCell(doc.afm, AlignmentType.CENTER)
        ]
      })
    );
  }

  static createTableCell(text: string, alignment: AlignmentType) {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: 24 })],
        alignment
      })],
      verticalAlign: VerticalAlign.CENTER
    });
  }

  static createDocumentHeader(req: any, unitDetails: any = {}) {
    const defaultEmail = unitDetails?.email || 'daefkke@civilprotection.gr';

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
      { text: 'ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ', bold: true },
      { text: '', bold: false },
      { text: 'Αθήνα, ........................', bold: true },
      { text: 'Αρ. Πρωτ.: ......................', bold: true }
    ];

    return this.createHeaderTable(headerInfo, rightColumnInfo);
  }

  static createHeaderTable(headerInfo: Array<{ text: string; bold: boolean }>, rightColumnInfo: Array<{ text: string; bold: boolean }>) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
      rows: [this.createHeaderRow(headerInfo, rightColumnInfo)]
    });
  }

  static createHeaderRow(headerInfo: Array<{ text: string; bold: boolean }>, rightColumnInfo: Array<{ text: string; bold: boolean }>) {
    return new TableRow({
      children: [
        this.createHeaderColumn(headerInfo, 65),
        this.createHeaderColumn(rightColumnInfo, 35)
      ]
    });
  }

  static createHeaderColumn(info: Array<{ text: string; bold: boolean }>, width: number) {
    return new TableCell({
      children: info.map(item => new Paragraph({
        children: [new TextRun({ text: item.text, size: 20, bold: item.bold })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0 }
      })),
      width: { size: width, type: WidthType.PERCENTAGE }
    });
  }

  static async createDocumentFooter(document: any = {}) {
    const { data: attachmentData } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', document.expenditure_type)
      .eq('installment', document.recipients?.[0]?.installment || 1)
      .single();

    const attachments = attachmentData?.attachments || [
      'Διαβιβαστικό',
      'ΔΚΑ'
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
      borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
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

  static createListItems(items: string[]) {
    return items.map((item, index) => new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${item}` })],
      indent: { left: 240 },
      spacing: { before: 60, after: 60 }
    }));
  }
}