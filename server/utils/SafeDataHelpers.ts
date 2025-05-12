/**
 * SafeDataHelpers.ts
 * 
 * This file contains utility functions for safely handling data,
 * especially when dealing with potential null or undefined values.
 */

/**
 * Safely gets a string value, with fallback to empty string or provided default
 * @param value The string value that might be null or undefined
 * @param defaultValue Optional default value if not provided (empty string by default)
 * @returns The string value or default value
 */
export function safeString(value: string | null | undefined, defaultValue: string = ''): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
}

/**
 * Safely gets a trimmed string value
 * @param value The string value that might be null or undefined
 * @param defaultValue Optional default value if not provided (empty string by default)
 * @returns The trimmed string value or default value
 */
export function safeTrimmedString(value: string | null | undefined, defaultValue: string = ''): string {
  const stringValue = safeString(value, defaultValue);
  return stringValue.trim();
}

/**
 * Safely gets a number value, with fallback to zero or provided default
 * @param value The number value that might be null, undefined, or a string
 * @param defaultValue Optional default value if not provided (0 by default)
 * @returns The number value or default value
 */
export function safeNumber(value: number | string | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  // Handle string numbers
  if (typeof value === 'string') {
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }
  
  // Handle number values that might be NaN
  return isNaN(value) ? defaultValue : value;
}

/**
 * Safely gets a date string in format YYYY-MM-DD
 * @param date The date value (Date object, ISO string, timestamp)
 * @param defaultValue Optional default value if date is invalid
 * @returns Formatted date string or default value
 */
export function safeDateString(
  date: Date | string | number | null | undefined, 
  defaultValue: string = ''
): string {
  if (date === null || date === undefined) {
    return defaultValue;
  }
  
  let dateObject: Date;
  
  try {
    if (date instanceof Date) {
      dateObject = date;
    } else if (typeof date === 'string') {
      dateObject = new Date(date);
    } else if (typeof date === 'number') {
      dateObject = new Date(date);
    } else {
      return defaultValue;
    }
    
    // Check if date is valid
    if (isNaN(dateObject.getTime())) {
      return defaultValue;
    }
    
    // Format as YYYY-MM-DD
    return dateObject.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date:', error);
    return defaultValue;
  }
}

/**
 * Safely formats a number as currency (euro)
 * @param amount The number to format
 * @param locale The locale to use for formatting (default: el-GR)
 * @returns Formatted currency string
 */
export function safeEuroFormat(amount: number | string | null | undefined): string {
  const amountValue = safeNumber(amount);
  
  try {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amountValue);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${amountValue} €`;
  }
}

/**
 * Safely checks if a value has meaningful content
 * @param value The value to check
 * @returns true if the value exists and is not empty, false otherwise
 */
export function hasContent(value: string | null | undefined): boolean {
  return !!value && value.trim() !== '';
}

/**
 * Safely join recipient name parts together
 * @param lastname Lastname of the recipient
 * @param firstname Firstname of the recipient
 * @param fathername Optional father's name
 * @returns Formatted full name
 */
export function formatRecipientName(
  lastname: string | null | undefined,
  firstname: string | null | undefined,
  fathername?: string | null | undefined
): string {
  const safeLastname = safeTrimmedString(lastname);
  const safeFirstname = safeTrimmedString(firstname);
  const safeFathername = safeTrimmedString(fathername);
  
  if (!safeLastname && !safeFirstname) {
    return '';
  }
  
  if (!hasContent(safeFathername)) {
    return `${safeLastname} ${safeFirstname}`.trim();
  }
  
  return `${safeLastname} ${safeFirstname} ΤΟΥ ${safeFathername}`.trim();
}