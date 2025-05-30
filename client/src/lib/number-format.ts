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