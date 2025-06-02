/**
 * European Number Formatting Utilities
 * Handles conversion between European format (comma as decimal separator) and database format
 */

/**
 * Format a number for display using European format (comma as decimal separator)
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with European conventions
 */
export function formatEuropeanNumber(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') {
    return '0' + ','.repeat(decimals > 0 ? 1 : 0) + '0'.repeat(decimals);
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return '0' + ','.repeat(decimals > 0 ? 1 : 0) + '0'.repeat(decimals);
  }
  
  // Use toLocaleString with Greek locale for proper European formatting
  return num.toLocaleString('el-GR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Parse a European formatted number string to a number for database storage
 * @param value - The European formatted string (e.g., "1.234,56")
 * @returns Number value suitable for database storage
 */
export function parseEuropeanNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') return value;
  
  const strValue = String(value).trim();
  if (!strValue) return 0;
  
  // Handle European format: "1.234.567,89" -> 1234567.89
  if (strValue.includes('.') && strValue.includes(',')) {
    // Remove dots (thousands separators) and replace comma with decimal point
    const normalized = strValue.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }
  
  // Handle comma as decimal separator: "22,50" -> 22.50
  if (strValue.includes(',') && !strValue.includes('.')) {
    return parseFloat(strValue.replace(',', '.')) || 0;
  }
  
  // Handle standard format
  return parseFloat(strValue) || 0;
}

/**
 * Currency formatter for European format
 * @param value - The amount to format
 * @param currency - Currency symbol (default: €)
 * @returns Formatted currency string
 */
export function formatEuropeanCurrency(value: number | string | null | undefined, currency: string = '€'): string {
  const formatted = formatEuropeanNumber(value, 2);
  return `${formatted} ${currency}`;
}

/**
 * Format number while typing (live formatting)
 * Maintains cursor position and provides real-time European formatting
 * @param value - The current input value
 * @param decimals - Number of decimal places allowed (default: 2)
 * @returns Formatted string that preserves typing flow
 */
export function formatNumberWhileTyping(value: string, decimals: number = 2): string {
  if (!value || value === '') return '';
  
  // Remove all non-numeric characters except comma and dot
  let cleanValue = value.replace(/[^\d,.]/g, '');
  
  // Handle multiple commas - keep only the last one
  const commaIndex = cleanValue.lastIndexOf(',');
  if (commaIndex !== -1) {
    const beforeComma = cleanValue.substring(0, commaIndex).replace(/,/g, '');
    const afterComma = cleanValue.substring(commaIndex + 1).replace(/[,.]/g, '');
    cleanValue = beforeComma + ',' + afterComma.substring(0, decimals);
  }
  
  // Split into integer and decimal parts
  const parts = cleanValue.split(',');
  let integerPart = parts[0] || '';
  let decimalPart = parts[1] || '';
  
  // Format integer part with dots as thousand separators
  if (integerPart.length > 0) {
    // Remove existing dots
    integerPart = integerPart.replace(/\./g, '');
    // Add dots every 3 digits from right
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  
  // Combine parts
  if (parts.length > 1) {
    return integerPart + ',' + decimalPart;
  }
  
  return integerPart;
}

/**
 * Get cursor position after formatting
 * Helps maintain cursor position when live formatting occurs
 * @param originalValue - Value before formatting
 * @param newValue - Value after formatting
 * @param cursorPos - Original cursor position
 * @returns New cursor position
 */
export function getCursorPositionAfterFormatting(
  originalValue: string,
  newValue: string,
  cursorPos: number
): number {
  // Count dots added before cursor position
  const beforeCursor = originalValue.substring(0, cursorPos);
  const beforeCursorFormatted = newValue.substring(0, Math.min(cursorPos, newValue.length));
  
  const originalDots = (beforeCursor.match(/\./g) || []).length;
  const newDots = (beforeCursorFormatted.match(/\./g) || []).length;
  
  return cursorPos + (newDots - originalDots);
}