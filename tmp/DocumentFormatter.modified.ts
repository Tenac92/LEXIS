import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx";
import path from "path";
import { storage } from "../storage";
import { Project } from "../../shared/schema";
import { supabase } from "../supabase-client";

export type Recipient = {
  firstname: string;
  lastname: string;
  fathername?: string;
  afm: string;
  amount: number;
  installment?: string;
  installments?: string[];
};

export type DocumentOptions = {
  documentDate?: string;
  documentProtocolNumber?: string;
  documentTitle?: string; // Document title like "Ο.Ε"
  projectMis: string;
  projectTitle?: string; // Allow passing title directly
  /**
   * Document kind, like "ΕΚΘΕΣΗ ΑΝΑΛΗΨΗΣ ΔΑΠΑΝΗΣ"
   * Will be used as part of the title
   */
  documentKind?: string;
  /**
   * @deprecated use documentNumber instead
   */
  oldDocumentNumber?: string;
  /**
   * Document number, like "6988"
   */
  documentNumber?: string;
  /**
   * Reference number for the document
   */
  refNumber?: string;
  /**
   * Original protocol number if this is a correction
   */
  originalProtocolNumber?: string;
  /**
   * Original protocol date if this is a correction
   */
  originalProtocolDate?: string;
  /**
   * Expenditure code (ΚΑΕ) like "071.9459.χχχ/05"
   */
  expenditureCode?: string;
  /**
   * Expenditure type like "Δημόσιες Επενδύσεις"
   */
  expenditureType?: string;
  /**
   * If set to true, will add special text for correction documents
   */
  isCorrection?: boolean;
  /**
   * Department to display under the signing officer
   */
  department?: string;
  /**
   * Name to display in the signature field (signing officer)
   */
  managerName?: string;
  /**
   * Title of the signing officer
   */
  managerTitle?: string;
  /**
   * The NA code for the project, e.g. "2021ΝΑ08900028"
   */
  projectCode?: string;
  /**
   * Full title for the signing entity like "Η ΑΝΑΠΛΗΡΩΤΡΙΑ ΔΙΕΥΘΥΝΤΡΙΑ"
   * If not provided, "Ο ΔΙΕΥΘΥΝΤΗΣ" will be used
   */
  signingEntityTitle?: string;
  /**
   * Special notes to add at the bottom of the document
   */
  notes?: string;
  /**
   * Year of funding, if applicable
   */
  fundingYear?: string;
  /**
   * Secondary signatures at the bottom of the document
   */
  secondarySignatures?: {
    title?: string;
    name?: string;
  }[];
  /**
   * References to other documents that this document is based on
   */
  referencedDocuments?: {
    description?: string;
    number?: string;
    date?: string;
  }[];
  /**
   * Authorization basis for this document
   */
  authorizationBasis?: string[];
  /**
   * Classification of the document like "ΑΔΑ: ΩΚΨΓ46ΜΤΛΡ-5Γ6"
   */
  classification?: string;
  /**
   * Recipients with payment details
   */
  recipients?: Recipient[];
  /**
   * Total amount for the document
   */
  totalAmount?: number;
  /**
   * Whether to include logo
   */
  includeLogo?: boolean;
  /**
   * Optional logo path
   */
  logoPath?: string;
  /**
   * Optional custom formatting
   */
  customFormatting?: {
    hideTotalAmount?: boolean;
    hideRecipients?: boolean;
    showPaymentMethod?: boolean;
    showActionDate?: boolean;
    showInstallments?: boolean;
    useBoldForTotal?: boolean;
    recipientsTableTitle?: string;
    includeRecipientsAfm?: boolean;
    addSecondDocument?: boolean;
    addExpenditureTable?: boolean;
    formatTotalAmountAsWords?: boolean;
    expenditurePreTitle?: string;
    expenditurePostTitle?: string;
    hideTable?: boolean;
    useSecondSignature?: boolean;
  };
};

export class DocumentFormatter {
  // Default logo for documents
  private static logoPath = path.join(process.cwd(), 'public', 'logo.png');

  /**
   * Format the provided number using Greek conventions
   * @param amount Number to format
   * @returns Formatted string with Greek number formatting
   */
  public static formatCurrency(amount: number): string {
    try {
      if (isNaN(amount)) return "0,00";
      
      // Format with Greek conventions: decimals with comma, thousands with dot
      return amount.toLocaleString('el-GR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } catch (error) {
      console.error('Error formatting currency:', error);
      return amount.toString();
    }
  }

  /**
   * Convert a number to words in Greek
   * @param amount Number to convert
   * @returns Greek textual representation of the number
   */
  public static amountToWords(amount: number): string {
    // Implementation of number to words conversion in Greek
    return amount.toString() + " (€)";
  }

  /**
   * Format the date using Greek conventions
   * @param dateString Date string to format
   * @returns Formatted date string
   */
  public static formatDate(dateString: string): string {
    try {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return as is if invalid
      
      // Format with Greek conventions: day/month/year
      return date.toLocaleDateString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString; // Return original string on error
    }
  }

  /**
   * Generate centered table cell
   */
  private static createHeaderCell(content: string, width: string = "auto") {
    return new TableCell({
      children: [
        new Paragraph({
          text: content,
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_5,
        }),
      ],
      width: { size: width, type: width === "auto" ? WidthType.AUTO : WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
    });
  }

  /**
   * Generate table cell with specified alignment
   */
  private static createCell(
    content: string, 
    alignment: AlignmentType = AlignmentType.LEFT,
    width: string = "auto"
  ) {
    return new TableCell({
      children: [
        new Paragraph({
          text: content,
          alignment: alignment,
        }),
      ],
      width: { size: width, type: width === "auto" ? WidthType.AUTO : WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });
  }

  /**
   * Generate table cell with amount formatting
   */
  private static createAmountCell(amount: number) {
    const formattedAmount = this.formatCurrency(amount);
    
    return new TableCell({
      children: [
        new Paragraph({
          text: formattedAmount,
          alignment: AlignmentType.RIGHT,
        }),
      ],
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });
  }

  /**
   * Generate a standard document with the specified options
   * @param options Document generation options
   * @returns Buffer containing the generated document
   */
  public static async generateDocument(options: DocumentOptions): Promise<Buffer> {
    try {
      // Destructure options with defaults
      const {
        documentDate = new Date().toISOString().split('T')[0],
        documentProtocolNumber = '',
        documentTitle = 'ΕΚΘΕΣΗ ΑΝΑΛΗΨΗΣ ΔΑΠΑΝΗΣ',
        documentKind = '',
        documentNumber = options.oldDocumentNumber || '',
        refNumber = '',
        originalProtocolNumber = '',
        originalProtocolDate = '',
        expenditureCode = '',
        expenditureType = '',
        isCorrection = false,
        managerName = '',
        managerTitle = '',
        department = '',
        projectCode = '',
        signingEntityTitle = 'Ο ΔΙΕΥΘΥΝΤΗΣ',
        notes = '',
        fundingYear = '',
        projectMis,
        projectTitle = '',
        secondarySignatures = [],
        referencedDocuments = [],
        authorizationBasis = [],
        classification = '',
        recipients = [],
        totalAmount = 0,
        includeLogo = true,
        logoPath = DocumentFormatter.logoPath,
        customFormatting = {},
      } = options;

      // Set default custom formatting
      const {
        hideTotalAmount = false,
        hideRecipients = false,
        showPaymentMethod = false,
        showActionDate = false,
        showInstallments = true,
        useBoldForTotal = true,
        recipientsTableTitle = 'ΠΙΝΑΚΑΣ ΑΠΟΖΗΜΙΩΣΗΣ',
        includeRecipientsAfm = true,
        addSecondDocument = false,
        addExpenditureTable = false,
        formatTotalAmountAsWords = false,
        expenditurePreTitle = '',
        expenditurePostTitle = '',
        hideTable = false,
        useSecondSignature = false,
      } = customFormatting;

      // Fetch the project title if not provided
      let finalProjectTitle = projectTitle;
      if (!finalProjectTitle && projectMis) {
        const fetchedTitle = await this.getProjectTitle(projectMis);
        if (fetchedTitle) {
          finalProjectTitle = fetchedTitle;
          console.log(`Using fetched project title: ${finalProjectTitle}`);
        }
      }

      // Document sections
      const sections = [];

      // Logo and header
      const headerParagraphs = [];

      // Add logo if specified
      if (includeLogo) {
        try {
          headerParagraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: Buffer.from(""), // Placeholder - actual logo loaded separately
                  transformation: {
                    width: 100,
                    height: 100,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 200,
              },
            })
          );
        } catch (error) {
          console.error("Error adding logo:", error);
          // Continue without the logo
        }
      }

      // Add document title
      headerParagraphs.push(
        new Paragraph({
          text: documentTitle,
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 200,
            after: 200,
          },
        })
      );

      // Add document number if provided
      if (documentNumber) {
        headerParagraphs.push(
          new Paragraph({
            text: `Αριθμ. ${documentNumber}`,
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
            spacing: {
              after: 200,
            },
          })
        );
      }

      // Add reference number if provided
      if (refNumber) {
        headerParagraphs.push(
          new Paragraph({
            text: `Σχετ. ${refNumber}`,
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_3,
            spacing: {
              after: 200,
            },
          })
        );
      }

      // Add correction text if this is a correction document
      if (isCorrection && originalProtocolNumber) {
        headerParagraphs.push(
          new Paragraph({
            text: `ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ της υπ' αριθμ. πρωτ. ${originalProtocolNumber}`,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 100,
            },
          })
        );

        if (originalProtocolDate) {
          headerParagraphs.push(
            new Paragraph({
              text: `από ${this.formatDate(originalProtocolDate)}`,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 400,
              },
            })
          );
        }
      }

      // Add protocol number and date
      const dateText = documentDate ? ` (${this.formatDate(documentDate)})` : '';
      if (documentProtocolNumber) {
        headerParagraphs.push(
          new Paragraph({
            text: `Αρ. Πρωτ.: ${documentProtocolNumber}${dateText}`,
            alignment: AlignmentType.RIGHT,
            spacing: {
              after: 400,
            },
          })
        );
      } else if (dateText) {
        headerParagraphs.push(
          new Paragraph({
            text: `Ημερομηνία: ${this.formatDate(documentDate)}`,
            alignment: AlignmentType.RIGHT,
            spacing: {
              after: 400,
            },
          })
        );
      }
      
      // Add classification if provided
      if (classification) {
        headerParagraphs.push(
          new Paragraph({
            text: classification,
            alignment: AlignmentType.RIGHT,
            spacing: {
              after: 400,
            },
          })
        );
      }

      // Add document kind if provided (typically used for specific form types)
      if (documentKind) {
        headerParagraphs.push(
          new Paragraph({
            text: documentKind,
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_3,
            spacing: {
              before: 400,
              after: 400,
            },
          })
        );
      }

      // Add referenced documents if provided
      if (referencedDocuments && referencedDocuments.length > 0) {
        headerParagraphs.push(
          new Paragraph({
            text: "Έχοντας υπόψη:",
            spacing: {
              before: 200,
              after: 200,
            },
          })
        );

        referencedDocuments.forEach((doc, index) => {
          if (doc.description || doc.number || doc.date) {
            let refText = `${index + 1}. `;
            
            if (doc.description) refText += doc.description;
            if (doc.number) refText += ` Αρ. ${doc.number}`;
            if (doc.date) refText += ` (${this.formatDate(doc.date)})`;
            
            headerParagraphs.push(
              new Paragraph({
                text: refText,
                spacing: {
                  before: 100,
                  after: 100,
                },
              })
            );
          }
        });
      }

      // Add authorization basis if provided
      if (authorizationBasis && authorizationBasis.length > 0) {
        if (referencedDocuments.length === 0) {
          headerParagraphs.push(
            new Paragraph({
              text: "Έχοντας υπόψη:",
              spacing: {
                before: 200,
                after: 200,
              },
            })
          );
        }

        authorizationBasis.forEach((basis, index) => {
          const startIndex = referencedDocuments.length;
          headerParagraphs.push(
            new Paragraph({
              text: `${startIndex + index + 1}. ${basis}`,
              spacing: {
                before: 100,
                after: 100,
              },
            })
          );
        });
      }

      // Add project code and title
      if (projectCode || finalProjectTitle) {
        let projectText = "Έργο: ";
        
        if (projectCode) projectText += projectCode;
        if (projectCode && finalProjectTitle) projectText += " - ";
        if (finalProjectTitle) projectText += finalProjectTitle;
        
        headerParagraphs.push(
          new Paragraph({
            text: projectText,
            spacing: {
              before: 200,
              after: 200,
            },
          })
        );
      }

      // Add KAE (expenditure code) if provided
      if (expenditureCode) {
        headerParagraphs.push(
          new Paragraph({
            text: `ΚΑΕ: ${expenditureCode}`,
            spacing: {
              before: 200,
              after: 200,
            },
          })
        );
      }

      // Add expenditure type if provided
      if (expenditureType) {
        headerParagraphs.push(
          new Paragraph({
            text: `Τύπος δαπάνης: ${expenditureType}`,
            spacing: {
              before: 200,
              after: 200,
            },
          })
        );
      }

      // Add total amount section if not hidden
      if (!hideTotalAmount && totalAmount > 0) {
        const formattedAmount = this.formatCurrency(totalAmount);
        let amountText = `Συνολικό ποσό: ${formattedAmount} €`;
        
        // Add amount in words if specified
        if (formatTotalAmountAsWords) {
          amountText += ` (${this.amountToWords(totalAmount)})`;
        }
        
        // Use bold or regular formatting based on settings
        if (useBoldForTotal) {
          headerParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: amountText,
                  bold: true,
                }),
              ],
              spacing: {
                before: 200,
                after: 200,
              },
            })
          );
        } else {
          headerParagraphs.push(
            new Paragraph({
              text: amountText,
              spacing: {
                before: 200,
                after: 200,
              },
            })
          );
        }
      }

      // Add expenditure table if specified
      if (addExpenditureTable) {
        // Header paragraphs for the expenditure table
        if (expenditurePreTitle) {
          headerParagraphs.push(
            new Paragraph({
              text: expenditurePreTitle,
              spacing: {
                before: 400,
                after: 200,
              },
            })
          );
        }
        
        // Main expenditure table title
        headerParagraphs.push(
          new Paragraph({
            text: "ΠΙΝΑΚΑΣ ΑΝΑΛΗΨΗΣ ΔΑΠΑΝΗΣ",
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_3,
            spacing: {
              before: 400,
              after: 400,
            },
          })
        );
        
        // Post-title text if provided
        if (expenditurePostTitle) {
          headerParagraphs.push(
            new Paragraph({
              text: expenditurePostTitle,
              spacing: {
                before: 200,
                after: 400,
              },
            })
          );
        }
        
        // Create the expenditure table
        const expenditureTable = new Table({
          rows: [
            new TableRow({
              children: [
                this.createHeaderCell("α/α"),
                this.createHeaderCell("ΠΕΡΙΓΡΑΦΗ ΔΑΠΑΝΗΣ"),
                this.createHeaderCell("ΠΟΣΟ (€)"),
              ],
            }),
            new TableRow({
              children: [
                this.createCell("1.", AlignmentType.CENTER),
                this.createCell(finalProjectTitle || ""),
                this.createAmountCell(totalAmount),
              ],
            }),
            new TableRow({
              children: [
                this.createCell(""),
                this.createCell("ΣΥΝΟΛΟ", AlignmentType.RIGHT, "80%"),
                this.createAmountCell(totalAmount),
              ],
            }),
          ],
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
        });
        
        headerParagraphs.push(expenditureTable);
        headerParagraphs.push(
          new Paragraph({
            text: "",
            spacing: {
              after: 400,
            },
          })
        );
      }

      // Add recipients table if not hidden and recipients exist
      if (!hideRecipients && !hideTable && recipients.length > 0) {
        // Title for the recipients table
        headerParagraphs.push(
          new Paragraph({
            text: recipientsTableTitle,
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_3,
            spacing: {
              before: 400,
              after: 400,
            },
          })
        );

        // Create header row for the table
        const headerCells = [
          this.createHeaderCell("α/α", "5%"),
          this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "40%"),
        ];
        
        // Add AFM column if specified
        if (includeRecipientsAfm) {
          headerCells.push(this.createHeaderCell("ΑΦΜ", "15%"));
        }
        
        // Add installment column if specified
        if (showInstallments) {
          headerCells.push(this.createHeaderCell("ΔΟΣΗ", "15%"));
        }
        
        // Always add amount column
        headerCells.push(this.createHeaderCell("ΠΟΣΟ (€)", "25%"));
        
        // Create the table with the header row
        const rows = [new TableRow({ children: headerCells })];
        
        // Process each recipient
    recipients.forEach((recipient, index) => {
      // Only add ΤΟΥ if fathername exists and is not empty
      const fullName = recipient.fathername && recipient.fathername.trim() !== ""
        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()
        : `${recipient.lastname} ${recipient.firstname}`.trim();
      const afm = recipient.afm;
      const rowNumber = (index + 1).toString() + ".";

      // Determine installments
      let installments: string[] = [];
      if (
        Array.isArray(recipient.installments) &&
        recipient.installments.length > 0
      ) {
        installments = recipient.installments;
      } else if (recipient.installment) {
        installments = [recipient.installment];
      }
      const installmentText = installments.join(", ");

      // Create recipient row cells
      const rowCells = [
        this.createCell(rowNumber, AlignmentType.CENTER, "5%"),
        this.createCell(fullName, AlignmentType.LEFT, "40%"),
      ];
      
      // Add AFM if specified
      if (includeRecipientsAfm) {
        rowCells.push(this.createCell(afm, AlignmentType.CENTER, "15%"));
      }
      
      // Add installment if specified
      if (showInstallments) {
        rowCells.push(
          this.createCell(installmentText, AlignmentType.CENTER, "15%")
        );
      }
      
      // Add amount
      rowCells.push(this.createAmountCell(recipient.amount));
      
      // Add the row to the table
      rows.push(new TableRow({ children: rowCells }));
    });

        // Add total row
        const totalCells = [];
        
        // Add blank cells for row number and name
        totalCells.push(this.createCell("", AlignmentType.CENTER, "5%"));
        totalCells.push(
          this.createCell("ΣΥΝΟΛΟ", AlignmentType.RIGHT, "40%")
        );
        
        // Add blank cells for AFM and/or installment if present
        if (includeRecipientsAfm) {
          totalCells.push(this.createCell("", AlignmentType.CENTER, "15%"));
        }
        
        if (showInstallments) {
          totalCells.push(this.createCell("", AlignmentType.CENTER, "15%"));
        }
        
        // Add total amount
        totalCells.push(this.createAmountCell(totalAmount));
        
        // Add total row to the table
        rows.push(new TableRow({ children: totalCells }));
        
        // Create the recipients table and add it to the document
        const recipientsTable = new Table({
          rows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
        });
        
        headerParagraphs.push(recipientsTable);
      }

      // Add notes if provided
      if (notes) {
        headerParagraphs.push(
          new Paragraph({
            text: notes,
            spacing: {
              before: 400,
              after: 400,
            },
          })
        );
      }

      // Add signature section
      headerParagraphs.push(
        new Paragraph({
          text: "",
          spacing: {
            before: 800,
          },
        })
      );

      headerParagraphs.push(
        new Paragraph({
          text: signingEntityTitle,
          alignment: AlignmentType.RIGHT,
          spacing: {
            before: 800,
          },
        })
      );

      headerParagraphs.push(
        new Paragraph({
          text: "",
          spacing: {
            before: 1200,
          },
        })
      );

      // Add manager name if provided
      if (managerName) {
        headerParagraphs.push(
          new Paragraph({
            text: managerName,
            alignment: AlignmentType.RIGHT,
            spacing: {
              before: 400,
            },
          })
        );
      }

      // Add manager title if provided
      if (managerTitle) {
        headerParagraphs.push(
          new Paragraph({
            text: managerTitle,
            alignment: AlignmentType.RIGHT,
          })
        );
      }

      // Add department if provided
      if (department) {
        headerParagraphs.push(
          new Paragraph({
            text: department,
            alignment: AlignmentType.RIGHT,
          })
        );
      }

      // Add secondary signatures if provided
      if (useSecondSignature && secondarySignatures && secondarySignatures.length > 0) {
        headerParagraphs.push(
          new Paragraph({
            text: "",
            spacing: {
              before: 800,
            },
          })
        );

        secondarySignatures.forEach(signature => {
          if (signature.title) {
            headerParagraphs.push(
              new Paragraph({
                text: signature.title,
                alignment: AlignmentType.LEFT,
              })
            );
          }

          if (signature.name) {
            headerParagraphs.push(
              new Paragraph({
                text: "",
                spacing: {
                  before: 800,
                },
              })
            );

            headerParagraphs.push(
              new Paragraph({
                text: signature.name,
                alignment: AlignmentType.LEFT,
              })
            );
          }
        });
      }

      // Create the document with all sections
      const doc = new Document({
        features: {
          updateFields: true,
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1000,
                  right: 1000,
                  bottom: 1000,
                  left: 1000,
                },
              },
            },
            children: headerParagraphs,
          },
        ],
      });

      // Generate second document if requested
      if (addSecondDocument) {
        const secondDocument = await this.generateSecondDocument(options);
        // In a real implementation, would append the second document
      }

      // Convert document to buffer and return
      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }

  /**
   * Generate the second document containing:
   * - Document title at the top
   * - Recipients table with different formatting
   * - Standard text about documentation retention
   * - Signature fields
   */
  public static async generateSecondDocument(options: DocumentOptions): Promise<Buffer> {
    try {
      // Destructure options with defaults
      const {
        documentDate = new Date().toISOString().split('T')[0],
        documentTitle = 'ΚΑΤΑΛΟΓΟΣ ΔΙΚΑΙΟΥΧΩΝ',
        managerName = '',
        managerTitle = '',
        department = '',
        projectMis,
        projectTitle = '',
        projectCode = '',
        recipients = [],
        totalAmount = 0,
        customFormatting = {},
      } = options;

      // Set default custom formatting for second document
      const {
        showInstallments = true,
        includeRecipientsAfm = true,
      } = customFormatting;

      // Fetch the project title if not provided
      let finalProjectTitle = projectTitle;
      if (!finalProjectTitle && projectMis) {
        const fetchedTitle = await this.getProjectTitle(projectMis);
        if (fetchedTitle) {
          finalProjectTitle = fetchedTitle;
        }
      }

      // Document elements
      const elements = [];

      // Add document title
      elements.push(
        new Paragraph({
          text: documentTitle,
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 200,
            after: 400,
          },
        })
      );

      // Add project info if available
      if (projectCode || finalProjectTitle) {
        let projectText = "Έργο: ";
        
        if (projectCode) projectText += projectCode;
        if (projectCode && finalProjectTitle) projectText += " - ";
        if (finalProjectTitle) projectText += finalProjectTitle;
        
        elements.push(
          new Paragraph({
            text: projectText,
            spacing: {
              before: 200,
              after: 400,
            },
          })
        );
      }

      // Create recipients table
      const tableRows = [
        new TableRow({
          children: [
            this.createHeaderCell("α/α"),
            this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ"),
            this.createHeaderCell("ΠΡΑΞΗ"), // Special column for second document
            includeRecipientsAfm ? this.createHeaderCell("ΑΦΜ") : null,
            showInstallments ? this.createHeaderCell("ΔΟΣΗ") : null,
            this.createHeaderCell("ΠΟΣΟ (€)"),
          ].filter(Boolean), // Remove null elements
        }),
      ];

      // Process each recipient
    recipients.forEach((recipient, index) => {
      // Only add ΤΟΥ if fathername exists and is not empty
      const fullName = recipient.fathername && recipient.fathername.trim() !== ""
        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()
        : `${recipient.lastname} ${recipient.firstname}`.trim();
      const afm = recipient.afm;
      const rowNumber = (index + 1).toString() + ".";

      // Determine installments
      let installmentText = '';
      if (Array.isArray(recipient.installments) && recipient.installments.length > 0) {
        installmentText = recipient.installments.join(", ");
      } else if (recipient.installment) {
        installmentText = recipient.installment;
      }

      // Create row cells
      const cells = [
        this.createCell(rowNumber, AlignmentType.CENTER),
        this.createCell(fullName),
        this.createCell(finalProjectTitle || ""), // Práxi column
      ];
      
      // Add optional columns
      if (includeRecipientsAfm) {
        cells.push(this.createCell(afm, AlignmentType.CENTER));
      }
      
      if (showInstallments) {
        cells.push(this.createCell(installmentText, AlignmentType.CENTER));
      }
      
      // Add amount column
      cells.push(this.createAmountCell(recipient.amount));
      
      // Add row to table
      tableRows.push(new TableRow({ children: cells }));
    });

      // Add total row
      const totalCells = [
        this.createCell(""),
        this.createCell("ΣΥΝΟΛΟ", AlignmentType.RIGHT),
        this.createCell(""),
      ];
      
      // Add blank cells for optional columns
      if (includeRecipientsAfm) {
        totalCells.push(this.createCell(""));
      }
      
      if (showInstallments) {
        totalCells.push(this.createCell(""));
      }
      
      // Add total amount
      totalCells.push(this.createAmountCell(totalAmount));
      tableRows.push(new TableRow({ children: totalCells }));

      // Create the table and add to document
      const recipientsTable = new Table({
        rows: tableRows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
      });
      
      elements.push(recipientsTable);

      // Add standard record-keeping text
      elements.push(
        new Paragraph({
          text: "",
          spacing: {
            before: 400,
          },
        })
      );
      
      elements.push(
        new Paragraph({
          text: "Η παραπάνω κατάσταση θα τηρηθεί στο αρχείο μας.",
          spacing: {
            before: 400,
            after: 200,
          },
        })
      );

      // Add date
      elements.push(
        new Paragraph({
          text: `Αθήνα, ${this.formatDate(documentDate)}`,
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 600,
            after: 600,
          },
        })
      );

      // Add signature area
      elements.push(
        new Paragraph({
          text: "Ο ΣΥΝΤΑΞΑΣ",
          alignment: AlignmentType.LEFT,
          spacing: {
            before: 400,
          },
        })
      );
      
      elements.push(
        new Paragraph({
          text: "Ο ΔΙΕΥΘΥΝΤΗΣ",
          alignment: AlignmentType.RIGHT,
          spacing: {
            before: 400,
          },
        })
      );
      
      elements.push(
        new Paragraph({
          text: "",
          spacing: {
            before: 1200,
          },
        })
      );
      
      // Add names if provided
      if (managerName) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: "", width: "50%" }),
              new TextRun({
                text: managerName,
                alignment: AlignmentType.RIGHT,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          })
        );
      }
      
      if (managerTitle) {
        elements.push(
          new Paragraph({
            text: managerTitle,
            alignment: AlignmentType.RIGHT,
          })
        );
      }
      
      if (department) {
        elements.push(
          new Paragraph({
            text: department,
            alignment: AlignmentType.RIGHT,
          })
        );
      }

      // Create document with all elements
      const doc = new Document({
        features: {
          updateFields: true,
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1000,
                  right: 1000,
                  bottom: 1000,
                  left: 1000,
                },
              },
            },
            children: elements,
          },
        ],
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating primary document:", error);
      throw error;
    }
  }

  /**
   * Get project title from the Projects table using MIS or NA853
   */
  public static async getProjectTitle(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        console.error("No MIS provided for project title lookup");
        return null;
      }

      console.log(`Fetching project title for input: ${mis}`);

      // Check if MIS is numeric or follows the pattern of project codes
      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      console.log(
        `[DocumentFormatter] getProjectTitle - Analysis: isNumericString=${isNumericString}, isProjectCode=${isProjectCode}`,
      );

      let data, error;

      // Strategy 1: Try first with budget_na853 if it's a numeric MIS
      if (isNumericString) {
        // Field name varies between tables
        ({ data, error } = await supabase
          .from("budget_na853_split")
          .select("full_title")
          .eq("mis", mis)
          .maybeSingle());

        if (data?.full_title) {
          console.log(`Found project in budget_na853_split: ${data.full_title}`);
          return data.full_title;
        }
      }

      // Strategy 2: Try with Projects table using MIS field
      ({ data, error } = await supabase
        .from("Projects")
        .select("full_title")
        .eq("mis", mis)
        .maybeSingle());

      if (data?.full_title) {
        console.log(`Found project in Projects by MIS: ${data.full_title}`);
        return data.full_title;
      }

      // Strategy 3: Try with Projects table using na853_code field
      ({ data, error } = await supabase
        .from("Projects")
        .select("full_title")
        .eq("na853_code", mis)
        .maybeSingle());

      if (data?.full_title) {
        console.log(`Found project in Projects by na853_code: ${data.full_title}`);
        return data.full_title;
      }

      // Strategy 4: For project codes, try a more flexible search
      if (isProjectCode) {
        ({ data, error } = await supabase
          .from("Projects")
          .select("full_title")
          .ilike("na853_code", `%${mis}%`)
          .maybeSingle());

        if (data?.full_title) {
          console.log(`Found project in Projects by partial na853_code match: ${data.full_title}`);
          return data.full_title;
        }
      }

      console.log("Project title not found for", mis);
      return null;
    } catch (error) {
      console.error("Error fetching project title:", error);
      return null;
    }
  }
}