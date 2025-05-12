/**
 * HeaderFormatter.ts
 * 
 * This file contains utility functions for creating document headers
 * with proper formatting and consistent styling.
 */

import {
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

import { safeString } from "./SafeDataHelpers";
import { createLogger } from "./logger";

const logger = createLogger('HeaderFormatter');

// Define type-level constants for proper type checking
type AlignmentTypeValue = typeof AlignmentType[keyof typeof AlignmentType];
type HeadingLevelValue = typeof HeadingLevel[keyof typeof HeadingLevel];

/**
 * Creates a document title paragraph with proper styling
 * @param text Title text
 * @param options Optional formatting options
 * @returns A Paragraph object with title formatting
 */
export function createTitleParagraph(
  text: string,
  options: {
    alignment?: AlignmentTypeValue;
    bold?: boolean;
    heading?: HeadingLevelValue;
    spacing?: number;
  } = {}
): Paragraph {
  const {
    alignment = AlignmentType.CENTER,
    bold = true,
    heading = HeadingLevel.HEADING_1,
    spacing = 400
  } = options;

  logger.debug(`Creating title paragraph with text: ${text}`);
  
  return new Paragraph({
    alignment: typeof alignment === 'string' ? AlignmentType.CENTER : alignment,
    heading: typeof heading === 'string' ? HeadingLevel.HEADING_1 : heading,
    spacing: {
      before: spacing,
      after: spacing,
    },
    children: [
      new TextRun({
        text: safeString(text),
        bold,
        size: 28,
      }),
    ],
  });
}

/**
 * Creates a header paragraph (typically for sub-headings)
 * @param text Header text
 * @param options Optional formatting options
 * @returns A Paragraph object with header formatting
 */
export function createHeaderParagraph(
  text: string,
  options: {
    alignment?: AlignmentTypeValue;
    bold?: boolean;
    heading?: HeadingLevelValue;
    spacing?: number;
    size?: number;
  } = {}
): Paragraph {
  const {
    alignment = AlignmentType.LEFT,
    bold = true,
    heading = HeadingLevel.HEADING_2,
    spacing = 240,
    size = 24
  } = options;
  
  return new Paragraph({
    alignment,
    heading,
    spacing: {
      before: spacing,
      after: spacing,
    },
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
 * Creates a document letterhead with information about the issuing organization
 * @param departmentName Name of the department/organization
 * @param unitName Name of the specific unit within the organization
 * @param location Location (city, country) 
 * @param date Date of the document
 * @returns An array of Paragraph objects for the letterhead
 */
export function createLetterhead(
  departmentName: string,
  unitName: string,
  location: string,
  date: string
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Organization logo or name
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: safeString(departmentName).toUpperCase(),
          bold: true,
          size: 20,
        }),
      ],
    })
  );
  
  // Unit or department name
  if (unitName) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: safeString(unitName),
            bold: true,
            size: 18,
          }),
        ],
      })
    );
  }
  
  // Add some spacing
  paragraphs.push(new Paragraph({}));
  
  // Location and date in right alignment
  if (location || date) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `${safeString(location)}${location && date ? ', ' : ''}${safeString(date)}`,
            size: 20,
          }),
        ],
      })
    );
  }
  
  // Add some spacing
  paragraphs.push(new Paragraph({}));
  
  return paragraphs;
}

/**
 * Creates a document footer with page numbers and additional info
 * @param additionalText Optional text to include in the footer
 * @returns A Paragraph object formatted as a footer
 */
export function createFooter(additionalText?: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: additionalText ? safeString(additionalText) : "",
        size: 16,
      }),
    ],
  });
}