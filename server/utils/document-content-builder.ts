/**
 * Document Content Builder - Creates structured document content sections
 * 
 * This module handles the creation of different document sections like headers,
 * subjects, main content, and footers with proper formatting and structure.
 */

import { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { DocumentUtilities } from "./document-utilities";
import { ExpenditureTypeHandler } from "./expenditure-type-handler";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentContentBuilder");

export class DocumentContentBuilder {
  
  /**
   * Create document header with logo and unit information
   */
  public static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null
  ): Promise<Paragraph[]> {
    logger.debug("Creating document header");
    
    const headerParagraphs: Paragraph[] = [];
    
    // Unit information
    if (unitDetails?.name) {
      headerParagraphs.push(
        DocumentUtilities.createCenteredParagraph(
          unitDetails.name,
          { bold: true, size: 20, spacing: 120 }
        )
      );
    }
    
    // Department/Unit details
    if (unitDetails?.unit) {
      headerParagraphs.push(
        DocumentUtilities.createCenteredParagraph(
          unitDetails.unit,
          { bold: true, size: 18, spacing: 240 }
        )
      );
    }
    
    return headerParagraphs;
  }

  /**
   * Create date and protocol section
   */
  public static createDateAndProtocol(documentData: DocumentData): Paragraph {
    logger.debug("Creating date and protocol section");
    
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
   * Create document subject line
   */
  public static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null
  ): Paragraph {
    logger.debug("Creating document subject");
    
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = ExpenditureTypeHandler.getExpenditureConfig(expenditureType);
    
    const subjectText = `ΘΕΜΑ: ${config.documentTitle || `Αίτημα χορήγησης - ${expenditureType}`}`;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: subjectText,
          bold: true,
          underline: {},
          size: DocumentUtilities.DEFAULT_FONT_SIZE,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 },
    });
  }

  /**
   * Create main content section
   */
  public static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails | null
  ): Paragraph[] {
    logger.debug("Creating main content section");
    
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
    
    // Main request text
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const mainText = this.getMainContentText(expenditureType);
    
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
   * Get main content text based on expenditure type
   */
  private static getMainContentText(expenditureType: string): string {
    const config = ExpenditureTypeHandler.getExpenditureConfig(expenditureType);
    
    switch (expenditureType) {
      case "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ":
        return "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την επιδότηση ενοικίου για τους κατωτέρω δικαιούχους:";
      
      case "ΕΚΤΟΣ ΕΔΡΑΣ":
        return "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την αποζημίωση εκτός έδρας για τους κατωτέρω υπαλλήλους:";
      
      case "ΔΚΑ ΕΠΙΣΚΕΥΗ":
      case "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ":
        return "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε τη δόση του δανείου για τους κατωτέρω δικαιούχους:";
      
      default:
        return "Παρακαλούμε όπως εγκρίνετε και εξοφλήσετε την παρακάτω δαπάνη για τους κατωτέρω δικαιούχους:";
    }
  }

  /**
   * Get project title from project data
   */
  public static getProjectTitle(projectMis: string): string {
    // This would typically fetch from database
    // For now, return a formatted title
    return `Έργο ${projectMis}`;
  }

  /**
   * Get project NA853 code
   */
  public static getProjectNA853(projectMis: string): string {
    // This would typically fetch from database
    // For now, return the MIS as NA853
    return projectMis;
  }

  /**
   * Create signature and approval section
   */
  public static createSignatureSection(
    documentData: DocumentData,
    unitDetails: UnitDetails | null
  ): Table {
    logger.debug("Creating signature section");
    
    const leftColumnParagraphs: Paragraph[] = [];
    const rightColumnParagraphs = DocumentUtilities.createManagerSignatureParagraphs(unitDetails?.manager);
    
    // Add approval text
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
    
    return DocumentUtilities.createBorderlessTable([
      new TableRow({
        children: [
          DocumentUtilities.createBorderlessCell(leftColumnParagraphs),
          DocumentUtilities.createBorderlessCell(rightColumnParagraphs),
        ],
      }),
    ], [50, 50]);
  }
}