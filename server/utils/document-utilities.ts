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

const logger = createLogger("DocumentUtilities");

export class DocumentUtilities {
  public static readonly DEFAULT_FONT_SIZE = 22;
  public static readonly DEFAULT_FONT = "Calibri";
  public static readonly DEFAULT_MARGINS = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  public static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

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

  /**
   * Create a bold paragraph with specified text
   */
  public static createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 18,
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
   * Create manager signature paragraphs for document signatures
   */
  public static createManagerSignatureParagraphs(managerInfo?: any): Paragraph[] {
    const rightColumnParagraphs: Paragraph[] = [];

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.order || "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
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
        spacing: { after: 480 },
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
        spacing: { after: 120 },
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
      spacing: { after: 120 },
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
    } = {}
  ): Paragraph {
    const {
      bold = false,
      underline = false,
      size = this.DEFAULT_FONT_SIZE,
      spacing = 120
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
   * Create a table with no borders
   */
  public static createBorderlessTable(
    rows: TableRow[],
    columnWidths?: number[]
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
    verticalAlign: typeof VerticalAlign.TOP = VerticalAlign.TOP
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

  /**
   * Get unit details from the database or API
   */
  public static async getUnitDetails(unit: string): Promise<any> {
    try {
      logger.debug(`Fetching unit details for: ${unit}`);
      
      // This would typically fetch from database or API
      // For now, return a basic structure
      return {
        unit,
        name: `Unit ${unit}`,
        manager: {
          name: "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
          order: "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
          title: "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
          degree: "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β."
        }
      };
    } catch (error) {
      logger.error("Error fetching unit details:", error);
      throw error;
    }
  }

  /**
   * Get project title by MIS or NA853
   */
  public static async getProjectTitle(misOrNA853: string | number): Promise<string> {
    try {
      logger.debug(`Fetching project title for: ${misOrNA853}`);
      
      // Import storage to fetch project data
      const { storage } = await import("../storage");
      
      // Try to fetch from projects by MIS first
      if (typeof misOrNA853 === 'number' || !isNaN(Number(misOrNA853))) {
        const projects = await storage.getProjectsByUnit(""); // Get all projects
        const project = projects.find(p => p.mis === Number(misOrNA853));
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
      const project = projects.find(p => p.mis === Number(mis));
      
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

  /**
   * Format currency amount for Greek documents
   */
  public static formatCurrency(amount: number): string {
    try {
      // Format with Greek number formatting (comma as thousands separator, period as decimal)
      return new Intl.NumberFormat('el-GR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      logger.error("Error formatting currency:", error);
      return `${amount.toFixed(2)} €`;
    }
  }
}