/**
 * Document Generator - Complete document generation functionality
 * Single file for all Greek government document generation with expenditure type handling
 * 
 * This file is organized in a logical top-down order matching the document structure:
 * 1. Main generation method
 * 2. Document header components (logo, contact info, recipient info)
 * 3. Document subject
 * 4. Legal references
 * 5. Main content
 * 6. Project information
 * 7. Payment table
 * 8. Final request
 * 9. Footer components
 */

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
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { DocumentUtilities } from "./document-utilities";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentGenerator");

export class DocumentGenerator {
  // ========================================
  // 1. MAIN GENERATION METHOD
  // ========================================
  
  /**
   * Generate primary document - Main entry point
   */
  public static async generatePrimaryDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);

      // Get unit details
      const unitDetails = await DocumentUtilities.getUnitDetails(
        documentData.unit,
      );

      // Create document sections in the order they appear in the document
      const children: any[] = [
        // Logo at the top of the document
        this.createDocumentLogo(),

        // Header with two-column layout (includes contact info and recipient section)
        await this.createDocumentHeader(documentData, unitDetails),

        // Subject
        this.createDocumentSubject(documentData, unitDetails),

        // Legal references
        ...this.createLegalReferences(),

        // Main request text
        ...this.createMainContent(documentData),

        // Project information
        ...this.createProjectInfo(documentData),

        // Payment table
        this.createPaymentTable(
          documentData.recipients || [],
          documentData.expenditure_type,
        ),

        // Final request
        this.createFinalRequest(),

        // Footer
        this.createFooter(documentData, unitDetails),
      ];

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: DocumentUtilities.DOCUMENT_MARGINS,
              },
            },
            children,
          },
        ],
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

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }

  // ========================================
  // 2. DOCUMENT HEADER COMPONENTS
  // ========================================

  /**
   * Create document logo at the top
   */
  private static createDocumentLogo(): Paragraph {
    return new Paragraph({
      children: [
        new ImageRun({
          data: fs.readFileSync(path.join(__dirname, "ethnosimo22.png")),
          transformation: {
            width: 40,
            height: 40,
          },
          type: "png",
        } as any),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
    });
  }

  /**
   * Create document header with two-column layout
   */
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    // Check if documentData.unit exists to determine if we should show the government logo or unit name
    const isMinistry = documentData.unit === "MINISTRY";
    const hasUnitDetails = unitDetails && unitDetails.name;

    const leftColumnParagraphs = this.createContactInfo(documentData);
    const rightColumnParagraphs = this.createRecipientInfo();

    // Create table header with sender and recipient
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      columnWidths: [3000, 3000],
      rows: [
        new TableRow({
          children: [
            // Left cell with header info
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              children: [
                // Government header
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE + 1,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΚΑΙ ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 1,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: hasUnitDetails
                        ? unitDetails.name
                        : "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΑΠΟ ΕΠΙΠΤΩΣΕΙΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 1,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΚΑΙ ΑΠΟΖΗΜΙΩΣΕΩΝ (Δ.Α.Ε.Φ.Κ.)",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 1,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 100 },
                }),
                ...leftColumnParagraphs,
              ],
            }),
            // Right cell with protocol info and recipient
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              children: [
                // Protocol and date section
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Μαρούσι, ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                    new TextRun({
                      text: DocumentUtilities.formatGreekDate(
                        documentData.protocol_date ||
                          documentData.created_at ||
                          new Date(),
                      ),
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
                      text: "Αρ. Πρωτ.: ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                    new TextRun({
                      text: documentData.protocol_number || "___________",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 200 },
                }),
                // Recipient section
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΠΡΟΣ:",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΥΠ. ΕΣΩΤΕΡΙΚΩΝ",
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
                      text: "Γ.Γ. ΟΙΚΟΝΟΜΙΚΩΝ ΥΠΗΡΕΣΙΩΝ",
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
                      text: "Δ/ΝΣΗ ΔΗΜΟΣΙΟΝΟΜΙΚΗΣ ΠΟΛΙΤΙΚΗΣ",
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
                      text: "ΤΜΗΜΑ Α΄",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 80 },
                }),
                ...rightColumnParagraphs,
              ],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Create contact information section
   */
  private static createContactInfo(documentData: DocumentData): Paragraph[] {
    const contactParagraphs: Paragraph[] = [];

    // Contact details
    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Ταχ. Δ/νση: Δημοκρίτου 2",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Ταχ. Κώδικας: 11523, Μαρούσι",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    const contactPerson =
      documentData.generated_by?.name || documentData.user_name || "Υπάλληλος";
    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Πληροφορίες: ${contactPerson}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    const telephone =
      documentData.generated_by?.telephone ||
      documentData.contact_number ||
      "2131331391";
    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Τηλέφωνο: ${telephone}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Email: daefkke@civilprotection.gr",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      }),
    );

    return contactParagraphs;
  }

  /**
   * Create recipient information (placeholder for any additional recipient info)
   */
  private static createRecipientInfo(): Paragraph[] {
    return [];
  }

  // ========================================
  // 3. DOCUMENT SUBJECT
  // ========================================

  /**
   * Create document subject with bordered table
   */
  private static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const documentTitle = config.documentTitle;

    const subjectText = [
      {
        text: "ΘΕΜΑ:",
        bold: true,
        italics: true,
      },
      {
        text: ` ${documentTitle} ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit_name?.name || unitDetails?.name || "Διεύθυνση"}`,
        italics: true,
      },
    ];
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 4 },
        left: { style: BorderStyle.SINGLE, size: 4 },
        right: { style: BorderStyle.SINGLE, size: 4 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4 },
                bottom: { style: BorderStyle.SINGLE, size: 4 },
                left: { style: BorderStyle.SINGLE, size: 4 },
                right: { style: BorderStyle.SINGLE, size: 4 },
              },
              margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50,
              },
              width: { size: 100, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: subjectText.map(
                    (part) =>
                      new TextRun({
                        text: part.text,
                        bold: part.bold,
                        italics: part.italics,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE,
                        font: DocumentUtilities.DEFAULT_FONT,
                      }),
                  ),
                  spacing: { after: 0 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  // ========================================
  // 4. LEGAL REFERENCES
  // ========================================

  /**
   * Create legal references section
   */
  private static createLegalReferences(): Paragraph[] {
    const legalParagraphs: Paragraph[] = [];

    // Add spacing before legal references
    legalParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { after: 180 },
      }),
    );

    legalParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Έχοντας υπόψη:",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 60 },
      }),
    );

    const legalRefs = [
      "Τις διατάξεις του Ν. 4249/2014 (ΦΕΚ 73/Α΄) «Αναδιοργάνωση της Γενικής Γραμματείας Πολιτικής Προστασίας, ρύθμιση θεμάτων αποζημίωσης αδικημάτων κλπ» όπως ισχύει.",
    ];

    legalRefs.forEach((ref) => {
      legalParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: ref,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
    });

    return legalParagraphs;
  }

  // ========================================
  // 5. MAIN CONTENT
  // ========================================

  /**
   * Create main content section
   */
  private static createMainContent(documentData: DocumentData): Paragraph[] {
    const contentParagraphs: Paragraph[] = [];

    // Main request text based on expenditure type
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const mainText = config.mainText;

    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: mainText,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 0 },
      }),
    );

    return contentParagraphs;
  }

  // ========================================
  // 6. PROJECT INFORMATION
  // ========================================

  /**
   * Create project information section
   */
  private static createProjectInfo(documentData: DocumentData): Paragraph[] {
    const projectParagraphs: Paragraph[] = [];

    // Add spacing before project info
    projectParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { after: 140 },
      }),
    );

    // Project Information
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Τα στοιχεία του έργου είναι:",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 60 },
      }),
    );

    // Project name
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Έργο: ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
            bold: true,
          }),
          new TextRun({
            text: documentData.project_name || "ΑΠΟΚΑΤΑΣΤΑΣΗ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 40 },
      }),
    );

    // Project MIS
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΜΙΣ: ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
            bold: true,
          }),
          new TextRun({
            text: documentData.mis || "___________",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 40 },
      }),
    );

    // Code A.E.
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Κωδ. Α.Ε.: ",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
            bold: true,
          }),
          new TextRun({
            text: documentData.ae_code || "5328050001",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 40 },
      }),
    );

    // Code KAE
    if (documentData.kae_code) {
      projectParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Κωδ. ΚΑΕ: ",
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
              bold: true,
            }),
            new TextRun({
              text: documentData.kae_code,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
    }

    // Contract number
    if (documentData.contract_number) {
      projectParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Αρ. Σύμβασης: ",
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
              bold: true,
            }),
            new TextRun({
              text: documentData.contract_number,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
    }

    return projectParagraphs;
  }

  // ========================================
  // 7. PAYMENT TABLE
  // ========================================

  /**
   * Create payment table with expenditure type specific columns
   */
  private static createPaymentTable(
    recipients: any[],
    expenditureType: string,
  ): Table {
    // Get columns from centralized configuration
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const columns = config.columns;
    const borderStyle = BorderStyle.SINGLE;

    const headerCells = columns.map(
      (column) =>
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(column, {
              bold: false,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
    );

    const rows = [new TableRow({ children: headerCells, tableHeader: true })];

    let totalAmount = 0;

    recipients.forEach((recipient, index) => {
      // Check if fathername exists and is not empty
      const firstname = recipient.firstname || "";
      const lastname = recipient.lastname || "";
      const fathername = recipient.fathername || "";

      // Check if fathername exists and is not empty
      const fullName =
        !fathername || fathername.trim() === ""
          ? `${lastname} ${firstname}`.trim()
          : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();
      const afm = recipient.afm || "";
      const rowNumber = (index + 1).toString() + ".";
      let installments: string[] = [];
      if (
        Array.isArray(recipient.installments) &&
        recipient.installments.length > 0
      ) {
        installments = recipient.installments;
      } else if (recipient.installment) {
        installments = [recipient.installment.toString()];
      } else {
        installments = ["ΕΦΑΠΑΞ"];
      }

      // Get installment amounts if available
      const installmentAmounts = recipient.installmentAmounts || {};

      // If there's only one installment, create a simple row
      if (installments.length === 1) {
        const installment = installments[0];
        const amount = installmentAmounts[installment] || recipient.amount;
        totalAmount += amount;

        // Create table cells according to expenditure type configuration
        // Correct order: Α/Α, ΟΝΟΜΑΤΕΠΩΝΥΜΟ, Α.Φ.Μ., ΔΟΣΗ/ΗΜΕΡΕΣ/ΜΗΝΕΣ, ΠΟΣΟ (€)
        const cells = [
          // Index/Number column (Α/Α)
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(rowNumber, {
                size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              }),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
          // Name column (ΟΝΟΜΑΤΕΠΩΝΥΜΟ)
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(fullName, {
                size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              }),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
          // AFM column (Α.Φ.Μ.)
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(afm, {
                size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              }),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        ];

        // Add expenditure-specific column based on type (ΔΟΣΗ/ΗΜΕΡΕΣ/ΜΗΝΕΣ)
        if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ") {
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(
                  recipient.days?.toString() || "1",
                  {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                  },
                ),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );
        } else if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(
                  recipient.months?.toString() || "1",
                  {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                  },
                ),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );
        } else {
          // For ΔΚΑ types, add installment column (ΔΟΣΗ)
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(installment, {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                }),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );
        }

        // Add amount column at the end (ΠΟΣΟ (€))
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                DocumentUtilities.formatCurrency(amount),
                {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                },
              ),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        );

        rows.push(new TableRow({ children: cells }));
      } else {
        // For multiple installments, use row spanning
        const rowSpan = installments.length;
        const rowHeight = 360; // Base height for one row

        // Create cells for the first row with rowSpan
        const nameCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            DocumentUtilities.createCenteredParagraph(fullName, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });

        const afmCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            DocumentUtilities.createCenteredParagraph(afm, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });

        const numberCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            DocumentUtilities.createCenteredParagraph(rowNumber, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });

        // Create rows for each installment
        installments.forEach((installment, instIndex) => {
          const amount = installmentAmounts[installment] || recipient.amount;
          totalAmount += amount;

          const cells = [];

          // Add basic cells only for the first row
          if (instIndex === 0) {
            cells.push(numberCell, nameCell, afmCell);
          }

          // Add expenditure-specific column based on type
          if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ") {
            cells.push(
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph(
                    recipient.days?.toString() || "1",
                    {
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                    },
                  ),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
            );
          } else if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
            cells.push(
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph(
                    recipient.months?.toString() || "1",
                    {
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                    },
                  ),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
            );
          } else {
            // For ΔΚΑ types, add installment column
            cells.push(
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph(installment, {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                  }),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
            );
          }

          // Add amount column
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(
                  DocumentUtilities.formatCurrency(amount),
                  {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                  },
                ),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );

          const row = new TableRow({
            children: cells,
            height: { value: rowHeight, rule: HeightRule.EXACT },
          });

          rows.push(row);
        });
      }
    });

    // Total row
    const totalCells = columns.map((column, colIndex) => {
      if (column === "Α/Α") {
        return new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph("", {
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });
      } else if (column === "ΠΟΣΟ (€)") {
        return new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(
              `ΣΥΝΟΛΟ: ${DocumentUtilities.formatCurrency(totalAmount)}`,
              {
                bold: true,
                size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              },
            ),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });
      } else if (colIndex === columns.length - 2) {
        // Second to last column gets the "ΣΥΝΟΛΟ:" text
        return new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph("ΣΥΝΟΛΟ:", {
              bold: true,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });
      } else {
        return new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph("", {
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });
      }
    });

    rows.push(new TableRow({ children: totalCells }));

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: borderStyle, size: 1 },
        bottom: { style: borderStyle, size: 1 },
        left: { style: borderStyle, size: 1 },
        right: { style: borderStyle, size: 1 },
        insideHorizontal: { style: borderStyle, size: 1 },
        insideVertical: { style: borderStyle, size: 1 },
      },
    });
  }

  // ========================================
  // 8. FINAL REQUEST
  // ========================================

  /**
   * Create final request paragraph
   */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε για την έγκριση της ανωτέρω δαπάνης και τη χορήγηση της σχετικής πίστωσης.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      spacing: { after: 200, before: 200 },
    });
  }

  // ========================================
  // 9. FOOTER COMPONENTS
  // ========================================

  /**
   * Create document footer with attachments and signature
   */
  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const attachmentsList = [
      "• Σχετικές αιτήσεις των δικαιούχων",
      "• Κατάλογος δικαιούχων",
      "• Στοιχεία ταυτοποίησης δικαιούχων",
      "• Στοιχεία τραπεζικών λογαριασμών",
    ];

    const distributionList = [
      "• ΥΠ. ΕΣΩΤΕΡΙΚΩΝ / Γ.Γ. ΟΙΚΟΝΟΜΙΚΩΝ ΥΠΗΡΕΣΙΩΝ / Δ/ΝΣΗ ΔΗΜΟΣΙΟΝΟΜΙΚΗΣ ΠΟΛΙΤΙΚΗΣ / ΤΜΗΜΑ Α΄",
      "• Αρχείο",
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      columnWidths: [3000, 3000],
      rows: [
        new TableRow({
          children: [
            // Left cell with attachments
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΣΥΝΗΜΜΕΝΑ:",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                      bold: true,
                    }),
                  ],
                  spacing: { after: 40 },
                }),
                ...attachmentsList.map(
                  (attachment) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: attachment,
                          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                          font: DocumentUtilities.DEFAULT_FONT,
                        }),
                      ],
                      spacing: { after: 20 },
                    }),
                ),
                new Paragraph({
                  children: [new TextRun({ text: "" })],
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΚΟΙΝΟΠΟΙΗΣΗ:",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                      bold: true,
                    }),
                  ],
                  spacing: { after: 40 },
                }),
                ...distributionList.map(
                  (item) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item,
                          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                          font: DocumentUtilities.DEFAULT_FONT,
                        }),
                      ],
                      spacing: { after: 20 },
                    }),
                ),
              ],
            }),
            // Right cell with signature
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Ο ΔΙΕΥΘΥΝΤΗΣ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 400 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: documentData.director_name || "ΟΝΟΜΑΤΕΠΩΝΥΜΟ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: documentData.director_title || "ΤΙΤΛΟΣ",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 40 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }
}