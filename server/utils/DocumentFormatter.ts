import { PrimaryDocumentFormatter } from "./primary-document-formatter";
import { SecondaryDocumentFormatter } from "./secondary-document-formatter";
import { DocumentData } from "./document-types";

/**
 * DocumentFormatter - Main entry point for document generation
 * This class acts as a wrapper that delegates to specialized formatters
 */
export class DocumentFormatter {
  /**
   * Generate the primary document (main request document)
   */
  public static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    return PrimaryDocumentFormatter.generateDocument(documentData);
  }

  /**
   * Generate the secondary document (detailed recipient list with retention info)
   */
  public static async generateSecondDocument(documentData: DocumentData): Promise<Buffer> {
    return SecondaryDocumentFormatter.generateSecondDocument(documentData);
  }

  /**
   * Format orthi epanalipsi document (correction/resubmission)
   * This method maintains backward compatibility with DocumentManager
   */
  public static async formatOrthiEpanalipsi(data: {
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
    // Convert the data to DocumentData format
    const documentData: DocumentData = {
      id: data.id || data.originalDocument.id,
      unit: data.unit,
      project_id: data.project_id,
      project_na853: data.project_na853,
      expenditure_type: data.expenditure_type,
      protocol_number: data.protocol_number_input,
      protocol_number_input: data.protocol_number_input,
      protocol_date: data.protocol_date,
      user_name: data.originalDocument.user_name,
      department: data.originalDocument.department,
      contact_number: data.originalDocument.contact_number,
      generated_by: data.originalDocument.generated_by,
      attachments: data.originalDocument.attachments,
      recipients: data.recipients.map((r) => ({
        ...r,
        fathername: r.fathername || "",
      })),
      total_amount: data.total_amount,
    };

    // Delegate to the primary document formatter
    return PrimaryDocumentFormatter.generateDocument(documentData);
  }
}

// Export types for backward compatibility
export type { DocumentData, UserDetails, UnitDetails } from "./document-types";