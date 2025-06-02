/**
 * Data Helpers - Utilities for safe data handling and manipulation
 * 
 * This module provides utility functions for safely handling data,
 * especially when dealing with potential null or undefined values,
 * and common data transformations.
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
 * Safely gets an integer value
 * @param value The value that might be null, undefined, or a string
 * @param defaultValue Optional default value if not provided (0 by default)
 * @returns The integer value or default value
 */
export function safeInteger(value: number | string | null | undefined, defaultValue: number = 0): number {
  const num = safeNumber(value, defaultValue);
  return Math.floor(num);
}

/**
 * Safely gets a boolean value
 * @param value The value that might be null, undefined, or a string
 * @param defaultValue Optional default value if not provided (false by default)
 * @returns The boolean value or default value
 */
export function safeBoolean(value: boolean | string | null | undefined, defaultValue: boolean = false): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  return Boolean(value);
}

/**
 * Safely gets an array value
 * @param value The value that might be null, undefined, or not an array
 * @param defaultValue Optional default value if not provided (empty array by default)
 * @returns The array value or default value
 */
export function safeArray<T>(value: T[] | null | undefined, defaultValue: T[] = []): T[] {
  if (value === null || value === undefined || !Array.isArray(value)) {
    return defaultValue;
  }
  return value;
}

/**
 * Safely gets an object value
 * @param value The value that might be null, undefined, or not an object
 * @param defaultValue Optional default value if not provided (empty object by default)
 * @returns The object value or default value
 */
export function safeObject<T extends Record<string, any>>(value: T | null | undefined, defaultValue: T = {} as T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return defaultValue;
  }
  return value;
}

/**
 * Formats a number as European currency (with commas for thousands)
 * @param value The number value
 * @param currency The currency symbol (default: €)
 * @returns Formatted currency string
 */
export function formatEuropeanCurrency(value: number | string | null | undefined, currency: string = '€'): string {
  const num = safeNumber(value, 0);
  return `${num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Formats a date in Greek format (DD/MM/YYYY)
 * @param value The date value
 * @param defaultValue Optional default value
 * @returns Formatted date string
 */
export function formatGreekDate(value: Date | string | null | undefined, defaultValue: string = ''): string {
  if (!value) return defaultValue;
  
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return defaultValue;
    
    return date.toLocaleDateString('el-GR');
  } catch {
    return defaultValue;
  }
}

/**
 * Capitalizes the first letter of each word in a string
 * @param value The string value
 * @returns Capitalized string
 */
export function capitalizeWords(value: string | null | undefined): string {
  const str = safeString(value);
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Validates Greek AFM (Tax Identification Number)
 * @param afm The AFM string
 * @returns True if valid AFM
 */
export function isValidGreekAFM(afm: string | null | undefined): boolean {
  const cleanAFM = safeString(afm).replace(/\s/g, '');
  return /^\d{9}$/.test(cleanAFM);
}

/**
 * Cleans and formats Greek AFM
 * @param afm The AFM string
 * @returns Cleaned AFM or empty string if invalid
 */
export function formatGreekAFM(afm: string | null | undefined): string {
  const cleanAFM = safeString(afm).replace(/\s/g, '');
  return isValidGreekAFM(cleanAFM) ? cleanAFM : '';
}