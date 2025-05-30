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
}

// Export types for backward compatibility
export type { DocumentData, UserDetails, UnitDetails } from "./document-types";