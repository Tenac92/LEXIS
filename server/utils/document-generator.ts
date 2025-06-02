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
  VerticalAlign
} from "docx";
import { DocumentUtilities } from "./document-utilities";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentGenerator");

// Expenditure type configurations
const EXPENDITURE_CONFIGS = {
  "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ": {
    documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΕΠΙΔΟΤΗΣΗΣ ΕΝΟΙΚΙΟΥ",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΜΗΝΕΣ", "ΠΟΣΟ (€)"],
    mainText: "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την επιδότηση ενοικίου για τους κατωτέρω δικαιούχους:"
  },
  "ΕΚΤΟΣ ΕΔΡΑΣ": {
    documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΑΠΟΖΗΜΙΩΣΗΣ ΕΚΤΟΣ ΕΔΡΑΣ",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΗΜΕΡΕΣ", "ΠΟΣΟ (€)"],
    mainText: "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την αποζημίωση εκτός έδρας για τους κατωτέρω υπαλλήλους:"
  },
  "ΔΚΑ ΕΠΙΣΚΕΥΗ": {
    documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΔΟΣΗΣ ΔΑΝΕΙΟΥ",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText: "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε τη δόση του δανείου για τους κατωτέρω δικαιούχους:"
  },
  "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ": {
    documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΔΟΣΗΣ ΔΑΝΕΙΟΥ",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText: "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε τη δόση του δανείου για τους κατωτέρω δικαιούχους:"
  }
};

export class DocumentGenerator {
  
  /**
   * Generate primary document
   */
  public static async generatePrimaryDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);
      
      // Get unit details
      const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
      
      // Create document sections
      const children: any[] = [
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
        this.createPaymentTable(documentData.recipients || [], documentData.expenditure_type),
        
        // Final request
        DocumentGenerator.createFinalRequest(),
        
        // Attachments
        ...DocumentGenerator.createAttachments(documentData),
        
        // Distribution lists
        ...DocumentGenerator.createDistributionLists(),
        
        // Footer
        this.createFooter(documentData, unitDetails),
      ];

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: DocumentUtilities.DOCUMENT_MARGINS,
            },
          },
          children,
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

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }

  /**
   * Create document header with proper Greek government format
   */
  private static createHeader(unitDetails: UnitDetails | null): Paragraph[] {
    const headerParagraphs: Paragraph[] = [];
    
    // Greek Republic header
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ",
        { bold: true, size: 24, spacing: 120 }
      )
    );
    
    headerParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    // Ministry header
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
        { bold: true, size: 22, spacing: 120 }
      )
    );
    
    headerParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    // General Secretariat
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
        { bold: true, size: 20, spacing: 120 }
      )
    );
    
    headerParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    // General Directorate
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ.",
        { bold: true, size: 20, spacing: 120 }
      )
    );
    
    headerParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    // Directorate
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
        { bold: true, size: 18, spacing: 120 }
      )
    );
    
    headerParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    // Department
    headerParagraphs.push(
      DocumentUtilities.createCenteredParagraph(
        "ΤΜΗΜΑ ΕΠΟΠΤΕΙΑΣ ΚΑΙ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ",
        { bold: true, size: 16, spacing: 240 }
      )
    );
    
    return headerParagraphs;
  }

  /**
   * Create contact information section
   */
  private static createContactInfo(documentData: DocumentData): Paragraph[] {
    const contactParagraphs: Paragraph[] = [];
    
    contactParagraphs.push(DocumentUtilities.createBlankLine(240));
    
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
        spacing: { after: 120 },
      })
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
        spacing: { after: 120 },
      })
    );
    
    const contactPerson = documentData.generated_by?.name || documentData.user_name || "Υπάλληλος";
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
        spacing: { after: 120 },
      })
    );
    
    const telephone = documentData.generated_by?.telephone || documentData.contact_number || "2131331391";
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
        spacing: { after: 120 },
      })
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
        spacing: { after: 360 },
      })
    );
    
    return contactParagraphs;
  }

  /**
   * Create recipient section
   */
  private static createRecipientSection(): Paragraph[] {
    const recipientParagraphs: Paragraph[] = [];
    
    recipientParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΠΡΟΣ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    const recipientLines = [
      "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
      "Διεύθυνση Οικονομικής Διαχείρισης",
      "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
      "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
      "Δημοκρίτου 2",
      "151 23 Μαρούσι"
    ];
    
    recipientLines.forEach(line => {
      recipientParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 60 },
        })
      );
    });
    
    recipientParagraphs.push(DocumentUtilities.createBlankLine(240));
    
    return recipientParagraphs;
  }

  /**
   * Create date and protocol section
   */
  private static createDateAndProtocol(documentData: DocumentData): Paragraph {
    const protocolText = documentData.protocol_number_input 
      ? `Αρ. Πρωτ.: ${documentData.protocol_number_input}`
      : "Αρ. Πρωτ.: ___________";
    
    const dateText = documentData.protocol_date 
      ? `Ημερομηνία: ${new Date(documentData.protocol_date).toLocaleDateString('el-GR')}`
      : `Ημερομηνία: ${new Date().toLocaleDateString('el-GR')}`;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: `${protocolText}               ${dateText}`,
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
    });
  }

  /**
   * Create document subject with bordered table
   */
  private static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const subjectText = [
      {
        text: "ΘΕΜΑ:",
        bold: true,
        italics: true,
      },
      {
        text: ` Αίτημα για την πληρωμή ${documentData.expenditure_type || "ΔΑΠΑΝΗ"} που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit || "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ (ΔΑΕΦΚ-ΚΕ)"}`,
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
                  spacing: { after: 240 },
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
    
    // Project information
    if (documentData.project_na853) {
      contentParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Έργο: ${documentData.project_na853}`,
              bold: true,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
    
    if (documentData.project_id) {
      contentParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `ΜΙΣ: ${documentData.project_id}`,
              bold: true,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 240 },
        })
      );
    }
    
    // Main request text based on expenditure type
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = EXPENDITURE_CONFIGS[expenditureType] || {};
    const mainText = config.mainText || "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την παρακάτω δαπάνη για τους κατωτέρω δικαιούχους:";
    
    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: mainText,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 240 },
      })
    );
    
    return contentParagraphs;
  }

  /**
   * Create payment table with expenditure type specific columns
   */
  private static createPaymentTable(recipients: any[], expenditureType: string): Table {
    // Exact columns from template
    const columns = ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΔΟΣΗ", "ΠΟΣΟ (€)"];
    const borderStyle = BorderStyle.SINGLE;
    
    const headerCells = columns.map(column => 
      new TableCell({
        children: [DocumentUtilities.createCenteredParagraph(column, { 
          bold: false, 
          size: DocumentUtilities.DEFAULT_FONT_SIZE 
        })],
        borders: {
          top: { style: borderStyle, size: 1 },
          bottom: { style: borderStyle, size: 1 },
          left: { style: borderStyle, size: 1 },
          right: { style: borderStyle, size: 1 },
        },
      })
    );

    const rows = [new TableRow({ children: headerCells, tableHeader: true })];

    let totalAmount = 0;

    recipients.forEach((recipient, index) => {
      const amount = recipient.amount || 0;
      totalAmount += amount;
      
      const cells = [
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(`${index + 1}.`, { 
            size: DocumentUtilities.DEFAULT_FONT_SIZE 
          })],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(
            `${recipient.firstname} ${recipient.lastname}`, { 
              size: DocumentUtilities.DEFAULT_FONT_SIZE 
            }
          )],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(recipient.afm, { 
            size: DocumentUtilities.DEFAULT_FONT_SIZE 
          })],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(
            recipient.installment?.toString() || "Α", { 
              size: DocumentUtilities.DEFAULT_FONT_SIZE 
            }
          )],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(
            DocumentUtilities.formatCurrency(amount), { 
              size: DocumentUtilities.DEFAULT_FONT_SIZE 
            }
          )],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
      ];
      rows.push(new TableRow({ children: cells }));
    });

    // Add total row
    const totalCells = [
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        children: [new Paragraph({ text: "" })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        children: [DocumentUtilities.createCenteredParagraph("ΣΥΝΟΛΟ:", { 
          bold: true, 
          size: DocumentUtilities.DEFAULT_FONT_SIZE 
        })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        children: [DocumentUtilities.createCenteredParagraph(
          `${DocumentUtilities.formatCurrency(totalAmount)} €`, { 
            bold: true, 
            size: DocumentUtilities.DEFAULT_FONT_SIZE 
          }
        )],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
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
      spacing: { before: 120, after: 0 },
    });
  }

  /**
   * Create footer with signature
   */
  private static createFooter(documentData: DocumentData, unitDetails: UnitDetails | null): Table {
    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    // Left column content (attachments, notifications, etc.)
    const leftColumnParagraphs: Paragraph[] = [];

    // Add ΕΓΚΡΙΣΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΓΚΡΙΣΗ:",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 120 },
      })
    );
    
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Εγκρίνεται",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Add ΣΥΝΗΜΜΕΝΑ section if attachments exist
    if (attachments.length > 0) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
              bold: true,
              underline: {},
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { after: 120, before: 240 },
        })
      );

      for (let i = 0; i < attachments.length; i++) {
        leftColumnParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${i + 1}. ${attachments[i]}`,
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
                font: DocumentUtilities.DEFAULT_FONT,
              }),
            ],
            indent: { left: 426 },
            spacing: { after: 120 },
          })
        );
      }
    }

    // Add ΚΟΙΝΟΠΟΙΗΣΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 120, before: 240 },
      })
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
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
          spacing: { after: 120 },
        })
      );
    }

    // Add ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 120, before: 240 },
      })
    );

    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        indent: { left: 426 },
        spacing: { after: 120 },
      })
    );

    // Right column - signature section matching header format
    const rightColumnParagraphs: Paragraph[] = [];

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.manager?.order || "",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
      })
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.manager?.title || "",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      })
    );

    // Signature space
    rightColumnParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { before: 160, after: 160 },
      })
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.manager?.name || "",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      })
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.manager?.degree || "",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );

    // Create two-column table matching header format
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
    
    legalParagraphs.push(DocumentUtilities.createBlankLine(240));
    
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
        spacing: { after: 240 },
      })
    );
    
    return legalParagraphs;
  }

  /**
   * Create project information section
   */
  private static createProjectInfo(documentData: DocumentData): Paragraph[] {
    const projectParagraphs: Paragraph[] = [];
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΑΡ. ΕΡΓΟΥ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${documentData.project_na853 || '2024ΝΑ85300000'} της ΣΑΝΑ 853`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΑΛΕ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΤΟΜΕΑΣ:",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    projectParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      })
    );
    
    return projectParagraphs;
  }

  /**
   * Create final request paragraph
   */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 240 },
    });
  }

  /**
   * Create attachments section
   */
  private static createAttachments(documentData: DocumentData): Paragraph[] {
    const attachmentParagraphs: Paragraph[] = [];
    
    attachmentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    const attachments = documentData.attachments || ["Οι εκδοθείσες εγκρίσεις ΣΣ"];
    attachments.forEach((attachment, index) => {
      attachmentParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${attachment}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
        })
      );
    });
    
    return attachmentParagraphs;
  }

  /**
   * Create distribution lists section
   */
  private static createDistributionLists(): Paragraph[] {
    const distributionParagraphs: Paragraph[] = [];
    
    distributionParagraphs.push(DocumentUtilities.createBlankLine(240));
    
    distributionParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    const distributionList = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ."
    ];
    
    distributionList.forEach((item, index) => {
      distributionParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${item}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
        })
      );
    });
    
    distributionParagraphs.push(DocumentUtilities.createBlankLine(120));
    
    distributionParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      })
    );
    
    distributionParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      })
    );
    
    return distributionParagraphs;
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
      department: documentData.generated_by?.department || documentData.department || "",
      contact_number: documentData.generated_by?.telephone?.toString() || documentData.contact_number?.toString() || "",
    };

    // Use unitDetails.address if available
    const address = unitDetails?.address || {
      address: "Δημοκρίτου 2",
      tk: "11523",
      region: "Μαρούσι",
    };

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
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ.",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΤΜΗΜΑ ΕΠΟΠΤΕΙΑΣ ΚΑΙ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 240 },
                }),
                // Contact information
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Ταχ. Δ/νση: ${address.address}`,
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
                      text: `Ταχ. Κώδικας: ${address.tk}, ${address.region}`,
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
                      text: `Πληροφορίες: ${userInfo.name}`,
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
                      text: `Τηλέφωνο: ${userInfo.contact_number}`,
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
                      text: "Email: daefkke@civilprotection.gr",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 360 },
                }),
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
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΠΡΟΣ:",
                      bold: true,
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 2000, after: 120 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
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
                      text: "Διεύθυνση Οικονομικής Διαχείρισης",
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
                      text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
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
                      text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
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
                      text: "Δημοκρίτου 2",
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
                      text: "151 23 Μαρούσι",
                      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                      font: DocumentUtilities.DEFAULT_FONT,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 240 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }
}