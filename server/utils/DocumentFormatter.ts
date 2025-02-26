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
import { supabase } from "../db";
import type { DocumentTemplate } from '@shared/schema';

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
      return `${amount} €`;
    }
  }

  static async generateDocument(documentData: any, template: DocumentTemplate, config: any = {}) {
    try {
      console.log("Starting document generation with data:", { documentId: documentData.id, template: template.id });

      const unitDetails = await this.getUnitDetails(documentData.unit);
      console.log("Unit details for document:", unitDetails);

      // Prepare recipients data
      const recipients = Array.isArray(documentData.recipients)
        ? documentData.recipients.map((recipient: any) => ({
            lastname: String(recipient.lastname || '').trim(),
            firstname: String(recipient.firstname || '').trim(),
            fathername: String(recipient.fathername || '').trim(),
            amount: parseFloat(recipient.amount) || 0,
            installment: parseInt(recipient.installment) || 1,
            afm: String(recipient.afm || '').trim()
          }))
        : [];

      const sections = [{
        properties: {
          page: {
            margin: {
              top: config.margins?.top || convertInchesToTwip(1),
              right: config.margins?.right || convertInchesToTwip(1),
              bottom: config.margins?.bottom || convertInchesToTwip(1),
              left: config.margins?.left || convertInchesToTwip(1),
            },
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
            children: [
              new TextRun({
                text: "Ο ΠΡΟΪΣΤΑΜΕΝΟΣ",
                bold: true,
                size: 24,
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: unitDetails?.manager || "ΔΙΕΥΘΥΝΤΗΣ",
                bold: true,
                size: 24,
              })
            ],
            alignment: AlignmentType.CENTER,
          }),
        ]
      }];

      const doc = new Document({
        sections: sections,
        creator: "Document Export System",
        description: "Generated Document",
        title: `Document-${documentData.id}`,
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
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
              this.createTableCell(recipient.lastname || "", AlignmentType.LEFT),
              this.createTableCell(recipient.firstname || "", AlignmentType.LEFT),
              this.createTableCell(recipient.fathername || "", AlignmentType.LEFT),
              this.createTableCell(recipient.afm || "", AlignmentType.CENTER),
              this.createTableCell(
                this.formatCurrency(recipient.amount || 0),
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