/**
 * Document Generator - Complete document generation functionality
 * Single file for all Greek government document generation with expenditure type handling
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
  /**
   * Generate primary document
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

      // Create document sections
      const children: any[] = [
        // Logo at the top of the document - smaller size for Word compatibility
        new Paragraph({
          children: [
            new ImageRun({
              data: fs.readFileSync(path.join(__dirname, "ethnosimo22.png")),
              transformation: {
                width: 60,
                height: 60,
              },
            } as any),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
        }),

        // Header with two-column layout (includes contact info and recipient section)
        await this.createDocumentHeader(documentData, unitDetails),

        // Subject
        this.createDocumentSubject(documentData, unitDetails),

        // Legal references
        ...DocumentGenerator.createLegalReferences(),

        // Main request text
        ...this.createMainContent(documentData),

        // Project information
        ...DocumentGenerator.createProjectInfo(documentData),

        // Payment table
        this.createPaymentTable(
          documentData.recipients || [],
          documentData.expenditure_type,
        ),

        // Final request
        DocumentGenerator.createFinalRequest(),

        // Note: Attachments and distribution lists are handled in the footer

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
   * Create recipient information (now integrated into header)
   */
  private static createRecipientInfo(): Paragraph[] {
    const recipientParagraphs: Paragraph[] = [];
    return recipientParagraphs;
  }

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
      const amount = recipient.amount || 0;
      totalAmount += amount;

      // Create standard cells for most expenditure types
      const cells = [
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(`${index + 1}.`, {
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
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(
              `${recipient.firstname} ${recipient.lastname}`,
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
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(recipient.afm || "", {
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
        // Default to installment for ΔΚΑ types
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                recipient.installment?.toString() || "Α",
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

      rows.push(new TableRow({ children: cells }));
    });

    // Add total row
    const totalCells = [
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
      }),
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
      }),
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
      }),
      new TableCell({
        children: [
          DocumentUtilities.createCenteredParagraph("ΣΥΝΟΛΟ:", {
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          }),
        ],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
      }),
      new TableCell({
        children: [
          DocumentUtilities.createCenteredParagraph(
            `${DocumentUtilities.formatCurrency(totalAmount)} €`,
            {
              bold: true,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            },
          ),
        ],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
      }),
    ];
    rows.push(new TableRow({ children: totalCells }));

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }

  /**
   * Create note paragraph
   */
  private static createNote(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      spacing: { before: 0, after: 0 },
    });
  }

  /**
   * Create footer with signature
   */
  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null,
  ): Table {
    // Left column - attachments, notifications, and internal distribution
    const leftColumnParagraphs: Paragraph[] = [];

    // Add ΣΥΝΗΜΜΕΝΑ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    for (let i = 0; i < attachments.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${attachments[i]}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      );
    }

    leftColumnParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: "" })] }),
    );

    // Add ΚΟΙΝΟΠΟΙΗΣΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    const notifications = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ];

    for (let i = 0; i < notifications.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${notifications[i]}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      );
    }

    leftColumnParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: "" })] }),
    );

    // Add ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        indent: { left: 426 },
      }),
    );

    // Right column - use centralized signature utility
    const rightColumnParagraphs =
      DocumentUtilities.createManagerSignatureParagraphs(unitDetails?.manager);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [7000, 4000],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: leftColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
              margins: { right: 300 },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: rightColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
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
    const legalParagraphs: Paragraph[] = [];

    legalParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε.",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 0 },
      }),
    );

    return legalParagraphs;
  }

  /**
   * Create project information section using table layout
   */
  private static createProjectInfo(
    documentData: DocumentData,
  ): (Table | Paragraph)[] {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [20, 80],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΑΡ. ΕΡΓΟΥ: ",
                        bold: true,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${documentData.project_na853 || ""} της ΣΑΝΑ 853`,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΑΛΕ: ",
                        bold: true,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΤΟΜΕΑΣ: ",
                        bold: true,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
                        size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: "" })],
      }),
    ];
  }

  /**
   * Create final request paragraph
   */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 0 },
    });
  }

  /**
   * Create document header with two-column layout (matches template exactly)
   */
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) {
      throw new Error("Document data is required");
    }

    // Extract user information with fallbacks
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      contact_number:
        documentData.generated_by?.telephone?.toString() ||
        documentData.contact_number?.toString() ||
        "",
    };

    // Use unitDetails.address if available
    const address = unitDetails?.address || {
      address: "Δημοκρίτου 2",
      tk: "11523",
      region: "Μαρούσι",
    };

    // Load logo buffer (you may need to implement this)
    const logoBuffer = Buffer.from(""); // Placeholder for logo

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [60, 40],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      rows: [
        new TableRow({
          children: [
            // Ministry information column
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              children: [
                DocumentUtilities.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                DocumentUtilities.createBoldParagraph(
                  "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                ),
                DocumentUtilities.createBoldParagraph(
                  "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
                ),
                DocumentUtilities.createBoldParagraph("ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ."),
                DocumentUtilities.createBoldParagraph(
                  unitDetails?.unit_name?.name || unitDetails?.name || "",
                ),
                DocumentUtilities.createBoldParagraph(userInfo.department),
                DocumentUtilities.createBlankLine(10),
                DocumentUtilities.createContactDetail(
                  "Ταχ. Δ/νση",
                  address.address,
                ),
                DocumentUtilities.createContactDetail(
                  "Ταχ. Κώδικας",
                  `${address.tk}, ${address.region}`,
                ),
                DocumentUtilities.createContactDetail(
                  "Πληροφορίες",
                  userInfo.name,
                ),
                DocumentUtilities.createContactDetail(
                  "Τηλέφωνο",
                  userInfo.contact_number,
                ),
                DocumentUtilities.createContactDetail(
                  "Email",
                  unitDetails?.email || "",
                ),
                DocumentUtilities.createBlankLine(10),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΠΡΟΣ:",
                      bold: true,
                      size: 20,
                    }),
                  ],
                  spacing: { before: 2000 },
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
                      size: 20,
                    }),
                  ],
                  spacing: { before: 200 },
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Διεύθυνση Οικονομικής Διαχείρισης",
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Δημοκρίτου 2",
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "151 23 Μαρούσι",
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }
}
