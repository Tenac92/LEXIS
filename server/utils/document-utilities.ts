/**
 * Document Utilities - Shared utilities for document generation
 *
 * This module provides reusable components and utilities for creating
 * Word documents, including common elements like headers, signatures,
 * tables, and formatting functions.
 */

import {
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { createLogger } from "./logger";
import { UnitDetails } from "./document-types";

const logger = createLogger("DocumentUtilities");

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface ExpenditureConfig {
  documentTitle: string;
  columns: string[];
  mainText: string;
}

// =============================================================================
// EXPENDITURE CONFIGURATIONS
// =============================================================================

export const EXPENDITURE_CONFIGS: Record<string, ExpenditureConfig> = {
  "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ": {
    documentTitle:
      "Διαβιβαστικό Απόφασης για την πληρωμή επιδοτήσεων ενοικίου/συγκατοίκησης που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΜΗΝΕΣ", "ΠΟΣΟ (€)"],
    mainText:
      "Παρακαλούμε για την πληρωμή των αναγνωρισμένων δικαιούχων επιδότησης ενοικίου/συγκατοίκησης στην",
  },
  "ΕΚΤΟΣ ΕΔΡΑΣ": {
    documentTitle: "Αίτημα χορήγησης αποζημίωσης εκτός έδρας",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΗΜΕΡΕΣ", "ΠΟΣΟ (€)"],
    mainText:
      "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την αποζημίωση εκτός έδρας για τους κατωτέρω υπαλλήλους:",
  },
  "ΔΚΑ ΕΠΙΣΚΕΥΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Επισκευής που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της κρατικης αρωγής  που έχει εγκριθεί από",
  },
  "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Ανακατασκευής που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της κρατικης αρωγής  που έχει εγκριθεί από ",
  },
  "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Αυτοστέγασης που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της κρατικης αρωγής  που έχει εγκριθεί από",
  },
};

// =============================================================================
// DOCUMENT UTILITIES CLASS
// =============================================================================

export class DocumentUtilities {
  // Document constants
  public static readonly DEFAULT_FONT_SIZE = 22;
  public static readonly DEFAULT_FONT = "Calibri";
  public static readonly DEFAULT_MARGINS = {
    top: 720, // 0.5 inch top margin for Greek government documents
    right: 720, // 0.5 inch right margin
    bottom: 720, // 0.5 inch bottom margin
    left: 720, // 0.5 inch left margin
  };
  public static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  // =============================================================================
  // ASSET MANAGEMENT
  // =============================================================================

  /**
   * Get the logo image data for documents
   */
  public static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(
      process.cwd(),
      "server",
      "utils",
      "ethnosimo22.png",
    );
    return fs.promises.readFile(logoPath);
  }

  // =============================================================================
  // PARAGRAPH CREATION UTILITIES
  // =============================================================================

  /**
   * Create a bold paragraph with specified text
   */
  public static createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 20, // Increased font size for header text
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  /**
   * Create a blank line with specified spacing
   */
  public static createBlankLine(spacing: number = 240): Paragraph {
    return new Paragraph({
      text: "",
      spacing: { after: spacing },
    });
  }

  /**
   * Create a centered paragraph with specified text and styling
   */
  public static createCenteredParagraph(
    text: string,
    options: {
      bold?: boolean;
      underline?: boolean;
      size?: number;
      spacing?: number;
    } = {},
  ): Paragraph {
    const {
      bold = false,
      underline = false,
      size = this.DEFAULT_FONT_SIZE,
      spacing = 120,
    } = options;

    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold,
          underline: underline ? {} : undefined,
          size,
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: spacing },
    });
  }

  /**
   * Create a contact detail paragraph
   */
  public static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `${label}: `,
          bold: true,
          size: this.DEFAULT_FONT_SIZE,
          font: this.DEFAULT_FONT,
        }),
        new TextRun({
          text: value,
          size: this.DEFAULT_FONT_SIZE,
          font: this.DEFAULT_FONT,
        }),
      ],
      spacing: { after: 0 },
    });
  }

  /**
   * Create notification list paragraphs
   */
  public static createNotificationList(notifications: string[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < notifications.length; i++) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${notifications[i]}`,
              size: this.DEFAULT_FONT_SIZE - 4,
              font: this.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
          spacing: { after: 120 },
        }),
      );
    }

    return paragraphs;
  }

  // =============================================================================
  // SIGNATURE AND AUTHORIZATION
  // =============================================================================

  /**
   * Create manager signature paragraphs for document signatures
   */
  public static createManagerSignatureParagraphs(
    managerInfo?: any,
  ): Paragraph[] {
    const rightColumnParagraphs: Paragraph[] = [];

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              managerInfo?.order ||
              "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.title || "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    );

    rightColumnParagraphs.push(this.createBlankLine(120));
    rightColumnParagraphs.push(this.createBlankLine(120));

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.name || "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.degree || "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β.",
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );

    return rightColumnParagraphs;
  }

  // =============================================================================
  // TABLE CREATION UTILITIES
  // =============================================================================

  /**
   * Create a table with no borders
   */
  public static createBorderlessTable(
    rows: TableRow[],
    columnWidths?: number[],
  ): Table {
    const tableOptions: any = {
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows,
    };

    if (columnWidths) {
      tableOptions.columnWidths = columnWidths;
    }

    return new Table(tableOptions);
  }

  /**
   * Create a table cell with no borders
   */
  public static createBorderlessCell(
    content: Paragraph[],
    verticalAlign: typeof VerticalAlign.TOP = VerticalAlign.TOP,
  ): TableCell {
    return new TableCell({
      children: content,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      verticalAlign,
    });
  }

  // =============================================================================
  // DATA FETCHING UTILITIES
  // =============================================================================

  /**
   * Get unit details from the database or API
   */
  public static async getUnitDetails(unit: string): Promise<UnitDetails> {
    try {
      logger.debug(`Fetching unit details for: ${unit}`);

      // Map unit abbreviations to full names with proper Greek grammar
      const unitMappings: Record<string, { name: string; prop: string }> = {
        "ΔΑΕΦΚ-ΚΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΒΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΒΟΡΕΙΑΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΝΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΝΟΤΙΑΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΑΜ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΙΓΑΙΟΥ ΚΑΙ ΜΑΚΕΔΟΝΙΑΣ",
          prop: "τη",
        },
      };

      const unitInfo = unitMappings[unit] || {
        name: unit,
        prop: "τη",
      };

      return {
        unit,
        name: unitInfo.name,
        unit_name: unitInfo,
        manager: {
          name: "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
          order: "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
          title: "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
          degree: "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β.",
        },
      };
    } catch (error) {
      logger.error("Error fetching unit details:", error);
      throw error;
    }
  }

  /**
   * Get project title by MIS or NA853
   */
  public static async getProjectTitle(
    misOrNA853: string | number,
  ): Promise<string> {
    try {
      logger.debug(`Fetching project title for: ${misOrNA853}`);

      // Import storage to fetch project data
      const { storage } = await import("../storage");

      // Try to fetch from projects by MIS first
      if (typeof misOrNA853 === "number" || !isNaN(Number(misOrNA853))) {
        const projects = await storage.getProjectsByUnit(""); // Get all projects
        const project = projects.find((p) => p.mis === Number(misOrNA853));
        if (project) {
          return project.title || `Project ${misOrNA853}`;
        }
      }

      // If no project found, return a default title
      return `Project ${misOrNA853}`;
    } catch (error) {
      logger.error("Error fetching project title:", error);
      return `Project ${misOrNA853}`;
    }
  }

  /**
   * Get project NA853 by MIS
   */
  public static async getProjectNA853(mis: string | number): Promise<string> {
    try {
      logger.debug(`Fetching project NA853 for MIS: ${mis}`);

      // Import storage to fetch project data
      const { storage } = await import("../storage");

      const projects = await storage.getProjectsByUnit(""); // Get all projects
      const project = projects.find((p) => p.mis === Number(mis));

      if (project && project.budget_na853) {
        return project.budget_na853;
      }

      // Return default if not found
      return `2024ΝΑ85300000`;
    } catch (error) {
      logger.error("Error fetching project NA853:", error);
      return `2024ΝΑ85300000`;
    }
  }

  // =============================================================================
  // FORMATTING AND CONFIGURATION UTILITIES
  // =============================================================================

  /**
   * Format currency amount for Greek documents
   */
  public static formatCurrency(amount: number): string {
    try {
      // Format with Greek number formatting (comma as thousands separator, period as decimal)
      return new Intl.NumberFormat("el-GR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      logger.error("Error formatting currency:", error);
      return `${amount.toFixed(2)} €`;
    }
  }

  /**
   * Get expenditure configuration by type - returns a typed configuration object
   * @param expenditureType The expenditure type to get configuration for
   * @returns Configuration object with proper fallback
   */
  public static getExpenditureConfig(
    expenditureType: string,
  ): ExpenditureConfig {
    // Log unknown expenditure types for debugging
    if (expenditureType && !EXPENDITURE_CONFIGS[expenditureType]) {
      logger.warn(
        `Unknown expenditure type: ${expenditureType}. Using default configuration.`,
      );
    }

    return (
      EXPENDITURE_CONFIGS[expenditureType] || {
        documentTitle: `Αίτημα πληρωμής δαπάνης τύπου: ${expenditureType}`,
        columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΠΟΣΟ (€)"],
        mainText:
          "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την παρακάτω δαπάνη για τους κατωτέρω δικαιούχους:",
      }
    );
  }

  /**
   * Get all available expenditure types
   * @returns Array of available expenditure type keys
   */
  public static getAvailableExpenditureTypes(): string[] {
    return Object.keys(EXPENDITURE_CONFIGS);
  }

  /**
   * Validate if an expenditure type is supported
   * @param expenditureType The expenditure type to validate
   * @returns True if supported, false otherwise
   */
  public static isValidExpenditureType(expenditureType: string): boolean {
    return expenditureType in EXPENDITURE_CONFIGS;
  }
}
