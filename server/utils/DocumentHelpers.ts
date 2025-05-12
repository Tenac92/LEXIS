/**
 * DocumentHelpers.ts
 * 
 * This file contains utility functions for document creation
 * that don't fit into other specific formatter categories.
 */

import {
  Paragraph,
  TextRun,
  AlignmentType,
  WidthType,
  HeadingLevel,
  BorderStyle,
  Document,
  Table,
  TableRow,
  TableCell,
  PageOrientation,
  PageNumber,
} from "docx";

import { safeString, safeNumber, safeTrimmedString } from "./SafeDataHelpers";
import { createLogger } from "./logger";

const logger = createLogger('DocumentHelpers');

/**
 * Creates a standard paragraph with text
 * @param text The text content
 * @param options Optional formatting options
 * @returns A Paragraph object
 */
export function createStandardParagraph(
  text: string,
  options: {
    alignment?: string;
    bold?: boolean;
    size?: number;
    spacing?: {
      before?: number;
      after?: number;
    };
  } = {}
): Paragraph {
  const {
    alignment = AlignmentType.LEFT,
    bold = false,
    size = 22,
    spacing = {
      before: 120,
      after: 120,
    },
  } = options;

  return new Paragraph({
    alignment,
    spacing,
    children: [
      new TextRun({
        text: safeString(text),
        bold,
        size,
      }),
    ],
  });
}

/**
 * Creates a document section with multiple paragraphs
 * @param title Section title
 * @param paragraphs Array of paragraph texts to include in the section
 * @returns Array of Paragraph objects
 */
export function createSection(
  title: string,
  paragraphs: string[]
): Paragraph[] {
  const result: Paragraph[] = [];
  
  // Add section title if provided
  if (title) {
    result.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 240,
          after: 120,
        },
        children: [
          new TextRun({
            text: safeString(title),
            bold: true,
            size: 24,
          }),
        ],
      })
    );
  }
  
  // Add all paragraphs
  paragraphs.forEach((text) => {
    if (text && text.trim()) {
      result.push(
        createStandardParagraph(text)
      );
    }
  });
  
  return result;
}

/**
 * Creates a signature section for the document
 * @param signatoryName Name of the person signing
 * @param signatoryTitle Position/title of the signatory
 * @param date Optional date of signature
 * @returns Array of Paragraph objects for the signature section
 */
export function createSignatureSection(
  signatoryName: string,
  signatoryTitle: string,
  date?: string
): Paragraph[] {
  const result: Paragraph[] = [];
  
  // Add spacing before signature
  result.push(new Paragraph({
    spacing: {
      before: 600,
      after: 240,
    }
  }));
  
  // Add signature date if provided
  if (date) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: safeString(date),
            size: 22,
          }),
        ],
      })
    );
  }
  
  // Add spacing for signature
  result.push(new Paragraph({
    spacing: {
      before: 480,
      after: 240,
    }
  }));
  
  // Add signatory name
  result.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: safeString(signatoryName),
          bold: true,
          size: 22,
        }),
      ],
    })
  );
  
  // Add signatory title
  if (signatoryTitle) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: safeString(signatoryTitle),
            size: 22,
          }),
        ],
      })
    );
  }
  
  return result;
}

/**
 * Creates an empty paragraph for spacing
 * @param spacing Number of spaces to add
 * @returns A Paragraph object with specified spacing
 */
export function createSpacingParagraph(spacing: number = 240): Paragraph {
  return new Paragraph({
    spacing: {
      before: spacing,
      after: 0,
    },
  });
}

/**
 * Creates document header with document number and date
 * @param documentNumber The protocol number for the document
 * @param date The date of the document
 * @returns A Paragraph object containing the header information
 */
export function createDocumentHeader(
  documentNumber: string,
  date: string
): Paragraph {
  const headerText = `Αρ. Πρωτ.: ${safeTrimmedString(documentNumber)}${
    documentNumber && date ? ', ' : ''
  }${safeTrimmedString(date)}`;

  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: headerText,
        size: 22,
      }),
    ],
    spacing: {
      before: 0,
      after: 400,
    },
  });
}

/**
 * Creates a formatted list from array items
 * @param items Array of list items
 * @param options Optional formatting options
 * @returns Array of Paragraph objects formatted as a list
 */
export function createFormattedList(
  items: string[],
  options: {
    bulletPoints?: boolean;
    numbered?: boolean;
  } = {}
): Paragraph[] {
  const { bulletPoints = false, numbered = false } = options;
  const result: Paragraph[] = [];
  
  if (!Array.isArray(items) || items.length === 0) {
    return result;
  }
  
  items.forEach((item, index) => {
    const prefix = 
      bulletPoints ? '• ' : 
      numbered ? `${index + 1}. ` : 
      '';
      
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: {
          left: 240,
          hanging: bulletPoints || numbered ? 240 : 0,
        },
        spacing: {
          before: 120,
          after: 120,
        },
        children: [
          new TextRun({
            text: `${prefix}${safeString(item)}`,
            size: 22,
          }),
        ],
      })
    );
  });
  
  return result;
}