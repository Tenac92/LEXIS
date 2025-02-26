import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  VerticalAlign,
  convertInchesToTwip,
} from "docx";
import { supabase } from "../config/db";
import type { DocumentTemplate } from '@shared/schema';

interface GenerateDocumentConfig {
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
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
  static createFooter(unitDetails: any) {
    return new Paragraph({
      children: [
        new TextRun({ 
          text: unitDetails?.manager || "Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΔΙΕΥΘΥΝΣΗΣ",
          bold: true,
          size: 24
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 720 },
    });
  }

  static async createHeader(document: any, unitDetails?: any) {
    const headerParagraphs = [
      new Paragraph({
        children: [new TextRun({ text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
      })
    ];

    if (unitDetails?.unit_name) {
      headerParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: unitDetails.unit_name, bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 },
        })
      );
    }

    return headerParagraphs;
  }

  static getDefaultMargins() {
    return {
      top: convertInchesToTwip(1),
      right: convertInchesToTwip(1),
      bottom: convertInchesToTwip(1),
      left: convertInchesToTwip(1),
    };
  }

  static formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat("el-GR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${amount.toFixed(2)} €`;
    }
  }

  static async generateDocument(
    documentData: any,
    template: DocumentTemplate,
    config: GenerateDocumentConfig = {}
  ): Promise<Buffer> {
    try {
      // Log input data for debugging
      console.log("Starting document generation with data:", {
        documentId: documentData?.id,
        templateId: template?.id,
        unit: documentData?.unit,
        recipientsCount: documentData?.recipients?.length
      });

      // Validate document data
      if (!documentData?.id) {
        throw new Error('Missing document ID');
      }

      if (!documentData.unit) {
        throw new Error('Missing unit information');
      }

      if (!Array.isArray(documentData.recipients)) {
        throw new Error('Recipients must be an array');
      }

      if (documentData.recipients.length === 0) {
        throw new Error('Document must have at least one recipient');
      }

      // Get unit details
      const unitDetails = await this.getUnitDetails(documentData.unit);
      if (!unitDetails) {
        console.warn('Unit details not found for unit:', documentData.unit);
      }

      // Validate and prepare recipients data
      const recipients: Recipient[] = documentData.recipients.map((r: any, index: number) => {
        if (!r.lastname || !r.firstname || !r.afm) {
          throw new Error(`Invalid recipient data at index ${index}`);
        }
        return {
          lastname: String(r.lastname).trim(),
          firstname: String(r.firstname).trim(),
          fathername: String(r.fathername || '').trim(),
          amount: parseFloat(String(r.amount)) || 0,
          installment: parseInt(String(r.installment)) || 1,
          afm: String(r.afm).trim()
        };
      });

      console.log("Prepared recipients data:", {
        count: recipients.length,
        totalAmount: recipients.reduce((sum, r) => sum + r.amount, 0)
      });

      // Create document with proper configurations
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: config.margins || this.getDefaultMargins(),
              size: {
                width: 11906,  // Standard A4 width in twips
                height: 16838, // Standard A4 height in twips
              },
            },
          },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 400 },
            }),
            ...(unitDetails?.unit_name ? [
              new Paragraph({
                children: [new TextRun({ text: unitDetails.unit_name, bold: true, size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 400 },
              })
            ] : []),
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            this.createPaymentTable(recipients),
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            new Paragraph({
              children: [new TextRun({ text: "Ο ΠΡΟΪΣΤΑΜΕΝΟΣ", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 720, after: 720 },
            }),
            new Paragraph({
              children: [new TextRun({ text: unitDetails?.manager || "ΔΙΕΥΘΥΝΤΗΣ", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
            }),
          ]
        }],
        creator: "Document Export System",
        description: `Generated Document ${documentData.id}`,
        title: `Document-${documentData.id}`,
        lastModifiedBy: "System",
        styles: {
          default: {
            document: {
              run: {
                font: "Calibri",
              },
            },
          },
        },
      });

      // Generate buffer
      console.log("Generating document buffer...");
      const buffer = await Packer.toBuffer(doc);

      if (!buffer || buffer.length === 0) {
        throw new Error('Generated document buffer is empty');
      }

      console.log("Document buffer generated successfully, size:", buffer.length);
      return buffer;

    } catch (error) {
      console.error("Error in document generation:", error);
      throw error;
    }
  }

  static createPaymentTable(recipients: Recipient[]) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: [
        new TableRow({
          children: [
            this.createTableHeaderCell("Α/Α"),
            this.createTableHeaderCell("ΕΠΩΝΥΜΟ"),
            this.createTableHeaderCell("ΟΝΟΜΑ"),
            this.createTableHeaderCell("ΠΑΤΡΩΝΥΜΟ"),
            this.createTableHeaderCell("ΑΦΜ"),
            this.createTableHeaderCell("ΠΟΣΟ (€)"),
          ],
        }),
        ...recipients.map((recipient, index) =>
          new TableRow({
            children: [
              this.createTableCell((index + 1).toString(), AlignmentType.CENTER),
              this.createTableCell(recipient.lastname, AlignmentType.LEFT),
              this.createTableCell(recipient.firstname, AlignmentType.LEFT),
              this.createTableCell(recipient.fathername || "", AlignmentType.LEFT),
              this.createTableCell(recipient.afm, AlignmentType.CENTER),
              this.createTableCell(
                this.formatCurrency(recipient.amount),
                AlignmentType.RIGHT
              ),
            ],
          })
        ),
      ],
    });
  }

  static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  static createTableCell(text: string, alignment: AlignmentType) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 24 })],
          alignment,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  static async getUnitDetails(unitCode: string) {
    try {
      console.log("Fetching unit details for:", unitCode);

      const { data: unitData, error: unitError } = await supabase
        .from('unit_det')
        .select('*')
        .eq('unit', unitCode)
        .single();

      if (unitError) {
        console.error("Error fetching unit details:", unitError);
        return null;
      }

      console.log("Unit details fetched:", unitData);
      return unitData;
    } catch (error) {
      console.error('Error in getUnitDetails:', error);
      return null;
    }
  }

  static formatDocumentNumber(id: number): string {
    return `${id.toString().padStart(6, '0')}`;
  }
}