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

  static getDefaultMargins(): DocumentMargins {
    return {
      top: 850,
      right: 1000,
      bottom: 850,
      left: 1000
    };
  }

  static createMetadataSection(metadata: MetadataSection): Paragraph[] {
    const today = new Date().toLocaleDateString('el-GR');

    return [
      new Paragraph({
        children: [
          new TextRun({ text: 'Αριθμός Πρωτοκόλλου: ', bold: true, size: 24 }),
          new TextRun({ text: metadata.protocol_number || '', size: 24 })
        ],
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Ημερομηνία: ', bold: true, size: 24 }),
          new TextRun({ text: metadata.protocol_date || today, size: 24 })
        ],
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

  static createAttachmentSection(attachments: string[]): Paragraph[] {
    if (!attachments.length) return [];

    return [
      new Paragraph({
        children: [new TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true, size: 24 })],
        spacing: { before: 360, after: 240 }
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
      )
    ];
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

  static createDocumentHeader(req: Request, unitDetails: UnitDetails = {}): Paragraph[] {
    const defaultEmail = unitDetails?.email || this.DEFAULT_EMAIL;

    const headerInfo = [
      { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
      { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
      { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
      { text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true },
      { text: unitDetails?.unit_name || '', bold: true },
      ...(unitDetails?.parts || []).map(part => ({ text: part, bold: true }))
    ];

    return headerInfo.map(info =>
      new Paragraph({
        children: [new TextRun({
          text: info.text,
          bold: info.bold,
          size: 24
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 }
      })
    );
  }

  static createDocumentFooter(details: FooterDetails): Paragraph[] {
    const footerParagraphs: Paragraph[] = [];

    // Contact information
    if (details.contact_person) {
      footerParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Πληροφορίες: ', size: 24 }),
            new TextRun({ text: details.contact_person, size: 24 })
          ],
          spacing: { before: 240, after: 120 }
        })
      );
    }

    // Department
    if (details.department) {
      footerParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: details.department, bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
          alignment: AlignmentType.CENTER
        })
      );
    }

    // Signatory
    if (details.signatory) {
      footerParagraphs.push(
        new Paragraph({ text: '', spacing: { before: 360 } }),
        new Paragraph({
          children: [new TextRun({ text: details.signatory, bold: true, size: 24 })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120, after: 120 }
        })
      );
    }

    return footerParagraphs;
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