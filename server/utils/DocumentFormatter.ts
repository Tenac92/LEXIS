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
} from "docx";
import { supabase } from "../config/db";

interface DocumentData {
  unit: string;
  telephone?: string;
  expenditure_type?: string;
  recipients?: Array<{
    lastname: string;
    firstname: string;
    fathername?: string;
    amount: number;
    installment: number;
    afm: string;
  }>;
}

interface UnitDetails {
  unit_name?: string;
  manager?: string;
  email?: string;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 24; // 12pt in half-points
  private static readonly DEFAULT_FONT = "Times New Roman";
  private static readonly DEFAULT_MARGINS = {
    top: 850,
    right: 1000,
    bottom: 850,
    left: 1000
  };

  static getDefaultMargins() {
    return this.DEFAULT_MARGINS;
  }

  private static validateDocumentData(data: DocumentData): void {
    if (!data.unit) {
      throw new Error('Unit is required');
    }
    if (data.recipients && !Array.isArray(data.recipients)) {
      throw new Error('Recipients must be an array');
    }
  }

  static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      // Validate input data
      this.validateDocumentData(documentData);
      console.log("Starting document generation with data:", JSON.stringify(documentData, null, 2));

      // Get unit details
      const unitDetails = await this.getUnitDetails(documentData.unit);
      if (!unitDetails) {
        console.warn("No unit details found for unit:", documentData.unit);
      }

      // Create document sections
      const headerSection = await this.createHeader(documentData, unitDetails);
      const paymentTable = this.createPaymentTable(documentData.recipients || []);
      const footerSection = await this.createFooter(documentData, unitDetails);

      // Create document
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: this.DEFAULT_MARGINS,
              size: {
                width: 11906,
                height: 16838,
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
        styles: {
          default: {
            document: {
              run: {
                font: this.DEFAULT_FONT,
                size: this.DEFAULT_FONT_SIZE,
              },
            },
          },
        }
      });

      // Generate buffer
      console.log("Generating document buffer...");
      const buffer = await Packer.toBuffer(doc);

      if (!buffer || buffer.length === 0) {
        throw new Error('Generated document buffer is empty');
      }

      console.log("Document generated successfully, buffer size:", buffer.length);
      return buffer;

    } catch (error) {
      console.error("Error in document generation:", error);
      throw error;
    }
  }

  private static async createHeader(documentData: DocumentData, unitDetails?: UnitDetails) {
    try {
      const managerName = unitDetails?.manager?.split(' ΠΟΛ')[0].trim() || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      const headerParagraphs = [
        this.createCenteredParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", true),
        this.createCenteredParagraph("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", true),
        this.createCenteredParagraph("ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", true),
        this.createCenteredParagraph("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ", true),
        this.createCenteredParagraph("ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ", true),
      ];

      if (unitDetails?.unit_name) {
        headerParagraphs.push(
          this.createCenteredParagraph(unitDetails.unit_name, true, { before: 200, after: 400 })
        );
      }

      // Contact information
      const contactTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: this.getNoBorders(),
        rows: [
          this.createContactRow("Ταχ. Δ/νση", "Δημοκρίτου 2"),
          this.createContactRow("Ταχ. Κώδικας", "115 23, Μαρούσι"),
          this.createContactRow("Πληροφορίες", managerName),
          this.createContactRow("Τηλέφωνο", documentData.telephone || ""),
          this.createContactRow("E-mail", unitDetails?.email || "daefkke@civilprotection.gr"),
        ],
      });

      // Protocol number and date
      const protocolTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: this.getNoBorders(),
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
                    children: [new TextRun({ 
                      text: `Αθήνα, ${new Date().toLocaleDateString("el-GR")}`,
                      size: this.DEFAULT_FONT_SIZE 
                    })],
                    alignment: AlignmentType.RIGHT,
                  }),
                  new Paragraph({
                    children: [new TextRun({ 
                      text: "Αρ. Πρωτ.: ......................",
                      size: this.DEFAULT_FONT_SIZE,
                      bold: true 
                    })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 40, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      });

      return [...headerParagraphs, contactTable, protocolTable];
    } catch (error) {
      console.error("Error creating header:", error);
      throw error;
    }
  }

  private static createCenteredParagraph(text: string, bold: boolean = false, spacing?: { before: number; after: number }) {
    return new Paragraph({
      children: [new TextRun({ 
        text,
        bold,
        size: this.DEFAULT_FONT_SIZE 
      })],
      alignment: AlignmentType.CENTER,
      spacing: spacing || { before: 200, after: 200 },
    });
  }

  private static createContactRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ 
              text: `${label}:`,
              size: this.DEFAULT_FONT_SIZE 
            })]
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ 
              text: value,
              size: this.DEFAULT_FONT_SIZE 
            })]
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  }

  private static getNoBorders() {
    return {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }
    };
  }

  private static createPaymentTable(recipients: DocumentData['recipients'] = []) {
    const rows = [
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
              new Intl.NumberFormat("el-GR", {
                style: "currency",
                currency: "EUR",
                minimumFractionDigits: 2,
              }).format(recipient.amount),
              "right"
            ),
          ],
        })
      ),
    ];

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
      rows,
    });
  }

  private static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ 
            text,
            bold: true,
            size: this.DEFAULT_FONT_SIZE 
          })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static createTableCell(text: string, alignment: "left" | "center" | "right") {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT
    };

    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ 
            text,
            size: this.DEFAULT_FONT_SIZE 
          })],
          alignment: alignmentMap[alignment],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static async getUnitDetails(unitCode: string): Promise<UnitDetails | null> {
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

  private static async createFooter(documentData: DocumentData, unitDetails?: UnitDetails) {
    try {
      const { data: attachmentData } = await supabase
        .from("attachments")
        .select("*")
        .eq("expediture_type", documentData.expenditure_type)
        .eq("installment", documentData.recipients?.[0]?.installment || 1)
        .single();

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

      const managerName = unitDetails?.manager?.split(' ΠΟΛ')[0].trim() || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      return [
        this.createParagraphWithSpacing("ΣΥΝΗΜΜΕΝΑ:", true),
        ...attachments.map(attachment => this.createParagraphWithSpacing(attachment)),
        this.createParagraphWithSpacing("ΚΟΙΝΟΠΟΙΗΣΗ:", true),
        ...notifications.map(notification => this.createParagraphWithSpacing(notification)),
        this.createParagraphWithSpacing("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:", true),
        ...internalDist.map(dist => this.createParagraphWithSpacing(dist)),
        this.createCenteredParagraph(
          `Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ ${unitDetails?.unit_name || 'Δ.Α.Ε.Φ.Κ.'}`,
          true,
          { before: 1440, after: 0 }
        ),
        new Paragraph({ text: "", spacing: { before: 720, after: 720 } }),
        this.createCenteredParagraph(managerName, true),
        this.createCenteredParagraph("ΠΟΛ. ΜΗΧΑΝΙΚΟΣ"),
      ];
    } catch (error) {
      console.error("Error creating footer:", error);
      throw error;
    }
  }

  private static createParagraphWithSpacing(text: string, bold: boolean = false) {
    return new Paragraph({
      children: [new TextRun({ 
        text,
        bold,
        size: this.DEFAULT_FONT_SIZE 
      })],
      spacing: { before: 100, after: 100 },
    });
  }
}