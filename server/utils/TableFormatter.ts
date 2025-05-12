/**
 * TableFormatter.ts
 * 
 * This file contains utility functions for creating and formatting tables
 * in document generation. It's designed to work with the docx library.
 */

import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  BorderStyle,
  WidthType,
  HeightRule,
  AlignmentType,
  VerticalAlign,
  VerticalMergeType,
} from "docx";
import { safeString, safeNumber, safeEuroFormat } from "./SafeDataHelpers";

/**
 * Standard table borders configuration
 */
export const DEFAULT_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "auto" },
};

/**
 * No borders configuration
 */
export const NO_BORDERS = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};

/**
 * Creates a table cell with text content
 * @param text The text content for the cell
 * @param options Optional configuration options
 * @returns A TableCell object
 */
export function createTextCell(
  text: string,
  options: {
    width?: number;
    widthType?: number;
    bold?: boolean;
    alignment?: typeof AlignmentType[keyof typeof AlignmentType];
    borders?: any;
    verticalAlign?: typeof VerticalAlign[keyof typeof VerticalAlign];
    verticalMerge?: "restart" | "continue";
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
  } = {}
): TableCell {
  const {
    width = 100,
    widthType = WidthType.PERCENTAGE,
    bold = false,
    alignment = AlignmentType.LEFT,
    borders = DEFAULT_BORDERS,
    verticalAlign = VerticalAlign.CENTER,
    verticalMerge,
    margins,
  } = options;

  const cellOptions: any = {
    width: { size: width, type: widthType },
    borders,
    verticalAlign,
    children: [
      new Paragraph({
        alignment: typeof alignment === 'string' ? AlignmentType.LEFT : alignment,
        children: [
          new TextRun({
            text: safeString(text),
            bold,
          }),
        ],
      }),
    ],
  };

  // Add optional properties if they're specified
  if (margins) {
    cellOptions.margins = margins;
  }

  if (verticalMerge) {
    cellOptions.verticalMerge =
      verticalMerge === "restart"
        ? VerticalMergeType.RESTART
        : VerticalMergeType.CONTINUE;
  }

  return new TableCell(cellOptions);
}

/**
 * Creates a table cell with a paragraph
 * @param paragraph The paragraph object to include in the cell
 * @param options Optional configuration options
 * @returns A TableCell object
 */
export function createParagraphCell(
  paragraph: Paragraph,
  options: {
    width?: number;
    widthType?: number;
    borders?: any;
    verticalAlign?: string;
    verticalMerge?: "restart" | "continue";
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
  } = {}
): TableCell {
  const {
    width = 100,
    widthType = WidthType.PERCENTAGE,
    borders = DEFAULT_BORDERS,
    verticalAlign = VerticalAlign.CENTER,
    verticalMerge,
    margins,
  } = options;

  const cellOptions: any = {
    width: { size: width, type: widthType },
    borders,
    verticalAlign,
    children: [paragraph],
  };

  // Add optional properties if they're specified
  if (margins) {
    cellOptions.margins = margins;
  }

  if (verticalMerge) {
    cellOptions.verticalMerge =
      verticalMerge === "restart"
        ? VerticalMergeType.RESTART
        : VerticalMergeType.CONTINUE;
  }

  return new TableCell(cellOptions);
}

/**
 * Creates a table row with specified height
 * @param cells Array of TableCell objects
 * @param height Optional height for the row
 * @returns A TableRow object
 */
export function createTableRow(
  cells: TableCell[],
  height?: number
): TableRow {
  const rowOptions: any = {
    children: cells,
  };

  if (height) {
    rowOptions.height = {
      value: height,
      rule: HeightRule.ATLEAST,
    };
  }

  return new TableRow(rowOptions);
}

/**
 * Creates a formatted currency cell
 * @param amount The amount to format
 * @param options Optional configuration options
 * @returns A TableCell with formatted currency
 */
export function createCurrencyCell(
  amount: number | string,
  options: {
    width?: number;
    bold?: boolean;
    alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  } = {}
): TableCell {
  const {
    width = 20,
    bold = false,
    alignment = AlignmentType.RIGHT as AlignmentType,
  } = options;

  const numericAmount = safeNumber(amount);
  const formattedAmount = safeEuroFormat(numericAmount);

  return createTextCell(formattedAmount, {
    width,
    bold,
    alignment: typeof alignment === 'string' ? AlignmentType.RIGHT : alignment,
  });
}

/**
 * Creates a header row for tables
 * @param headers Array of header text values 
 * @param columnWidths Array of column widths (percentages)
 * @returns A TableRow with header cells
 */
export function createHeaderRow(
  headers: string[],
  columnWidths: number[] = []
): TableRow {
  // Use equal widths if not specified
  const widths = columnWidths.length > 0 
    ? columnWidths 
    : headers.map(() => 100 / headers.length);
  
  const cells = headers.map((header, index) => 
    createTextCell(header, {
      width: widths[index] || 100 / headers.length,
      bold: true,
      alignment: AlignmentType.CENTER,
    })
  );
  
  return createTableRow(cells, 400);
}