/**
 * Document Generator - Complete document generation functionality
 * 
 * Generates Greek government documents with proper formatting, headers, tables, and footers.
 * Supports multiple expenditure types with dynamic column configurations.
 * 
 * File Structure:
 * 1. Imports and constants
 * 2. Main DocumentGenerator class
 * 3. Public generation methods
 * 4. Private helper methods for document sections
 * 5. Utility methods for formatting and styling
 */

// ===== IMPORTS =====

// External library imports
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeightRule,
  VerticalAlign,
  ImageRun,
} from "docx";

// Node.js built-in imports
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Local imports
import { DocumentUtilities } from "./document-utilities";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

// ===== CONSTANTS =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger("DocumentGenerator");

// ===== MAIN CLASS =====

export class DocumentGenerator {
  
  // ===== PUBLIC METHODS =====
  
  /**
   * Generate primary document
   * Main entry point for document generation
   */
  public static async generatePrimaryDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);

      const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
      
      const documentSections = [
        await this.createDocumentHeader(documentData, unitDetails),
        this.createDocumentSubject(documentData, unitDetails),
        ...this.createLegalReferences(),
        ...this.createMainContent(documentData),
        ...this.createProjectInfo(documentData),
        this.createPaymentTable(documentData.recipients || [], documentData.expenditure_type),
        this.createFinalRequest(),
        this.createFooter(documentData, unitDetails),
      ];

      const document = new Document({
        sections: [{
          properties: {
            page: { margin: DocumentUtilities.DOCUMENT_MARGINS }
          },
          children: documentSections,
        }],
        styles: {
          default: {
            document: {
              run: {
                font: DocumentUtilities.DEFAULT_FONT,
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
              },
            },
          },
        },
      });

      return await Packer.toBuffer(document);
      
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Get expenditure configuration (reused multiple times)
   */
  private static getExpenditureConfig(documentData: DocumentData) {
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    return { expenditureType, config };
  }

  /**
   * Create document header with logo, contact info, and recipient details
   */
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined
  ): Promise<Table> {
    const logoData = this.getLogoData();
    const contactInfo = this.createContactInfo(documentData, unitDetails);
    const recipientInfo = this.createRecipientInfo(documentData, unitDetails);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE, size: 0 } },
      rows: [
        new TableRow({
          children: [
            // Left column - Logo and contact info
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoData,
                      transformation: { width: 120, height: 120 },
                      type: "png",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 120 },
                }),
                ...contactInfo,
              ],
            }),
            // Right column - Recipient info
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
              children: recipientInfo,
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create contact information paragraphs
   */
  private static createContactInfo(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined
  ): Paragraph[] {
    const address = unitDetails?.address || {
      address: "Δημοκρίτου 2",
      tk: "11523",
      region: "Μαρούσι",
    };
    const contactPerson = documentData.generated_by?.name || documentData.user_name || "Υπάλληλος";
    const telephone = documentData.generated_by?.telephone || documentData.contact_number || "2131331391";
    const email = unitDetails?.email || "daefkke@civilprotection.gr";

    return [
      this.createContactParagraph(`Ταχ. Δ/νση: ${address.address}`),
      this.createContactParagraph(`Ταχ. Κώδικας: ${address.tk}, ${address.region}`),
      this.createContactParagraph(`Πληροφορίες: ${contactPerson}`),
      this.createContactParagraph(`Τηλέφωνο: ${telephone}`),
      this.createContactParagraph(`Email: ${email}`, 120),
    ];
  }

  /**
   * Create recipient information paragraphs
   */
  private static createRecipientInfo(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined
  ): Paragraph[] {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
    });

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `Μαρούσι: ${formattedDate}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "ΠΡΟΣ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "ΥΠΟΥΡΓΕΙΟ ΟΙΚΟΝΟΜΙΚΩΝ",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Γ.Λ.Κ.",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Δ/ΝΣΗ ΕΚΤΕΛΕΣΗΣ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "ΤΜΗΜΑ ΠΡΟΛΗΨΗΣ ΚΑΙ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΖΗΜΙΩΝ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Κάρολου 5",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Τ.Κ. 10184 ΑΘΗΝΑ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      }),
    ];
  }

  /**
   * Create document subject with bordered table
   */
  private static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined
  ): Table {
    const { config } = this.getExpenditureConfig(documentData);
    const documentTitle = config.documentTitle;
    const unitName = unitDetails?.unit_name?.name || unitDetails?.name || "Διεύθυνση";
    const unitProp = unitDetails?.unit_name?.prop || "τη";

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.getStandardBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: this.getStandardBorders(),
              margins: { top: 50, bottom: 50, left: 50, right: 50 },
              width: { size: 100, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΘΕΜΑ: ",
                      bold: true,
                      italics: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                    new TextRun({
                      text: `${documentTitle} ${unitProp} ${unitName}`,
                      italics: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  spacing: { after: 0 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create legal references section
   */
  private static createLegalReferences(): Paragraph[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Έχοντας υπόψη:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { before: 240, after: 120 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0 } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                borders: this.getNoBorders(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "1.",
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                        font: DocumentUtilities.DEFAULT_FONT,
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
                  }),
                ],
              }),
              new TableCell({
                width: { size: 85, type: WidthType.PERCENTAGE },
                borders: this.getNoBorders(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Τις διατάξεις του Π.Δ. 57/2019 (Α΄ 87) «Οργανισμός της Γενικής Γραμματείας Πολιτικής Προστασίας».",
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                        font: DocumentUtilities.DEFAULT_FONT,
                      }),
                    ],
                    alignment: AlignmentType.JUSTIFY,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];
  }

  /**
   * Create main content section
   */
  private static createMainContent(documentData: DocumentData): Paragraph[] {
    const { config } = this.getExpenditureConfig(documentData);

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: config.mainText,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 0 },
      }),
    ];
  }

  /**
   * Create project information section
   */
  private static createProjectInfo(documentData: DocumentData): Paragraph[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `Πρόγραμμα - Έργο: ${documentData.project_na853 || documentData.mis || ""}`,
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { before: 120, after: 120 },
      }),
    ];
  }

  /**
   * Create payment table with dynamic columns based on expenditure type
   */
  private static createPaymentTable(recipients: any[], expenditureType: string): Table {
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const columns = config.columns;

    // Create header row
    const headerCells = columns.map(column =>
      new TableCell({
        children: [
          DocumentUtilities.createCenteredParagraph(column, {
            bold: false,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
          }),
        ],
        borders: this.getStandardBorders(),
      })
    );

    const rows = [new TableRow({ children: headerCells, tableHeader: true })];
    let totalAmount = 0;

    // Create data rows
    recipients.forEach((recipient, index) => {
      const rowData = this.createRecipientRowData(recipient, index, expenditureType);
      totalAmount += rowData.amount;
      rows.push(...rowData.rows);
    });

    // Add total row
    const totalCells = this.createTotalRow(columns.length, totalAmount);
    rows.push(new TableRow({ children: totalCells }));

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.getStandardBorders(),
      rows,
    });
  }

  /**
   * Create final request paragraph
   */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε για την έκδοση του σχετικού χρηματικού εντάλματος.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      spacing: { before: 240, after: 240 },
    });
  }

  /**
   * Create document footer with attachments and signature
   */
  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined
  ): Table {
    const attachmentList = this.createAttachmentList(documentData);
    const signatureSection = this.createSignatureSection(unitDetails);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE, size: 0 } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
              children: attachmentList,
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
              children: signatureSection,
            }),
          ],
        }),
      ],
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Get logo data for document header
   */
  private static getLogoData(): Buffer {
    // Return empty buffer as placeholder - actual logo implementation would go here
    return Buffer.from("");
  }

  /**
   * Create contact paragraph with consistent formatting
   */
  private static createContactParagraph(text: string, spacingAfter: number = 0): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: spacingAfter },
    });
  }

  /**
   * Create recipient row data for payment table
   */
  private static createRecipientRowData(recipient: any, index: number, expenditureType: string) {
    const firstname = recipient.firstname || "";
    const lastname = recipient.lastname || "";
    const fathername = recipient.fathername || "";
    const fullName = !fathername || fathername.trim() === ""
      ? `${lastname} ${firstname}`.trim()
      : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();
    
    const afm = recipient.afm || "";
    const rowNumber = `${index + 1}.`;
    
    let installments: string[] = [];
    if (Array.isArray(recipient.installments) && recipient.installments.length > 0) {
      installments = recipient.installments;
    } else if (recipient.installment) {
      installments = [recipient.installment.toString()];
    } else {
      installments = ["ΕΦΑΠΑΞ"];
    }

    const installmentAmounts = recipient.installmentAmounts || {};
    const totalAmount = installments.reduce((sum, installment) => {
      return sum + (installmentAmounts[installment] || recipient.amount || 0);
    }, 0);

    // Create table cells based on expenditure type
    const baseCells = [
      this.createTableCell(rowNumber),
      this.createTableCell(fullName),
      this.createTableCell(afm),
    ];

    // Add expenditure-specific column
    if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ") {
      baseCells.push(this.createTableCell(recipient.days?.toString() || "1"));
    } else if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
      baseCells.push(this.createTableCell(recipient.months?.toString() || "1"));
    } else {
      baseCells.push(this.createTableCell(installments.join(", ")));
    }

    // Add amount column
    baseCells.push(this.createTableCell(DocumentUtilities.formatCurrency(totalAmount)));

    return {
      rows: [new TableRow({ children: baseCells })],
      amount: totalAmount,
    };
  }

  /**
   * Create total row for payment table
   */
  private static createTotalRow(columnCount: number, totalAmount: number): TableCell[] {
    const cells: TableCell[] = [];
    
    // Empty cells before total
    for (let i = 0; i < columnCount - 1; i++) {
      cells.push(this.createTableCell(""));
    }
    
    // Total amount cell
    cells.push(this.createTableCell(DocumentUtilities.formatCurrency(totalAmount), true));
    
    return cells;
  }

  /**
   * Create attachment list for footer
   */
  private static createAttachmentList(documentData: DocumentData): Paragraph[] {
    const attachments = (documentData.attachments || [])
      .filter((attachment): attachment is string => typeof attachment === "string" && attachment.trim() !== "")
      .slice(0, 3);

    if (attachments.length === 0) {
      attachments.push("Τα απαραίτητα δικαιολογητικά");
    }

    const paragraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 120 },
      }),
    ];

    attachments.forEach((attachment, index) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${attachment}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 60 },
        })
      );
    });

    return paragraphs;
  }

  /**
   * Create signature section for footer
   */
  private static createSignatureSection(unitDetails: UnitDetails | null | undefined): Paragraph[] {
    const managerName = unitDetails?.manager?.name || "ΥΠΑΛΛΗΛΟΣ";
    const managerTitle = unitDetails?.manager?.title || "Ο ΠΡΟΪΣΤΑΜΕΝΟΣ";
    const managerOrder = unitDetails?.manager?.order || "";
    const managerDegree = unitDetails?.manager?.degree || "";

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: managerOrder,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: managerTitle,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: managerName,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: managerDegree,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ];
  }

  /**
   * Create table cell with consistent formatting
   */
  private static createTableCell(text: string, bold: boolean = false): TableCell {
    return new TableCell({
      children: [
        DocumentUtilities.createCenteredParagraph(text, {
          bold,
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
        }),
      ],
      borders: this.getStandardBorders(),
    });
  }

  /**
   * Get standard border configuration
   */
  private static getStandardBorders() {
    return {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    };
  }

  /**
   * Get no border configuration
   */
  private static getNoBorders() {
    return {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
    };
  }
}