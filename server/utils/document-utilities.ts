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
  TableLayoutType,
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
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΤΡΙΜΗΝΟ", "ΠΟΣΟ (€)"],
    mainText:
      "Παρακαλούμε για την πληρωμή των αναγνωρισμένων δικαιούχων επιδότησης ενοικίου/συγκατοίκησης που έχουν εγκριθεί από",
  },
  // Add mapping for generic ΔΑΠΑΝΗ to proper expenditure type
  ΔΑΠΑΝΗ: {
    documentTitle: "Αίτημα πληρωμής δαπάνης",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την παρακάτω δαπάνη για τους κατωτέρω δικαιούχους:",
  },
  "ΕΚΤΟΣ ΕΔΡΑΣ": {
    documentTitle:
      "Αίτημα χορήγησης αποζημίωσης δαπανών οδοιπορικών εξόδων και εκτός έδρας αποζημίωσης",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΗΜΕΡΕΣ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε για την πληρωμή των δαπανών εκτός έδρας μετακινήσεων & οδοιπορικών των υπαλλήλων",
  },
  "ΔΚΑ ΕΠΙΣΚΕΥΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Επισκευής που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της Κρατικής Αρωγής  που έχει εγκριθεί από",
  },
  "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Ανακατασκευής που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της Κρατικής Αρωγής  που έχει εγκριθεί από ",
  },
  "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ": {
    documentTitle:
      "Αίτημα για την πληρωμή Δ.Κ.Α Αυτοστέγασης που έχουν εγκριθεί από",
    columns: ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ.", "ΔΟΣΗ", "ΠΟΣΟ (€)"],
    mainText:
      "Αιτούμαστε την πληρωμή της Κρατικής Αρωγής  που έχει εγκριθεί από",
  },
};

// =============================================================================
// DOCUMENT UTILITIES CLASS
// =============================================================================

export class DocumentUtilities {
  // Document constants
  public static readonly DEFAULT_FONT_SIZE = 20;
  public static readonly DEFAULT_FONT = "Calibri";
  public static readonly DEFAULT_MARGINS = {
    top: 720, // 0.5 inch top margin for Greek government documents
    right: 720, // 0.5 inch right margin
    bottom: 720, // 0.5 inch bottom margin
    left: 720, // 0.5 inch left margin
  };
  public static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  // =============================================================================
  // UNIFIED BORDER SYSTEM - CONSISTENT ACROSS ALL TABLES
  // =============================================================================

  /**
   * Centralized border definitions to ensure consistency and prevent Word repair issues.
   * All sizes are specified to avoid mixing table-level and cell-level semantics.
   */
  public static readonly BORDERS = {
    NO_BORDER_TABLE: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    NO_BORDER_CELL: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    STANDARD_TABLE: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    STANDARD_CELL: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  };

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
      spacing: { after: 0 },
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
   * Uses director_signature field data from the document
   */
  public static createManagerSignatureParagraphs(
    signatureInfo?: any,
  ): Paragraph[] {
    const rightColumnParagraphs: Paragraph[] = [];

    // Use signature info from director_signature field
    const order =
      signatureInfo?.order || "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.";
    const title =
      signatureInfo?.title || "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.";
    const name = signatureInfo?.name || "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ";
    const degree = signatureInfo?.degree || "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β.";

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: order,
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    );

    // Split title into multiple lines for better formatting in secondary document
    const titleLines = this.splitTitleIntoLines(title);

    titleLines.forEach((line: string, index: number) => {
      rightColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              bold: true,
              size: this.DEFAULT_FONT_SIZE,
              font: this.DEFAULT_FONT,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: index === titleLines.length - 1 ? 120 : 0,
            before: index === 0 ? 0 : 0,
          },
        }),
      );
    });

    rightColumnParagraphs.push(this.createBlankLine(160));

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: name,
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
            text: degree,
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
      layout: TableLayoutType.FIXED,
      // IMPORTANT: Do NOT specify table-level width for FIXED layout tables
      // as it conflicts with cell-level widths and causes Word corruption
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

    // Add columnWidths if provided (for FIXED layout compatibility)
    if (columnWidths && columnWidths.length > 0) {
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
  public static async getUnitDetails(
    unit: string | number,
  ): Promise<UnitDetails> {
    try {
      logger.debug(`Fetching unit details for: ${unit}`);

      // Import database connection
      const { supabase } = await import("../config/db");

      // Determine if we're searching by numeric ID or string unit code
      const isNumericId = !isNaN(Number(unit));

      // Try to fetch unit details from database
      const { data: unitData, error: unitError } = await supabase
        .from("Monada")
        .select("*")
        .eq(isNumericId ? "id" : "unit", isNumericId ? Number(unit) : unit)
        .single();

      if (unitData && !unitError) {
        logger.debug(`Found unit details in database for: ${unit}`);

        // Extract manager information from database
        const manager = unitData.manager || {};

        return {
          unit: unitData.unit || String(unit), // Use the unit string identifier from database, fallback to input
          name: unitData.unit_name?.name || unitData.unit_name || unit,
          unit_name: unitData.unit_name || { name: unit, prop: "τη" },
          manager: {
            name: manager.name || "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
            order:
              manager.order || "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
            title: manager.title || "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
            degree: manager.degree || "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β.",
          },
          address: unitData.address,
          email: unitData.email,
          parts: unitData.parts || {}, // Include the parts data from database
        };
      }

      logger.warn(`Unit not found in database, using fallback for: ${unit}`);

      // Fallback to static mappings if database lookup fails
      const unitMappings: Record<string, { name: string; prop: string }> = {
        "2": {
          // Numeric ID 2 maps to Central Greece unit
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΚΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΒΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΒΟΡΕΙΑΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
        "ΔΑΕΦΚ-ΔΕ": {
          name: "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΕΛΛΑΔΟΣ",
          prop: "τη",
        },
      };

      const unitInfo = unitMappings[String(unit)] || {
        name: String(unit),
        prop: "τη",
      };

      return {
        unit: String(unit),
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
   * Get staff/employee details from the database for document generation
   */
  public static async getStaffByUnit(unit: string): Promise<any[]> {
    try {
      logger.debug(`Fetching staff details for unit: ${unit}`);

      // Import database connection
      const { supabase } = await import("../config/db");

      // Fetch employees from database for the specific unit
      const { data: employees, error } = await supabase
        .from("Employees")
        .select("*")
        .eq("monada", unit);

      if (error) {
        logger.error("Error fetching staff from database:", error);
        return [];
      }

      logger.debug(
        `Found ${employees?.length || 0} staff members for unit: ${unit}`,
      );
      return employees || [];
    } catch (error) {
      logger.error("Error fetching staff details:", error);
      return [];
    }
  }

  /**
   * Get beneficiaries by unit from the database for document generation
   */
  public static async getBeneficiariesByUnit(unit: string): Promise<any[]> {
    try {
      logger.debug(`Fetching beneficiaries for unit: ${unit}`);

      // Import database connection
      const { supabase } = await import("../config/db");

      // Fetch beneficiaries from database for the specific unit
      const { data: beneficiaries, error } = await supabase
        .from("Beneficiaries")
        .select("*")
        .eq("monada", unit);

      if (error) {
        logger.error("Error fetching beneficiaries from database:", error);
        return [];
      }

      logger.debug(
        `Found ${beneficiaries?.length || 0} beneficiaries for unit: ${unit}`,
      );
      return beneficiaries || [];
    } catch (error) {
      logger.error("Error fetching beneficiaries:", error);
      return [];
    }
  }

  /**
   * Get project details from the database for document generation
   */
  public static async getProjectDetails(mis: string): Promise<any | null> {
    try {
      logger.debug(`Fetching project details for MIS: ${mis}`);

      // Import database connection
      const { supabase } = await import("../config/db");

      // Fetch project from database
      const { data: project, error } = await supabase
        .from("Projects")
        .select("*")
        .eq("mis", mis)
        .single();

      if (error) {
        logger.error("Error fetching project from database:", error);
        return null;
      }

      logger.debug(`Found project details for MIS: ${mis}`);
      return project;
    } catch (error) {
      logger.error("Error fetching project details:", error);
      return null;
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

      // Import database connection to fetch project data directly
      const { supabase } = await import("../config/db");

      // Try to fetch project by MIS first (if numeric)
      let project = null;
      let error = null;

      // Check if identifier looks like a MIS (numeric) or NA853 (alphanumeric with Greek letters)
      const isNumericMIS = /^\d+$/.test(String(misOrNA853));
      const isNA853Code = /^\d{4}[Ν|N][Α|A]\d+/.test(String(misOrNA853));

      if (isNumericMIS) {
        const result = await supabase
          .from("Projects")
          .select("*")
          .eq("mis", parseInt(String(misOrNA853)))
          .single();
        project = result.data;
        error = result.error;
      } else if (isNA853Code) {
        // If it's an NA853 code, search by budget_na853 field first
        const result = await supabase
          .from("Projects")
          .select("*")
          .eq("budget_na853", String(misOrNA853))
          .single();
        project = result.data;
        error = result.error;
      }

      if (project && !error) {
        logger.debug(`Found project by MIS: ${JSON.stringify(project)}`);

        // Use event_description as primary title (as seen in ProjectCard.tsx)
        if (project.event_description && project.event_description.trim()) {
          logger.debug(`Using event_description: ${project.event_description}`);
          return project.event_description.trim();
        }
        // Fallback to other title fields
        if (project.title && project.title.trim()) {
          logger.debug(`Using title: ${project.title}`);
          return project.title.trim();
        }
        if (project.project_title && project.project_title.trim()) {
          logger.debug(`Using project_title: ${project.project_title}`);
          return project.project_title.trim();
        }
        if (project.name && project.name.trim()) {
          logger.debug(`Using name: ${project.name}`);
          return project.name.trim();
        }

        logger.debug(`No usable title fields found in project data`);
      } else {
        logger.debug(
          `No project found by MIS or error occurred: ${error?.message}`,
        );
      }

      // If no project found yet, try alternative searches
      if (!project) {
        logger.debug(
          `Primary search failed, trying alternative methods for: ${misOrNA853}`,
        );

        // Try searching by different field combinations
        const searchQueries = [
          { field: "budget_na853", value: String(misOrNA853) },
          { field: "na853", value: String(misOrNA853) },
          { field: "project_na853", value: String(misOrNA853) },
          { field: "mis", value: String(misOrNA853) },
        ];

        for (const query of searchQueries) {
          try {
            const result = await supabase
              .from("Projects")
              .select("*")
              .eq(query.field, query.value)
              .single();

            if (result.data && !result.error) {
              project = result.data;
              logger.debug(
                `Found project using ${query.field}: ${JSON.stringify(project)}`,
              );
              break;
            }
          } catch (searchError) {
            logger.debug(`Search by ${query.field} failed: ${searchError}`);
            continue;
          }
        }
      }

      // Extract title from found project
      if (project) {
        // Use project_title as primary source (contains the full Greek governmental title)
        if (project.project_title && project.project_title.trim()) {
          logger.debug(`Using project_title: ${project.project_title}`);
          return project.project_title.trim();
        }
        // Fallback to event_description
        if (project.event_description && project.event_description.trim()) {
          logger.debug(`Using event_description: ${project.event_description}`);
          return project.event_description.trim();
        }
        // Other fallbacks
        if (project.title && project.title.trim()) {
          logger.debug(`Using title: ${project.title}`);
          return project.title.trim();
        }
        if (project.name && project.name.trim()) {
          logger.debug(`Using name: ${project.name}`);
          return project.name.trim();
        }

        logger.debug(`No usable title fields found in project data`);
      }

      // If no project found, return the MIS code as fallback
      logger.warn(`No project found for identifier: ${misOrNA853}`);
      return `Έργο MIS: ${misOrNA853}`;
    } catch (error) {
      logger.error("Error fetching project title:", error);
      return `Έργο MIS: ${misOrNA853}`;
    }
  }

  /**
   * Get project NA853 by MIS
   */
  public static async getProjectNA853(mis: string | number): Promise<string> {
    try {
      logger.debug(`Fetching project NA853 for MIS: ${mis}`);

      // Import database connection to fetch project data directly
      const { supabase } = await import("../config/db");

      // Check if identifier looks like a MIS (numeric) or NA853 (alphanumeric with Greek letters)
      const isNumericMIS = /^\d+$/.test(String(mis));
      const isNA853Code = /^\d{4}[Ν|N][Α|A]\d+/.test(String(mis));

      let project = null;

      if (isNumericMIS) {
        const result = await supabase
          .from("Projects")
          .select("budget_na853, na853")
          .eq("mis", parseInt(String(mis)))
          .single();
        project = result.data;
      } else if (isNA853Code) {
        // If it's already an NA853 code, return it
        logger.debug(`Input is already NA853 code: ${mis}`);
        return String(mis);
      } else {
        // Try searching by different fields
        const searchQueries = [
          { field: "budget_na853", value: String(mis) },
          { field: "na853", value: String(mis) },
          { field: "project_na853", value: String(mis) },
        ];

        for (const query of searchQueries) {
          try {
            const result = await supabase
              .from("Projects")
              .select("budget_na853, na853")
              .eq(query.field, query.value)
              .single();

            if (result.data && !result.error) {
              project = result.data;
              break;
            }
          } catch (searchError) {
            continue;
          }
        }
      }

      if (project) {
        // Prioritize budget_na853 field
        if (project.budget_na853 && project.budget_na853.trim()) {
          logger.debug(`Found budget_na853: ${project.budget_na853}`);
          return project.budget_na853.trim();
        }
        // Fallback to na853 field
        if (project.na853 && project.na853.trim()) {
          logger.debug(`Found na853: ${project.na853}`);
          return project.na853.trim();
        }
      }

      // Return default if not found
      logger.warn(`No NA853 found for identifier: ${mis}`);
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

  /**
   * Split a long title into multiple lines for better formatting
   * @param title The title to split
   * @returns Array of title lines
   */
  public static splitTitleIntoLines(title: string): string[] {
    // If title is short enough, return as single line
    if (title.length <= 40) {
      return [title];
    }

    // Common Greek title patterns to split appropriately
    const splitPatterns = [
      /^(.*?)(Ο\s+(?:ΑΝΑΠΛ\.|ΑΝΑΠΛΗΡΩΤΗΣ)\s+ΠΡΟΪΣΤΑΜΕΝΟΣ.*?)$/i,
      /^(.*?)(Ο\s+ΠΡΟΪΣΤΑΜΕΝΟΣ.*?)$/i,
      /^(.*?)(Η\s+(?:ΑΝΑΠΛ\.|ΑΝΑΠΛΗΡΩΤΡΙΑ)\s+ΠΡΟΪΣΤΑΜΕΝΗ.*?)$/i,
      /^(.*?)(Η\s+ΠΡΟΪΣΤΑΜΕΝΗ.*?)$/i,
    ];

    for (const pattern of splitPatterns) {
      const match = title.match(pattern);
      if (match && match[1] && match[2]) {
        return [match[1].trim(), match[2].trim()];
      }
    }

    // If no pattern matches, split at natural break points
    const words = title.split(" ");
    const midPoint = Math.ceil(words.length / 2);

    // Try to find a good break point around the middle
    let breakPoint = midPoint;
    for (let i = midPoint - 2; i <= midPoint + 2; i++) {
      if (i > 0 && i < words.length) {
        const word = words[i];
        // Break after prepositions or connecting words
        if (["ΤΗΣ", "ΤΟΥ", "ΚΑΙ", "ΜΕ"].includes(word.toUpperCase())) {
          breakPoint = i + 1;
          break;
        }
      }
    }

    const firstLine = words.slice(0, breakPoint).join(" ");
    const secondLine = words.slice(breakPoint).join(" ");

    return [firstLine, secondLine];
  }
}
