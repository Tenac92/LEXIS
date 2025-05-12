/**
 * RecipientFormatter.ts
 * 
 * This file contains functions specifically for handling recipient data
 * in document generation, with careful handling of null/undefined values.
 */

import { 
  safeString,
  safeNumber,
  safeEuroFormat,
  formatRecipientName
} from "./SafeDataHelpers";
import {
  createTableRow,
  createTextCell,
  createCurrencyCell
} from "./TableFormatter";
import { TableRow, AlignmentType } from "docx";

/**
 * Recipient data interface with optional properties
 * to ensure safe handling of potentially incomplete data
 */
export interface RecipientData {
  firstname?: string;
  lastname?: string;
  fathername?: string;
  afm?: string;
  amount?: number | string;
  installment?: number | string;
  installments?: string[];
  installmentAmounts?: Record<string, number>;
  secondary_text?: string;
}

/**
 * Safely calculates the total amount from a list of recipients
 * @param recipients Array of recipient data
 * @returns The total amount as a number
 */
export function calculateTotalAmount(recipients: RecipientData[]): number {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return 0;
  }

  return recipients.reduce((sum, recipient) => {
    return sum + safeNumber(recipient.amount);
  }, 0);
}

/**
 * Creates a table row for a recipient in the standard format
 * @param recipient The recipient data
 * @param index The index of the recipient (for numbering)
 * @returns A TableRow representing the recipient
 */
export function createRecipientTableRow(
  recipient: RecipientData,
  index: number
): TableRow {
  // Safely extract values with defaults
  const firstname = safeString(recipient.firstname);
  const lastname = safeString(recipient.lastname);
  const fathername = safeString(recipient.fathername);
  const afm = safeString(recipient.afm);
  const amount = safeNumber(recipient.amount);
  
  // Format the recipient name based on available data
  const fullName = formatRecipientName(lastname, firstname, fathername);
  
  // Create the row number as a string
  const rowNumber = `${index + 1}.`;

  return createTableRow([
    // Row number column
    createTextCell(rowNumber, { 
      width: 5, 
      alignment: AlignmentType.CENTER
    }),
    
    // Recipient name column
    createTextCell(fullName, { 
      width: 40
    }),
    
    // AFM column
    createTextCell(afm, { 
      width: 15, 
      alignment: AlignmentType.CENTER
    }),
    
    // Amount column
    createCurrencyCell(amount, { 
      width: 20, 
      alignment: AlignmentType.RIGHT 
    })
  ]);
}

/**
 * Creates table rows for recipients with installment information
 * @param recipient The recipient data 
 * @param index The index of the recipient
 * @returns An array of TableRow objects (one or more per recipient)
 */
export function createDetailedRecipientRows(
  recipient: RecipientData,
  index: number
): TableRow[] {
  const rows: TableRow[] = [];
  const firstname = safeString(recipient.firstname);
  const lastname = safeString(recipient.lastname);
  const fathername = safeString(recipient.fathername);
  const afm = safeString(recipient.afm);
  
  // Format the recipient name based on available data
  const fullName = formatRecipientName(lastname, firstname, fathername);
  
  // Create the row number as a string
  const rowNumber = `${index + 1}.`;
  
  // Process installments
  let installments: string[] = [];
  
  if (Array.isArray(recipient.installments) && recipient.installments.length > 0) {
    installments = recipient.installments;
  } else if (recipient.installment) {
    // Use the single installment value
    installments = [String(recipient.installment)];
  } else {
    // Default to a single installment
    installments = ["1"];
  }
  
  // Use installment amounts if available, otherwise use the main amount
  const installmentAmounts = recipient.installmentAmounts || {};
  
  // Generate a row for each installment
  installments.forEach((installment, idx) => {
    // Get amount for this installment, falling back to total amount
    const amount = installmentAmounts[installment] || recipient.amount || 0;
    
    // For the first row, include recipient details
    if (idx === 0) {
      rows.push(createTableRow([
        // Row number column
        createTextCell(rowNumber, { 
          width: 5, 
          alignment: AlignmentType.CENTER
        }),
        
        // Recipient name column
        createTextCell(fullName, { 
          width: 30
        }),
        
        // AFM column
        createTextCell(afm, { 
          width: 15, 
          alignment: AlignmentType.CENTER
        }),
        
        // Installment column
        createTextCell(installment, {
          width: 10,
          alignment: AlignmentType.CENTER
        }),
        
        // Amount column
        createCurrencyCell(amount, { 
          width: 20, 
          alignment: AlignmentType.RIGHT 
        })
      ]));
    } else {
      // For subsequent rows, just show installment information
      rows.push(createTableRow([
        // Empty row number column
        createTextCell("", { 
          width: 5
        }),
        
        // Empty recipient column
        createTextCell("", { 
          width: 30
        }),
        
        // Empty AFM column
        createTextCell("", { 
          width: 15
        }),
        
        // Installment column
        createTextCell(installment, {
          width: 10,
          alignment: AlignmentType.CENTER
        }),
        
        // Amount column
        createCurrencyCell(amount, { 
          width: 20, 
          alignment: AlignmentType.RIGHT 
        })
      ]));
    }
  });
  
  return rows;
}