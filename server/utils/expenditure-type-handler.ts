/**
 * Expenditure Type Handler - Manages different formatting rules for expenditure types
 * 
 * This module handles the specific formatting requirements for different expenditure types
 * such as "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ", "ΕΚΤΟΣ ΕΔΡΑΣ", "ΔΚΑ ΕΠΙΣΚΕΥΗ", etc.
 */

import { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell } from "docx";
import { DocumentUtilities } from "./document-utilities";
import { createLogger } from "./logger";

const logger = createLogger("ExpenditureTypeHandler");

export interface ExpenditureTypeConfig {
  type: string;
  requiresSpecialFormatting: boolean;
  documentTitle?: string;
  headerModifications?: any;
  noteText?: string;
  attachmentPrefix?: string;
  paymentTableColumns?: string[];
  specialInstructions?: string[];
}

export class ExpenditureTypeHandler {
  
  // Define expenditure type configurations
  private static readonly EXPENDITURE_CONFIGS: Record<string, ExpenditureTypeConfig> = {
    "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ": {
      type: "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ",
      requiresSpecialFormatting: true,
      documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΕΠΙΔΟΤΗΣΗΣ ΕΝΟΙΚΙΟΥ",
      noteText: "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου των δικαιούχων και την εξόφληση της επιδότησης ενοικίου, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      attachmentPrefix: "Στοιχεία για επιδότηση ενοικίου:",
      paymentTableColumns: ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΜΗΝΕΣ", "ΠΟΣΟ (€)"],
      specialInstructions: [
        "Η επιδότηση αφορά ενοίκια κατοικίας",
        "Απαιτείται επαλήθευση στοιχείων μίσθωσης"
      ]
    },
    "ΕΚΤΟΣ ΕΔΡΑΣ": {
      type: "ΕΚΤΟΣ ΕΔΡΑΣ",
      requiresSpecialFormatting: true,
      documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΑΠΟΖΗΜΙΩΣΗΣ ΕΚΤΟΣ ΕΔΡΑΣ",
      noteText: "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου των δικαιούχων και την εξόφληση της αποζημίωσης εκτός έδρας, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      attachmentPrefix: "Στοιχεία για αποζημίωση εκτός έδρας:",
      paymentTableColumns: ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΗΜΕΡΕΣ", "ΠΟΣΟ (€)"],
      specialInstructions: [
        "Η αποζημίωση αφορά υπηρεσία εκτός έδρας",
        "Απαιτείται βεβαίωση παρουσίας στον τόπο εργασίας"
      ]
    },
    "ΔΚΑ ΕΠΙΣΚΕΥΗ": {
      type: "ΔΚΑ ΕΠΙΣΚΕΥΗ",
      requiresSpecialFormatting: false,
      documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΔΑΝΕΙΟΥ ΚΑΙ ΑΥΤΟΣΤΕΓΑΣΗΣ - ΕΠΙΣΚΕΥΗ",
      noteText: "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      attachmentPrefix: "Στοιχεία ΔΚΑ:",
      paymentTableColumns: ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
      specialInstructions: []
    },
    "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ": {
      type: "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ",
      requiresSpecialFormatting: false,
      documentTitle: "ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ ΔΑΝΕΙΟΥ ΚΑΙ ΑΥΤΟΣΤΕΓΑΣΗΣ",
      noteText: "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      attachmentPrefix: "Στοιχεία ΔΚΑ:",
      paymentTableColumns: ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
      specialInstructions: []
    }
  };

  /**
   * Get configuration for a specific expenditure type
   */
  public static getExpenditureConfig(expenditureType: string): ExpenditureTypeConfig {
    logger.debug(`Getting configuration for expenditure type: ${expenditureType}`);
    
    const config = this.EXPENDITURE_CONFIGS[expenditureType];
    if (config) {
      logger.debug(`Found specific configuration for: ${expenditureType}`);
      return config;
    }

    // Return default configuration for unknown types
    logger.debug(`Using default configuration for: ${expenditureType}`);
    return {
      type: expenditureType,
      requiresSpecialFormatting: false,
      documentTitle: `ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ - ${expenditureType}`,
      noteText: "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      attachmentPrefix: "Στοιχεία:",
      paymentTableColumns: ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
      specialInstructions: []
    };
  }

  /**
   * Create document title based on expenditure type
   */
  public static createDocumentTitle(expenditureType: string): Paragraph {
    const config = this.getExpenditureConfig(expenditureType);
    
    return new Paragraph({
      children: [
        new TextRun({
          text: config.documentTitle || `ΑΙΤΗΜΑ ΧΟΡΗΓΗΣΗΣ - ${expenditureType}`,
          bold: true,
          underline: {},
          size: 24,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    });
  }

  /**
   * Create note paragraph based on expenditure type
   */
  public static createNoteForExpenditureType(expenditureType: string): Paragraph {
    const config = this.getExpenditureConfig(expenditureType);
    
    return new Paragraph({
      children: [
        new TextRun({
          text: config.noteText || "Παρακαλούμε όπως μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      spacing: { before: 120, after: 0 },
    });
  }

  /**
   * Get payment table column headers based on expenditure type
   */
  public static getPaymentTableColumns(expenditureType: string): string[] {
    const config = this.getExpenditureConfig(expenditureType);
    return config.paymentTableColumns || ["Α.Α.", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΦΜ", "ΔΟΣΗ", "ΠΟΣΟ (€)"];
  }

  /**
   * Create special instructions paragraphs if needed
   */
  public static createSpecialInstructions(expenditureType: string): Paragraph[] {
    const config = this.getExpenditureConfig(expenditureType);
    const paragraphs: Paragraph[] = [];

    if (config.specialInstructions && config.specialInstructions.length > 0) {
      // Add special instructions header
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "ΕΙΔΙΚΕΣ ΟΔΗΓΙΕΣ:",
              bold: true,
              underline: {},
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          spacing: { before: 120, after: 60 },
        })
      );

      // Add each instruction
      config.specialInstructions.forEach((instruction, index) => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. ${instruction}`,
                size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
                font: DocumentUtilities.DEFAULT_FONT,
              }),
            ],
            indent: { left: 426 },
            spacing: { after: 60 },
          })
        );
      });
    }

    return paragraphs;
  }

  /**
   * Check if expenditure type requires special formatting
   */
  public static requiresSpecialFormatting(expenditureType: string): boolean {
    const config = this.getExpenditureConfig(expenditureType);
    return config.requiresSpecialFormatting;
  }

  /**
   * Get attachment prefix for expenditure type
   */
  public static getAttachmentPrefix(expenditureType: string): string {
    const config = this.getExpenditureConfig(expenditureType);
    return config.attachmentPrefix || "Στοιχεία:";
  }

  /**
   * Format recipient data based on expenditure type
   */
  public static formatRecipientForTable(recipient: any, expenditureType: string): string[] {
    const config = this.getExpenditureConfig(expenditureType);
    
    // Basic formatting for all types
    const basicData = [
      recipient.firstname + " " + recipient.lastname,
      recipient.afm,
    ];

    // Special formatting based on expenditure type
    switch (expenditureType) {
      case "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ":
        return [
          ...basicData,
          recipient.installments?.join(", ") || recipient.installment?.toString() || "1",
          recipient.amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
      
      case "ΕΚΤΟΣ ΕΔΡΑΣ":
        return [
          ...basicData,
          recipient.days?.toString() || recipient.installment?.toString() || "1",
          recipient.amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
      
      default:
        return [
          ...basicData,
          recipient.installment?.toString() || "1",
          recipient.amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
    }
  }
}