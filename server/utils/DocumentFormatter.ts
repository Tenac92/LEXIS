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
  IDocumentOptions,
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
    if (!documentData || !template) {
      throw new Error('Missing required document data or template');
    }

    try {
      const unitDetails = await this.getUnitDetails(documentData.unit);

      const recipients = Array.isArray(documentData.recipients) 
        ? documentData.recipients.map((r: any, index: number) => ({
            lastname: String(r.lastname || '').trim(),
            firstname: String(r.firstname || '').trim(),
            fathername: String(r.fathername || '').trim(),
            amount: parseFloat(String(r.amount)) || 0,
            installment: parseInt(String(r.installment)) || 1,
            afm: String(r.afm || '').trim()
          }))
        : [];

      // Create document with basic settings
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: config.margins || this.getDefaultMargins(),
              size: {
                width: 11906,  // A4 width in twips
                height: 16838, // A4 height in twips
              },
            },
          },
          children: [
            ...(await this.createHeader(documentData, unitDetails)),
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            this.createPaymentTable(recipients),
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            this.createFooter(unitDetails)
          ]
        }],
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman",
                size: 24, // 12pt
              },
              paragraph: {
                spacing: { after: 120, before: 120 },
              },
            },
          },
        },
        compatibility: {
          doNotExpandShiftReturn: true,
          doNotUseHTMLParagraphAutoSpacing: true,
          doNotBreakWrappedTables: true,
          useNormalStyleForList: true,
          doNotUseIndentAsNumberingTabStop: true,
        }
      });

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
              this.createTableCell((index + 1).toString(), "center"),
              this.createTableCell(recipient.lastname, "left"),
              this.createTableCell(recipient.firstname, "left"),
              this.createTableCell(recipient.fathername || "", "left"),
              this.createTableCell(recipient.afm, "center"),
              this.createTableCell(
                this.formatCurrency(recipient.amount),
                "right"
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

  static createTableCell(text: string, alignment: "left" | "center" | "right") {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT
    };

    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 24 })],
          alignment: alignmentMap[alignment],
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