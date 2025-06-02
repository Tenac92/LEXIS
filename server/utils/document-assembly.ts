/**
 * Document Assembly - Orchestrates the complete document generation process
 * 
 * This module coordinates all document components to create complete documents,
 * handling the assembly of headers, content, tables, and footers into final documents.
 */

import { Document, Packer, Paragraph, Section } from "docx";
import { DocumentData, UnitDetails } from "./document-types";
import { DocumentContentBuilder } from "./document-content-builder";
import { DocumentUtilities } from "./document-utilities";
import { ExpenditureTypeHandler } from "./expenditure-type-handler";
import { PrimaryDocumentFormatter } from "./primary-document-formatter";
import { createLogger } from "./logger";

const logger = createLogger("DocumentAssembly");

export class DocumentAssembly {
  
  /**
   * Assemble a complete primary document
   */
  public static async assemblePrimaryDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Assembling primary document for:", documentData.id);

      // Get unit details
      const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
      
      // Enrich document data with project information
      const enrichedDocumentData = await this.enrichDocumentData(documentData);
      
      // Create document sections
      const sections: Section[] = [
        {
          properties: {
            page: {
              margin: DocumentUtilities.DOCUMENT_MARGINS,
            },
          },
          children: [
            // Header
            ...await DocumentContentBuilder.createDocumentHeader(
              enrichedDocumentData,
              unitDetails,
            ),
            
            // Date and protocol
            DocumentContentBuilder.createDateAndProtocol(enrichedDocumentData),
            
            // Subject
            DocumentContentBuilder.createDocumentSubject(
              enrichedDocumentData,
              unitDetails,
            ),
            
            // Main content
            ...DocumentContentBuilder.createMainContent(
              enrichedDocumentData,
              unitDetails,
            ),
            
            // Payment table
            PrimaryDocumentFormatter.createPaymentTable(
              documentData.recipients || [], 
              documentData.expenditure_type
            ),
            
            // Note specific to expenditure type
            ExpenditureTypeHandler.createNoteForExpenditureType(
              documentData.expenditure_type
            ),
            
            // Special instructions if needed
            ...ExpenditureTypeHandler.createSpecialInstructions(
              documentData.expenditure_type
            ),
            
            // Footer with attachments and signature
            PrimaryDocumentFormatter.createFooter(enrichedDocumentData, unitDetails),
          ],
        },
      ];

      const doc = new Document({
        sections,
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
      logger.error("Error assembling primary document:", error);
      throw error;
    }
  }

  /**
   * Enrich document data with additional project information
   */
  private static async enrichDocumentData(documentData: DocumentData): Promise<DocumentData> {
    const projectMis = documentData.project_id;
    
    if (!projectMis) {
      return documentData;
    }

    // Get project details (would typically fetch from database)
    const projectTitle = DocumentContentBuilder.getProjectTitle(projectMis);
    const projectNA853 = DocumentContentBuilder.getProjectNA853(projectMis);
    
    return {
      ...documentData,
      project_na853: projectNA853 || documentData.project_na853,
      // Add any additional enriched data here
    };
  }

  /**
   * Validate document data before assembly
   */
  public static validateDocumentData(documentData: DocumentData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!documentData.unit) {
      errors.push("Unit is required");
    }

    if (!documentData.expenditure_type) {
      errors.push("Expenditure type is required");
    }

    if (!documentData.recipients || documentData.recipients.length === 0) {
      errors.push("At least one recipient is required");
    }

    // Validate recipients
    if (documentData.recipients) {
      documentData.recipients.forEach((recipient, index) => {
        if (!recipient.firstname) {
          errors.push(`Recipient ${index + 1}: First name is required`);
        }
        if (!recipient.lastname) {
          errors.push(`Recipient ${index + 1}: Last name is required`);
        }
        if (!recipient.afm) {
          errors.push(`Recipient ${index + 1}: AFM is required`);
        }
        if (!recipient.amount || recipient.amount <= 0) {
          errors.push(`Recipient ${index + 1}: Valid amount is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get document preview information
   */
  public static getDocumentPreview(documentData: DocumentData): {
    title: string;
    expenditureType: string;
    recipientCount: number;
    totalAmount: number;
    requiresSpecialFormatting: boolean;
  } {
    const config = ExpenditureTypeHandler.getExpenditureConfig(documentData.expenditure_type);
    const totalAmount = documentData.recipients?.reduce((sum, recipient) => sum + recipient.amount, 0) || 0;
    
    return {
      title: config.documentTitle || `Document for ${documentData.expenditure_type}`,
      expenditureType: documentData.expenditure_type,
      recipientCount: documentData.recipients?.length || 0,
      totalAmount,
      requiresSpecialFormatting: config.requiresSpecialFormatting
    };
  }
}