/**
 * Document Generation - Main entry point for all document generation
 * 
 * This module handles the generation of various document types including:
 * - Primary documents (main request documents)
 * - Secondary documents (detailed recipient lists)
 * - Correction documents (orthi epanalipsi)
 */

import { PrimaryDocumentFormatter } from "./primary-document-formatter";
import { SecondaryDocumentFormatter } from "./secondary-document-formatter";
import { DocumentData } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentGeneration");

export class DocumentGeneration {
  /**
   * Generate the primary document (main request document)
   */
  public static async generatePrimaryDocument(documentData: DocumentData): Promise<Buffer> {
    logger.debug("Generating primary document for:", documentData.id);
    return PrimaryDocumentFormatter.generateDocument(documentData);
  }

  /**
   * Generate the secondary document (detailed recipient list with retention info)
   */
  public static async generateSecondaryDocument(documentData: DocumentData): Promise<Buffer> {
    logger.debug("Generating secondary document for:", documentData.id);
    return SecondaryDocumentFormatter.generateSecondDocument(documentData);
  }

  /**
   * Format orthi epanalipsi document (correction/resubmission)
   */
  public static async generateCorrectionDocument(data: {
    comments: string;
    originalDocument: DocumentData;
    project_id: string;
    project_na853: string;
    protocol_number_input: string;
    protocol_date: string;
    unit: string;
    expenditure_type: string;
    recipients: Array<{
      firstname: string;
      lastname: string;
      fathername?: string;
      afm: string;
      amount: number;
      installment: number | string;
      installments?: string[];
      installmentAmounts?: Record<string, number>;
    }>;
    total_amount: number;
    id?: number;
  }): Promise<Buffer> {
    logger.debug("Generating correction document for project:", data.project_id);
    
    // Convert the data to DocumentData format
    const documentData: DocumentData = {
      id: data.id || 0,
      unit: data.unit,
      project_id: data.project_id,
      project_na853: data.project_na853,
      expenditure_type: data.expenditure_type,
      status: 'correction',
      total_amount: data.total_amount,
      protocol_number_input: data.protocol_number_input,
      protocol_date: data.protocol_date,
      recipients: data.recipients,
      comments: data.comments
    };

    return this.generatePrimaryDocument(documentData);
  }

  /**
   * Generate both primary and secondary documents
   * @param documentData Document data
   * @returns Object containing both document buffers
   */
  public static async generateBothDocuments(documentData: DocumentData): Promise<{
    primary: Buffer;
    secondary: Buffer;
  }> {
    logger.debug("Generating both documents for:", documentData.id);
    
    const [primary, secondary] = await Promise.all([
      this.generatePrimaryDocument(documentData),
      this.generateSecondaryDocument(documentData)
    ]);

    return { primary, secondary };
  }
}

// Maintain backward compatibility
export class DocumentFormatter extends DocumentGeneration {
  public static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    return this.generatePrimaryDocument(documentData);
  }

  public static async generateSecondDocument(documentData: DocumentData): Promise<Buffer> {
    return this.generateSecondaryDocument(documentData);
  }

  public static async formatOrthiEpanalipsi(data: any): Promise<Buffer> {
    return this.generateCorrectionDocument(data);
  }
}