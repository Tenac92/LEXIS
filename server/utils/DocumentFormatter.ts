import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign } from 'docx';
import { supabase } from '../config/db';

export class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 1440, // Increased top margin for letterhead
      right: 1440,
      bottom: 1440,
      left: 1440
    };
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  static formatDocumentNumber(id: number): string {
    return `DOC-${String(id).padStart(6, '0')}`;
  }

  static createHeaderTable(headerInfo: Array<{ text: string; bold: boolean }>, rightColumnInfo: Array<{ text: string; bold: boolean }>) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: headerInfo.map(item => new Paragraph({
                children: [new TextRun({ 
                  text: item.text,
                  size: 24,
                  bold: item.bold
                })],
                alignment: AlignmentType.LEFT,
                spacing: { before: 120, after: 120 }
              })),
              width: { size: 65, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE }
              }
            }),
            new TableCell({
              children: rightColumnInfo.map(item => new Paragraph({
                children: [new TextRun({ 
                  text: item.text,
                  size: 24,
                  bold: item.bold
                })],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 120, after: 120 }
              })),
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE }
              }
            })
          ]
        })
      ]
    });
  }

  static createPaymentTable(recipients: any[]) {
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
        // Header row
        new TableRow({
          children: [
            this.createTableHeaderCell('Α/Α'),
            this.createTableHeaderCell('ΕΠΩΝΥΜΟ'),
            this.createTableHeaderCell('ΟΝΟΜΑ'),
            this.createTableHeaderCell('ΠΑΤΡΩΝΥΜΟ'),
            this.createTableHeaderCell('ΑΦΜ'),
            this.createTableHeaderCell('ΠΟΣΟ (€)')
          ]
        }),
        // Data rows
        ...recipients.map((recipient, index) => 
          new TableRow({
            children: [
              this.createTableCell((index + 1).toString(), AlignmentType.CENTER),
              this.createTableCell(recipient.lastname || '', AlignmentType.LEFT),
              this.createTableCell(recipient.firstname || '', AlignmentType.LEFT),
              this.createTableCell(recipient.fathername || '', AlignmentType.LEFT),
              this.createTableCell(recipient.afm || '', AlignmentType.CENTER),
              this.createTableCell(this.formatCurrency(recipient.amount || 0), AlignmentType.RIGHT)
            ]
          })
        )
      ]
    });
  }

  static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24 })],
        alignment: AlignmentType.CENTER
      })],
      verticalAlign: VerticalAlign.CENTER
    });
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

  static createDefaultHeader(unitDetails: any = {}) {
    const headerInfo = [
      { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
      { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &', bold: true },
      { text: 'ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
      { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ', bold: true },
      { text: 'ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
      { text: unitDetails?.unit_name || '', bold: true }
    ];

    const rightColumnInfo = [
      { text: 'ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ', bold: true },
      { text: '', bold: false },
      { text: `Αθήνα, ${new Date().toLocaleDateString('el-GR')}`, bold: false },
      { text: 'Αρ. Πρωτ.: ......................', bold: true }
    ];

    return this.createHeaderTable(headerInfo, rightColumnInfo);
  }

  static async createFooter(document: any = {}) {
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

    const footerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 }
      },
      rows: [
        new TableRow({
          children: [
            // Left column: Attachments and distributions
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ:', bold: true, size: 24 })],
                  spacing: { before: 240, after: 240 }
                }),
                ...this.createListItems(attachments),
                new Paragraph({
                  children: [new TextRun({ text: 'ΚΟΙΝΟΠΟΙΗΣΗ:', bold: true, size: 24 })],
                  spacing: { before: 240, after: 240 }
                }),
                ...this.createListItems(notifications),
                new Paragraph({
                  children: [new TextRun({ text: 'ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:', bold: true, size: 24 })],
                  spacing: { before: 240, after: 240 }
                }),
                ...this.createListItems(internalDist)
              ],
              width: { size: 60, type: WidthType.PERCENTAGE }
            }),
            // Right column: Signature
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.', bold: true, size: 24 })],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 1440 }
                }),
                new Paragraph({
                  text: '',
                  spacing: { before: 720, after: 720 }
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ', bold: true, size: 24 })],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ', size: 24 })],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 40, type: WidthType.PERCENTAGE }
            })
          ]
        })
      ]
    });

    return footerTable;
  }

  static createListItems(items: string[]) {
    return items.map((item, index) => new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${item}`, size: 24 })],
      indent: { left: 360 },
      spacing: { before: 120, after: 120 }
    }));
  }
}