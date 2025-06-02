/**
 * Document Core - Essential document generation functionality
 * 
 * This file contains the core document generation logic with expenditure type handling
 * for Greek government documents.
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
  HeightRule
} from "docx";
import { DocumentUtilities } from "./document-utilities";
import { ExpenditureTypeHandler } from "./expenditure-type-handler";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentCore");

export class DocumentCore {
  
  /**
   * Generate primary document
   */
  public static async generatePrimaryDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);
      
      // Get unit details
      const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
      
      // Create document sections
      const children: Paragraph[] = [
        // Header
        ...this.createHeader(unitDetails),
        
        // Date and protocol
        this.createDateAndProtocol(documentData),
        
        // Subject
        this.createSubject(documentData),
        
        // Main content
        ...this.createMainContent(documentData),
        
        // Payment table
        this.createPaymentTable(documentData.recipients || [], documentData.expenditure_type),
        
        // Note
        ExpenditureTypeHandler.createNoteForExpenditureType(documentData.expenditure_type),
        
        // Special instructions
        ...ExpenditureTypeHandler.createSpecialInstructions(documentData.expenditure_type),
      ];

      // Add footer
      children.push(this.createFooter(documentData, unitDetails));

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
   * Create document header
   */
  private static createHeader(unitDetails: UnitDetails | null): Paragraph[] {
    const headerParagraphs: Paragraph[] = [];
    
    if (unitDetails?.name) {
      headerParagraphs.push(
        DocumentUtilities.createCenteredParagraph(
          unitDetails.name,
          { bold: true, size: 20, spacing: 120 }
        )
      );
    }
    
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
   * Create document subject
   */
  private static createSubject(documentData: DocumentData): Paragraph {
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
   * Create payment table
   */
  private static createPaymentTable(recipients: any[], expenditureType: string): Table {
    const columns = ExpenditureTypeHandler.getPaymentTableColumns(expenditureType);
    const borderStyle = BorderStyle.SINGLE;
    
    const headerCells = columns.map(column => 
      new TableCell({
        children: [DocumentUtilities.createCenteredParagraph(column, { bold: true, size: 20 })],
        width: { size: 100 / columns.length, type: WidthType.PERCENTAGE },
        shading: { fill: "E6E6E6" },
        borders: {
          top: { style: borderStyle, size: 1 },
          bottom: { style: borderStyle, size: 1 },
          left: { style: borderStyle, size: 1 },
          right: { style: borderStyle, size: 1 },
        },
      })
    );

    const rows = [new TableRow({ children: headerCells, tableHeader: true })];

    recipients.forEach((recipient, index) => {
      const rowData = ExpenditureTypeHandler.formatRecipientForTable(recipient, expenditureType);
      const cells = rowData.map(cellData => 
        new TableCell({
          children: [DocumentUtilities.createCenteredParagraph(cellData, { size: 18 })],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        })
      );
      rows.push(new TableRow({ children: cells }));
    });

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: "autofit",
    });
  }

  /**
   * Create footer with signature
   */
  private static createFooter(documentData: DocumentData, unitDetails: UnitDetails | null): Paragraph {
    const leftColumnParagraphs: Paragraph[] = [];
    const rightColumnParagraphs = DocumentUtilities.createManagerSignatureParagraphs(unitDetails?.manager);
    
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