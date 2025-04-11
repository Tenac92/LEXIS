/**
 * Document Formatter Class
 * Responsible for generating standardized document content using templates
 * 
 * This service handles the complex process of creating professional-looking
 * documents with proper formatting, tables, and dynamic content insertion.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  VerticalAlign,
  HeadingLevel,
  TableAnchorType,
  TableLayoutType,
  PageOrientation,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Footer,
  Header,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  ImageRun,
  Tab,
  TabStopPosition,
  TabStopType,
} from "docx";

import path from "path";
import fs from "fs";
// Import greek-utils for special character handling
import JSZip from "jszip";

// Helper function for creating table cell borders
function getBorders(borderSize = 1) {
  return {
    top: { style: BorderStyle.SINGLE, size: borderSize, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: borderSize, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: borderSize, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: borderSize, color: "000000" },
  };
}

// Define common text styles
const TEXT_STYLES = {
  default: {
    size: 11 * 2,
    font: "Calibri",
    bold: false,
  },
  heading: {
    size: 14 * 2,
    font: "Calibri",
    bold: true,
  },
  bold: {
    size: 11 * 2,
    font: "Calibri",
    bold: true,
  },
  footer: {
    size: 8 * 2,
    font: "Calibri",
    italic: true,
  },
};

// Define common margin settings
const MARGINS = {
  top: convertMillimetersToTwip(10),
  bottom: convertMillimetersToTwip(20),
  left: convertMillimetersToTwip(30),
  right: convertMillimetersToTwip(20),
};

// Create custom tab stops for forms and alignments
const TAB_STOPS = {
  form: [
    {
      type: TabStopType.RIGHT,
      position: TabStopPosition.MAX / 2,
    },
  ],
  signature: [
    {
      type: TabStopType.RIGHT,
      position: convertMillimetersToTwip(160),
    },
  ],
};

// Constants for document formatting
const DATE_FORMAT_OPTIONS = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

// Column widths for recipient table (in %)
const RECIPIENT_TABLE_WIDTHS = [5, 35, 20, 40];
const SIGNATURES_TABLE_WIDTHS = [60, 40];

/**
 * Document Formatter class provides utilities for generating standardized documents
 * using templates and consistent formatting rules
 */
export class DocumentFormatter {
  // Optional logo for document header
  private logo: Buffer | null = null;
  private logoDimensions = { width: 180, height: 50 }; // Default logo dimensions

  /**
   * Constructor with optional logo path
   * @param logoPath Optional path to organization logo
   */
  constructor(logoPath?: string) {
    if (logoPath && fs.existsSync(logoPath)) {
      this.logo = fs.readFileSync(logoPath);
    }
  }

  /**
   * Set the logo and its dimensions
   * @param logoBuffer The logo as a Buffer
   * @param width Logo width
   * @param height Logo height
   */
  setLogo(logoBuffer: Buffer, width: number = 180, height: number = 50): void {
    this.logo = logoBuffer;
    this.logoDimensions = { width, height };
  }

  /**
   * Format currency values in Euros with proper separators
   * @param amount Number to format as currency
   * @returns Formatted currency string
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format date in Greek format
   * @param date Date to format
   * @returns Formatted date string
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString("el-GR", DATE_FORMAT_OPTIONS);
  }

  /**
   * Create a standard document with header, footer and proper margins
   * @param title Document title
   * @param children Document content elements
   * @returns Document object ready for export
   */
  createStandardDocument(
    title: string,
    children: any[],
    options: {
      landscape?: boolean;
      watermark?: string;
      footer?: string;
    } = {}
  ): Document {
    const docOptions: any = {
      title,
      creator: "ΔΙΑΧΕΙΡΙΣΗ ΕΠΙΔΟΤΗΣΕΩΝ ΟΙΚΟΝΟΜΙΚΩΝ ΥΠΟΘΕΣΕΩΝ",
      description: "Έγγραφο που δημιουργήθηκε από την υπηρεσία διαχείρισης επιδοτήσεων",
      externalStyles: [],
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: options.landscape
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
              },
              margin: MARGINS,
            },
          },
          headers: {
            default: this.createHeader(title),
          },
          footers: {
            default: this.createFooter(options.footer),
          },
          children,
        },
      ],
    };

    // Add watermark if specified
    if (options.watermark) {
      // docOptions.background = this.createWatermark(options.watermark);
    }

    return new Document(docOptions);
  }

  /**
   * Create a standard header with logo and title
   * @param title Document title
   * @returns Header object
   */
  private createHeader(title: string): Header {
    const headerElements = [];

    // Create a table for the header to properly align logo and title
    const headerTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
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
            // Logo cell (if logo exists)
            new TableCell({
              width: {
                size: 20,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: this.logo
                ? [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: this.logo,
                          transformation: {
                            width: this.logoDimensions.width,
                            height: this.logoDimensions.height,
                          },
                        }),
                      ],
                    }),
                  ]
                : [new Paragraph("")],
            }),
            // Title cell
            new TableCell({
              width: {
                size: 80,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  text:
                    "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ\nΥΠΟΥΡΓΕΙΟ ΕΣΩΤΕΡΙΚΩΝ\nΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΕΣΩΤΕΡΙΚΩΝ ΚΑΙ ΟΡΓΑΝΩΣΗΣ\nΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΟΙΚΟΝΟΜΙΚΩΝ Τ.Α.\nΚΑΙ ΑΝΑΠΤΥΞΙΑΚΗΣ ΠΟΛΙΤΙΚΗΣ\nΔΙΕΥΘΥΝΣΗ ΟΙΚΟΝΟΜΙΚΗΣ ΚΑΙ\nΑΝΑΠΤΥΞΙΑΚΗΣ ΠΟΛΙΤΙΚΗΣ\nΤΜΗΜΑ ΕΠΙΧΟΡΗΓΗΣΕΩΝ Τ.Α.",
                  alignment: AlignmentType.LEFT,
                  style: "heading",
                  spacing: {
                    after: 200,
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    headerElements.push(headerTable);

    // Add date and protocol number placeholders
    headerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "                                                                ",
            bold: true,
            font: "Calibri",
            size: 20,
          }),
          new TextRun({
            text: "Αθήνα,",
            bold: true,
            font: "Calibri",
            size: 20,
          }),
          new TextRun({
            text: "                 ",
            bold: false,
            font: "Calibri",
            size: 20,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          after: 200,
        },
      })
    );

    headerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "                                                                ",
            bold: true,
            font: "Calibri",
            size: 20,
          }),
          new TextRun({
            text: "Αρ. Πρωτ.:",
            bold: true,
            font: "Calibri",
            size: 20,
          }),
          new TextRun({
            text: "                 ",
            bold: false,
            font: "Calibri",
            size: 20,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          after: 200,
        },
      })
    );

    headerElements.push(
      new Paragraph({
        text: "",
        spacing: {
          after: 200,
        },
      })
    );

    // Add a horizontal line separator
    headerElements.push(
      new Paragraph({
        text: "",
        border: {
          bottom: {
            color: "999999",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: {
          after: 400,
        },
      })
    );

    // Add title if provided
    if (title) {
      headerElements.push(
        new Paragraph({
          text: title,
          style: "heading",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
          },
        })
      );
    }

    return new Header({
      children: headerElements,
    });
  }

  /**
   * Create a standard footer with optional text
   * @param footerText Optional text to include in footer
   * @returns Footer object
   */
  private createFooter(footerText?: string): Footer {
    const footerElements = [];

    // Add a horizontal line
    footerElements.push(
      new Paragraph({
        text: "",
        border: {
          top: {
            color: "999999",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: {
          before: 200,
          after: 200,
        },
      })
    );

    // Add standard contact information
    footerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Διεύθυνση: Σταδίου 27, 10183 Αθήνα - Τηλ.: 213-1364718\nEmail: d.oikonomiki.an.politiki@ypes.gr",
            ...TEXT_STYLES.footer,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 100,
        },
      })
    );

    // Add custom footer text if provided
    if (footerText) {
      footerElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: footerText,
              ...TEXT_STYLES.footer,
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    }

    return new Footer({
      children: footerElements,
    });
  }

  /**
   * Create a standard signature block
   * @param signatory Name/title of the signatory
   * @param role Role of the signatory
   * @returns Paragraph objects for the signature
   */
  createSignatureBlock(signatory: string, role: string): Paragraph[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Ο ",
            ...TEXT_STYLES.default,
          }),
          new TextRun({
            text: role,
            ...TEXT_STYLES.bold,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 500,
          after: 1000, // Space for signature
        },
      }),
      new Paragraph({
        text: signatory,
        alignment: AlignmentType.CENTER,
        style: "strong",
        spacing: {
          after: 500,
        },
      }),
    ];
  }

  /**
   * Create a table of recipients with standardized formatting
   * @param recipients Array of recipient objects
   * @returns Table object
   */
  createRecipientsTable(recipients: any[]): Table {
    const tableRows = [];

    // Create header row
    tableRows.push(
      new TableRow({
        tableHeader: true,
        height: {
          value: 400,
        },
        children: [
          new TableCell({
            width: { size: RECIPIENT_TABLE_WIDTHS[0], type: WidthType.PERCENTAGE },
            shading: {
              fill: "CCCCCC",
            },
            borders: getBorders(1),
            children: [
              new Paragraph({
                text: "Α/Α",
                alignment: AlignmentType.CENTER,
                ...TEXT_STYLES.bold,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: RECIPIENT_TABLE_WIDTHS[1], type: WidthType.PERCENTAGE },
            shading: {
              fill: "CCCCCC",
            },
            borders: getBorders(1),
            children: [
              new Paragraph({
                text: "ONOMATEΠΩΝΥΜΟ",
                alignment: AlignmentType.CENTER,
                ...TEXT_STYLES.bold,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: RECIPIENT_TABLE_WIDTHS[2], type: WidthType.PERCENTAGE },
            shading: {
              fill: "CCCCCC",
            },
            borders: getBorders(1),
            children: [
              new Paragraph({
                text: "Α.Φ.Μ.",
                alignment: AlignmentType.CENTER,
                ...TEXT_STYLES.bold,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: RECIPIENT_TABLE_WIDTHS[3], type: WidthType.PERCENTAGE },
            shading: {
              fill: "CCCCCC",
            },
            borders: getBorders(1),
            children: [
              new Paragraph({
                text: "ΠΟΣΟ",
                alignment: AlignmentType.CENTER,
                ...TEXT_STYLES.bold,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      })
    );

    // Process each recipient
    recipients.forEach((recipient, index) => {
      // Only add ΤΟΥ if fathername exists and is not empty
      const fullName = recipient.fathername && recipient.fathername.trim() !== ""
        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()
        : `${recipient.lastname} ${recipient.firstname}`.trim();
      const afm = recipient.afm;
      const rowNumber = (index + 1).toString() + ".";

      // Determine installments
      let amountText: string;
      
      if (recipient.installments && recipient.installments.length > 0) {
        // Format with installments info
        const totalAmount = recipient.installments.reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
        const formattedTotal = this.formatCurrency(totalAmount);
        
        // Build detailed installment text
        const installmentDetails = recipient.installments
          .map((inst: any, i: number) => `${i+1}η δόση: ${this.formatCurrency(inst.amount || 0)}`)
          .join("\n");
        
        amountText = `${formattedTotal}\n(${installmentDetails})`;
      } else {
        // Simple amount formatting
        amountText = this.formatCurrency(recipient.amount || 0);
      }

      // Add the row to the table
      tableRows.push(
        new TableRow({
          height: {
            value: 400,
          },
          children: [
            new TableCell({
              width: { size: RECIPIENT_TABLE_WIDTHS[0], type: WidthType.PERCENTAGE },
              borders: getBorders(1),
              children: [
                new Paragraph({
                  text: rowNumber,
                  alignment: AlignmentType.CENTER,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              width: { size: RECIPIENT_TABLE_WIDTHS[1], type: WidthType.PERCENTAGE },
              borders: getBorders(1),
              children: [
                new Paragraph({
                  text: fullName,
                  alignment: AlignmentType.LEFT,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              width: { size: RECIPIENT_TABLE_WIDTHS[2], type: WidthType.PERCENTAGE },
              borders: getBorders(1),
              children: [
                new Paragraph({
                  text: afm,
                  alignment: AlignmentType.CENTER,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              width: { size: RECIPIENT_TABLE_WIDTHS[3], type: WidthType.PERCENTAGE },
              borders: getBorders(1),
              children: [
                new Paragraph({
                  text: amountText,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        })
      );
    });

    // Return the complete table
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: getBorders(1),
      rows: tableRows,
      layout: TableLayoutType.FIXED,
    });
  }

  /**
   * Create a standardized signatures table
   * @param signatures Array of signature objects
   * @returns Table object with signature blocks
   */
  createSignaturesTable(signatures: { name: string; role: string }[]): Table {
    const tableRows = [];

    // Split signatures into rows of 2
    for (let i = 0; i < signatures.length; i += 2) {
      const rowCells = [];

      // Add first signature in row
      rowCells.push(
        new TableCell({
          width: { size: SIGNATURES_TABLE_WIDTHS[0], type: WidthType.PERCENTAGE },
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
                  text: "Ο ",
                  ...TEXT_STYLES.default,
                }),
                new TextRun({
                  text: signatures[i].role,
                  ...TEXT_STYLES.bold,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: {
                before: 300,
                after: 800, // Space for signature
              },
            }),
            new Paragraph({
              text: signatures[i].name,
              alignment: AlignmentType.CENTER,
              style: "strong",
              spacing: {
                after: 300,
              },
            }),
          ],
        })
      );

      // Add second signature if it exists
      if (i + 1 < signatures.length) {
        rowCells.push(
          new TableCell({
            width: { size: SIGNATURES_TABLE_WIDTHS[1], type: WidthType.PERCENTAGE },
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
                    text: "Ο ",
                    ...TEXT_STYLES.default,
                  }),
                  new TextRun({
                    text: signatures[i + 1].role,
                    ...TEXT_STYLES.bold,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: {
                  before: 300,
                  after: 800, // Space for signature
                },
              }),
              new Paragraph({
                text: signatures[i + 1].name,
                alignment: AlignmentType.CENTER,
                style: "strong",
                spacing: {
                  after: 300,
                },
              }),
            ],
          })
        );
      } else {
        // Add empty cell if no second signature
        rowCells.push(
          new TableCell({
            width: { size: SIGNATURES_TABLE_WIDTHS[1], type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph("")],
          })
        );
      }

      // Add the row to the table
      tableRows.push(
        new TableRow({
          children: rowCells,
        })
      );
    }

    // Return the complete signatures table
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: tableRows,
    });
  }

  /**
   * Create a document with multiple recipients and standardized formatting
   * @param title Document title
   * @param project Project details (name, etc.)
   * @param recipients Array of recipient objects
   * @param signatures Array of signature objects
   * @returns Document object ready for export
   */
  createRecipientsDocument(
    title: string,
    project: any,
    recipients: any[],
    signatures: any[]
  ): Document {
    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + (recipient.amount || 0),
      0
    );

    // Document content elements
    const docElements = [];

    // Add project information
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Έργο: ",
            ...TEXT_STYLES.bold,
          }),
          new TextRun({
            text: project.name,
          }),
        ],
        spacing: {
          after: 200,
        },
      })
    );

    if (project.afm) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "ΑΦΜ: ",
              ...TEXT_STYLES.bold,
            }),
            new TextRun({
              text: project.afm,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );
    }

    if (project.mis) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Κωδικός/MIS: ",
              ...TEXT_STYLES.bold,
            }),
            new TextRun({
              text: project.mis,
            }),
          ],
          spacing: {
            after: 400,
          },
        })
      );
    }

    // Add recipients table
    docElements.push(
      new Paragraph({
        text: "Κατάσταση Δικαιούχων",
        alignment: AlignmentType.CENTER,
        style: "heading",
        spacing: {
          before: 200,
          after: 200,
        },
      })
    );

    docElements.push(this.createRecipientsTable(recipients));

    // Add total amount
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Συνολικό Ποσό: ",
            ...TEXT_STYLES.bold,
          }),
          new TextRun({
            text: this.formatCurrency(totalAmount),
            ...TEXT_STYLES.bold,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          before: 200,
          after: 600,
        },
      })
    );

    // Add signatures
    docElements.push(this.createSignaturesTable(signatures));

    // Create and return the document
    return this.createStandardDocument(title, docElements);
  }

  /**
   * Create a NA853 document with specialized formatting for budget documents
   * @param title Document title
   * @param project Project details (name, budget info, etc.)
   * @param recipients Array of recipient objects
   * @param signatures Array of signature objects
   * @returns Document object ready for export
   */
  createNA853Document(
    title: string,
    project: any,
    recipients: any[],
    signatures: any[]
  ): Document {
    // Document content elements
    const docElements = [];

    // Add NA853 specific header sections
    docElements.push(
      new Paragraph({
        text: "ΘΕΜΑ: Έγκριση χρηματοδότησης για την εξόφληση υποχρεώσεων",
        style: "heading",
        spacing: {
          after: 300,
        },
      })
    );

    // Add project information paragraph
    let mainText = `Έχοντας υπόψη τις διατάξεις που διέπουν τη διαδικασία έγκρισης χρηματοδότησης για την εξόφληση υποχρεώσεων των ΟΤΑ και την κάλυψη λειτουργικών δαπανών τους (ΣΑΕ 055 ΚΑΕ 2299)`;

    if (project.protocolNumber) {
      mainText += `, καθώς και το υπ' αριθμ. ${project.protocolNumber} αίτημα`;
    }

    mainText += `, εγκρίνουμε τη χρηματοδότηση για την εξόφληση υποχρεώσεων ΟΤΑ του έργου "${project.name}"`;

    if (project.mis) {
      mainText += ` (MIS: ${project.mis})`;
    }

    mainText += `, συνολικού ποσού ${this.formatCurrency(
      project.totalAmount || 0
    )}.`;

    docElements.push(
      new Paragraph({
        text: mainText,
        spacing: {
          before: 300,
          after: 400,
        },
      })
    );

    // Add recipients table
    docElements.push(
      new Paragraph({
        text: "Κατάσταση Δικαιούχων",
        alignment: AlignmentType.CENTER,
        style: "heading",
        spacing: {
          before: 200,
          after: 200,
        },
      })
    );

    docElements.push(this.createRecipientsTable(recipients));

    // Add total amount
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Συνολικό Ποσό: ",
            ...TEXT_STYLES.bold,
          }),
          new TextRun({
            text: this.formatCurrency(project.totalAmount || 0),
            ...TEXT_STYLES.bold,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          before: 200,
          after: 600,
        },
      })
    );

    // Add signatures
    docElements.push(this.createSignaturesTable(signatures));

    // Create and return the document
    return this.createStandardDocument(title, docElements);
  }
  
  /**
   * Creates a correction document (διορθωτικό έγγραφο) based on an original document
   * @param title Document title
   * @param project Project details
   * @param recipients Array of recipient objects
   * @param signatures Array of signature objects
   * @param originalData Original document data
   * @returns Document object ready for export
   */
  createCorrectionDocument(
    title: string,
    project: any,
    recipients: any[],
    signatures: any[],
    originalData: any
  ): Document {
    // Document content elements
    const docElements = [];
    
    // Add correction notice header
    docElements.push(
      new Paragraph({
        text: "ΘΕΜΑ: Διορθωτικό έγγραφο",
        style: "heading",
        spacing: {
          after: 300,
        },
      })
    );
    
    // Add reference to original document
    const originalRefText = `Σε συνέχεια του υπ' αριθμ. ${originalData.protocolNumber} εγγράφου μας με ημερομηνία ${originalData.date}, προβαίνουμε στις παρακάτω διορθώσεις:`;
    
    docElements.push(
      new Paragraph({
        text: originalRefText,
        spacing: {
          before: 300,
          after: 400,
        },
      })
    );
    
    // Add project information
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Έργο: ",
            ...TEXT_STYLES.bold,
          }),
          new TextRun({
            text: project.name,
          }),
        ],
        spacing: {
          after: 200,
        },
      })
    );

    if (project.mis) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Κωδικός/MIS: ",
              ...TEXT_STYLES.bold,
            }),
            new TextRun({
              text: project.mis,
            }),
          ],
          spacing: {
            after: 400,
          },
        })
      );
    }

    // Add recipients table
    docElements.push(
      new Paragraph({
        text: "Ορθή Κατάσταση Δικαιούχων",
        alignment: AlignmentType.CENTER,
        style: "heading",
        spacing: {
          before: 200,
          after: 200,
        },
      })
    );

    docElements.push(this.createRecipientsTable(recipients));

    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + (recipient.amount || 0),
      0
    );

    // Add total amount
    docElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Συνολικό Ποσό: ",
            ...TEXT_STYLES.bold,
          }),
          new TextRun({
            text: this.formatCurrency(totalAmount),
            ...TEXT_STYLES.bold,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          before: 200,
          after: 600,
        },
      })
    );

    // Add explanation for the correction
    if (originalData.correctionReason) {
      docElements.push(
        new Paragraph({
          text: "Αιτιολογία διόρθωσης:",
          style: "heading",
          spacing: {
            before: 200,
            after: 200,
          },
        })
      );
      
      docElements.push(
        new Paragraph({
          text: originalData.correctionReason,
          spacing: {
            after: 400,
          },
        })
      );
    }

    // Add signatures
    docElements.push(this.createSignaturesTable(signatures));

    // Create and return the document with watermark
    return this.createStandardDocument(title, docElements, {
      watermark: "ΔΙΟΡΘΩΤΙΚΟ ΕΓΓΡΑΦΟ",
    });
  }
  
  /**
   * Creates a generic document based on provided structure information
   * @param title Document title
   * @param project Project details
   * @param recipients Array of recipient objects
   * @param signatures Array of signature objects
   * @param structure Document structure configuration
   * @returns Document object ready for export
   */
  createGenericDocument(
    title: string,
    project: any,
    recipients: any[],
    signatures: any[],
    structure: any
  ): Document {
    // Document content elements
    const docElements = [];
    
    // Add subject header if provided
    if (structure.subject) {
      docElements.push(
        new Paragraph({
          text: `ΘΕΜΑ: ${structure.subject}`,
          style: "heading",
          spacing: {
            after: 300,
          },
        })
      );
    }
    
    // Add pre-content text if provided
    if (structure.preContent) {
      docElements.push(
        new Paragraph({
          text: structure.preContent,
          spacing: {
            before: 300,
            after: 400,
          },
        })
      );
    }
    
    // Add project information if showProject is true
    if (structure.showProject !== false) {
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Έργο: ",
              ...TEXT_STYLES.bold,
            }),
            new TextRun({
              text: project.name,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );

      if (project.mis) {
        docElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Κωδικός/MIS: ",
                ...TEXT_STYLES.bold,
              }),
              new TextRun({
                text: project.mis,
              }),
            ],
            spacing: {
              after: 400,
            },
          })
        );
      }
    }

    // Add recipients table if showRecipients is true
    if (structure.showRecipients !== false) {
      docElements.push(
        new Paragraph({
          text: structure.recipientsTitle || "Κατάσταση Δικαιούχων",
          alignment: AlignmentType.CENTER,
          style: "heading",
          spacing: {
            before: 200,
            after: 200,
          },
        })
      );

      docElements.push(this.createRecipientsTable(recipients));

      // Calculate and display total amount if required
      if (structure.showTotal !== false) {
        const totalAmount = recipients.reduce(
          (sum, recipient) => sum + (recipient.amount || 0),
          0
        );

        docElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Συνολικό Ποσό: ",
                ...TEXT_STYLES.bold,
              }),
              new TextRun({
                text: this.formatCurrency(totalAmount),
                ...TEXT_STYLES.bold,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: {
              before: 200,
              after: 600,
            },
          })
        );
      }
    }
    
    // Add post-content text if provided
    if (structure.postContent) {
      docElements.push(
        new Paragraph({
          text: structure.postContent,
          spacing: {
            before: 200,
            after: 400,
          },
        })
      );
    }

    // Add signatures if showSignatures is true
    if (structure.showSignatures !== false) {
      docElements.push(this.createSignaturesTable(signatures));
    }

    // Create and return the document with optional custom settings
    return this.createStandardDocument(title, docElements, {
      landscape: structure.landscape,
      watermark: structure.watermark,
      footer: structure.footer,
    });
  }
}