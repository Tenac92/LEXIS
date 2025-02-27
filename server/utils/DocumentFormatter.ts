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
      top: 850,
      right: 1000,
      bottom: 850,
      left: 1000
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
      console.log("Generating document with data:", documentData);
      const unitDetails = await this.getUnitDetails(documentData.unit);
      console.log("Unit details for document:", unitDetails);

      // Create document sections
      const headerSection = await this.createHeader(documentData, unitDetails);
      const paymentTable = this.createPaymentTable(documentData.recipients || []);
      const footerSection = await this.createFooter(documentData, unitDetails);

      // Create document with all sections
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: config.margins || this.getDefaultMargins(),
              size: {
                width: 11906, // Standard A4 width in twips (210mm)
                height: 16838, // Standard A4 height in twips (297mm)
              },
            },
          },
          children: [
            ...headerSection,
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            paymentTable,
            new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
            ...footerSection
          ]
        }],
        compatibility: {
          doNotExpandShiftReturn: true,
          doNotUseHTMLParagraphAutoSpacing: true,
          doNotBreakWrappedTables: true,
          useNormalStyleForList: true,
          doNotUseIndentAsNumberingTabStop: true,
          doNotSuppressIndentation: true,
        },
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman",
                size: 24, // 12pt in half-points
              },
              paragraph: {
                spacing: { after: 200, before: 200 },
              },
            },
          },
        }
      });

      console.log("Document generation completed, packing to buffer");
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

  static async createHeader(documentData: any, unitDetails?: any) {
    try {
      const managerName = unitDetails?.manager ? 
        unitDetails.manager.split(' ΠΟΛ')[0].trim() : 
        "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

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
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ", bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ", bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
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

      // Add contact information
      const contactTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        rows: [
          this.createContactRow("Ταχ. Δ/νση", "Δημοκρίτου 2"),
          this.createContactRow("Ταχ. Κώδικας", "115 23, Μαρούσι"),
          this.createContactRow("Πληροφορίες", managerName),
          this.createContactRow("Τηλέφωνο", documentData.telephone || ""),
          this.createContactRow("E-mail", unitDetails?.email || "daefkke@civilprotection.gr"),
        ],
      });

      // Add protocol number and date
      const protocolSection = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: "" })],
                width: { size: 60, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: `Αθήνα, ${new Date().toLocaleDateString("el-GR")}`, size: 24 })],
                    alignment: AlignmentType.RIGHT,
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Αρ. Πρωτ.: ......................", bold: true, size: 24 })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 40, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      });

      return [...headerParagraphs, contactTable, protocolSection];
    } catch (error) {
      console.error("Error creating header:", error);
      throw error;
    }
  }

  private static createContactRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label + ":", size: 24 })] })],
          width: { size: 30, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 24 })] })],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    });
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

  static async createFooter(documentData: any, unitDetails?: any) {
    try {
      console.log("Creating footer with document:", documentData);

      const { data: attachmentData, error: attachmentError } = await supabase
        .from("attachments")
        .select("*")
        .eq("expediture_type", documentData.expenditure_type)
        .eq("installment", documentData.recipients?.[0]?.installment || 1)
        .single();

      if (attachmentError) {
        console.error("Error fetching attachments:", attachmentError);
      }

      const attachments = attachmentData?.attachments || [""];
      const notifications = [
        "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
        "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
        "Γ.Δ.Α.Ε.Φ.Κ.",
      ];

      const internalDist = [
        "Χρονολογικό Αρχείο",
        "Τμήμα Β/20.51",
        "Αβραμόπουλο Ι.",
      ];

      const managerName = unitDetails?.manager ? 
        unitDetails.manager.split(' ΠΟΛ')[0].trim() : 
        "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      return [
        new Paragraph({
          children: [new TextRun({ text: "ΣΥΝΗΜΜΕΝΑ:", bold: true, size: 24 })],
          spacing: { before: 200, after: 200 },
        }),
        ...attachments.map(attachment => 
          new Paragraph({
            children: [new TextRun({ text: attachment, size: 24 })],
            spacing: { before: 100, after: 100 },
          })
        ),
        new Paragraph({
          children: [new TextRun({ text: "ΚΟΙΝΟΠΟΙΗΣΗ:", bold: true, size: 24 })],
          spacing: { before: 200, after: 200 },
        }),
        ...notifications.map(notification => 
          new Paragraph({
            children: [new TextRun({ text: notification, size: 24 })],
            spacing: { before: 100, after: 100 },
          })
        ),
        new Paragraph({
          children: [new TextRun({ text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:", bold: true, size: 24 })],
          spacing: { before: 200, after: 200 },
        }),
        ...internalDist.map(dist => 
          new Paragraph({
            children: [new TextRun({ text: dist, size: 24 })],
            spacing: { before: 100, after: 100 },
          })
        ),
        new Paragraph({
          children: [
            new TextRun({
              text: `Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ ${unitDetails?.unit_name || 'Δ.Α.Ε.Φ.Κ.'}`,
              bold: true,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 1440 },
        }),
        new Paragraph({
          text: "",
          spacing: { before: 720, after: 720 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: managerName,
              bold: true,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΠΟΛ. ΜΗΧΑΝΙΚΟΣ", size: 24 })],
          alignment: AlignmentType.CENTER,
        }),
      ];
    } catch (error) {
      console.error("Error creating footer:", error);
      throw error;
    }
  }
}